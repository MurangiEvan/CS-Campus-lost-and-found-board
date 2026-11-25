/**
 * Browser-side photo pipeline: decode any image the browser can open, re-encode it as a
 * bounded JPEG (which also strips EXIF/GPS metadata), and send it straight to object storage
 * using the server-issued presigned form, reporting upload progress.
 */

export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITIES = [0.82, 0.7, 0.58, 0.46];
const UPLOAD_TIMEOUT_MS = 120_000;

export type PreparedPhoto = {
  blob: Blob;
  previewUrl: string;
  name: string;
  originalBytes: number;
};

export type PresignedUpload = {
  upload_id: string;
  url: string;
  fields: Record<string, string>;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

async function decodeWithBitmap(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
}

function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    image.src = url;
  });
}

async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    return await decodeWithBitmap(file);
  } catch {
    // Some browsers (e.g. Safari with HEIC) decode via <img> but not createImageBitmap.
  }
  try {
    return await decodeWithImageElement(file);
  } catch {
    throw new Error(isHeic(file)
      ? "This browser can't open HEIC photos. Choose a JPEG or PNG, or set your iPhone camera to \"Most Compatible\"."
      : "This image could not be opened. Choose a different photo.");
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Unable to process this image.")), "image/jpeg", quality);
  });
}

async function encodeWithinLimit(image: DecodedImage): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");

  let scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

    for (const quality of JPEG_QUALITIES) {
      const blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    scale *= 0.75;
  }
  throw new Error("This photo is too large to attach. Choose a smaller image.");
}

/** Validates, orients, resizes and re-encodes a user-selected photo. Caller must revoke `previewUrl`. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!looksLikeImage(file)) throw new Error("Choose a photo file (JPEG, PNG, WebP, or HEIC).");
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`This photo is larger than ${formatBytes(MAX_SOURCE_BYTES)}. Choose a smaller image.`);

  const image = await decodeImage(file);
  try {
    const blob = await encodeWithinLimit(image);
    return { blob, previewUrl: URL.createObjectURL(blob), name: file.name || "Photo", originalBytes: file.size };
  } finally {
    image.release();
  }
}

/** Posts the prepared photo directly to object storage using a presigned form. */
export function sendToStorage(target: PresignedUpload, blob: Blob, onProgress?: (percent: number) => void): Promise<void> {
  const form = new FormData();
  Object.entries(target.fields).forEach(([key, value]) => form.append(key, value));
  form.append("file", blob, "item-photo.jpg");

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", target.url);
    request.timeout = UPLOAD_TIMEOUT_MS;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      console.error("[Image upload] Storage provider rejected the upload", { status: request.status, responseBody: request.responseText });
      reject(new Error(request.status === 403
        ? "Image storage rejected the upload. Please contact campus support."
        : `Photo upload failed (HTTP ${request.status}). Please try again.`));
    };
    request.onerror = () => {
      console.error("[Image upload] Storage request failed before a response was received");
      reject(new Error("Could not reach image storage. Check your connection and try again."));
    };
    request.ontimeout = () => reject(new Error("The photo upload timed out. Check your connection and try again."));
    request.send(form);
  });
}
