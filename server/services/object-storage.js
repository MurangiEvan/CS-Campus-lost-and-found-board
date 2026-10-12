const { randomUUID } = require('node:crypto');
const { S3Client, HeadObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');

const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const defaultMaxBytes = 5 * 1024 * 1024;
let cachedClient;

function getConfig() {
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL } = process.env;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_PUBLIC_BASE_URL) {
    throw new Error('Object storage is not configured');
  }

  let publicBase;
  try {
    publicBase = new URL(S3_PUBLIC_BASE_URL);
  } catch {
    throw new Error('S3_PUBLIC_BASE_URL must be a valid URL');
  }
  if (!['https:', 'http:'].includes(publicBase.protocol) || publicBase.username || publicBase.password || publicBase.search || publicBase.hash) {
    throw new Error('S3_PUBLIC_BASE_URL must be an HTTP(S) URL without credentials');
  }
  if (process.env.NODE_ENV === 'production' && publicBase.protocol !== 'https:') {
    throw new Error('S3_PUBLIC_BASE_URL must use HTTPS in production');
  }

  const maxBytes = Number(process.env.IMAGE_UPLOAD_MAX_BYTES || defaultMaxBytes);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 20 * 1024 * 1024) {
    throw new Error('IMAGE_UPLOAD_MAX_BYTES must be between 1 and 20971520');
  }

  return {
    bucket: S3_BUCKET,
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    publicBase,
    maxBytes,
  };
}

function getClient(config) {
  const cacheKey = [config.region, config.endpoint, config.accessKeyId, config.secretAccessKey].join('|');
  if (!cachedClient || cachedClient.cacheKey !== cacheKey) {
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: Boolean(config.endpoint),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    cachedClient = { cacheKey, client };
  }
  return cachedClient.client;
}

function validateUpload({ contentType, size }) {
  const config = getConfig();
  if (!allowedTypes.has(contentType)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > config.maxBytes) {
    throw new Error(`Image must be no larger than ${config.maxBytes} bytes.`);
  }
  return { config, extension: allowedTypes.get(contentType) };
}

async function createUpload({ contentType, size, ownerId }) {
  const { config, extension } = validateUpload({ contentType, size });
  const uploadId = randomUUID();
  const key = `staging/${ownerId}/${uploadId}.${extension}`;
  const signed = await createPresignedPost(getClient(config), {
    Bucket: config.bucket,
    Key: key,
    Expires: 300,
    Fields: { 'Content-Type': contentType },
    Conditions: [
      ['content-length-range', 1, config.maxBytes],
      ['eq', '$Content-Type', contentType],
    ],
  });
  return { uploadId, key, contentType, size, uploadUrl: signed.url, fields: signed.fields };
}

function hasSupportedImageSignature(contentType, value) {
  const bytes = Buffer.from(value);
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function publicUrlForKey(key, publicBase = getConfig().publicBase) {
  return new URL(key.split('/').map(encodeURIComponent).join('/'), publicBase.toString().replace(/\/?$/, '/')).toString();
}

function keyFromPublicUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl) return null;
  let publicBase;
  try {
    ({ publicBase } = getConfig());
  } catch {
    return null;
  }
  let image;
  try {
    image = new URL(imageUrl);
  } catch {
    return null;
  }
  const basePath = publicBase.pathname.replace(/\/?$/, '/');
  if (image.origin !== publicBase.origin || !image.pathname.startsWith(basePath)) return null;
  let key;
  try {
    key = image.pathname.slice(basePath.length).split('/').map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
  if (!key.startsWith('items/') || key.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return key;
}

function isManagedObjectKey(key) {
  return typeof key === 'string' && /^(?:staging|items)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(key);
}

async function finalizeUploadedObject({ key, contentType, size }) {
  const config = getConfig();
  const client = getClient(config);
  const result = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  if (result.ContentType !== contentType || result.ContentLength !== size || result.ContentLength > config.maxBytes) {
    throw new Error('Uploaded image does not match the approved upload');
  }
  const sample = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: 'bytes=0-11' }));
  const bytes = Buffer.from(await sample.Body.transformToByteArray());
  if (!hasSupportedImageSignature(contentType, bytes)) throw new Error('Uploaded file is not a supported image');
  const [prefix, ownerId] = key.split('/');
  if (prefix !== 'staging' || !isManagedObjectKey(key)) throw new Error('Uploaded image key is invalid');
  const extension = allowedTypes.get(contentType);
  const permanentKey = `items/${ownerId}/${randomUUID()}.${extension}`;
  const copySource = `${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  await client.send(new CopyObjectCommand({
    Bucket: config.bucket,
    Key: permanentKey,
    CopySource: copySource,
    ContentType: contentType,
    MetadataDirective: 'REPLACE',
  }));
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    try { await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: permanentKey })); } catch { /* Retain original error; provider lifecycle policy can clean an orphan. */ }
    throw error;
  }
  return { imageUrl: publicUrlForKey(permanentKey, config.publicBase), objectKey: permanentKey };
}

async function deleteObject(key) {
  if (!isManagedObjectKey(key)) return false;
  const config = getConfig();
  await getClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  return true;
}

async function deleteImageUrl(imageUrl, ownerId) {
  const key = keyFromPublicUrl(imageUrl);
  if (!key || !ownerId || !key.startsWith(`items/${ownerId}/`)) return false;
  await deleteObject(key);
  return true;
}

module.exports = { validateUpload, createUpload, hasSupportedImageSignature, publicUrlForKey, keyFromPublicUrl, isManagedObjectKey, finalizeUploadedObject, deleteObject, deleteImageUrl };