const productionOrigins = ['https://cs-campus-lost-and-found-board.vercel.app'];
const developmentOrigins = ['http://localhost:3000', 'https://cs-campus-lost-and-found-board.vercel.app'];
const stableVercelOrigin = 'https://clienntt.vercel.app';
const vercelPreviewOrigin = /^https:\/\/clienntt-[a-z0-9]+-murangievans-projects\.vercel\.app$/;

function getAllowedOrigins(env = process.env) {
  const configured = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : env.NODE_ENV === 'production' ? productionOrigins : developmentOrigins;
  return [...new Set(configured)];
}

function isAllowedOrigin(origin, allowedOrigins) {
  return origin === stableVercelOrigin || allowedOrigins.includes(origin) || vercelPreviewOrigin.test(origin);
}

function getCookieSameSite(env = process.env) {
  return env.COOKIE_SAMESITE || (env.NODE_ENV === 'production' ? 'none' : 'lax');
}

module.exports = { getAllowedOrigins, getCookieSameSite, isAllowedOrigin };