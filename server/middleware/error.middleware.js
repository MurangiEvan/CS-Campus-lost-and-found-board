const errorMiddleware = (err, req, res, next) => {
  const status = err.status || 500;
  if (process.env.NODE_ENV === 'production') {
    console.error(`[Error] ${req.method} ${req.path} (${status})`);
  } else {
    console.error(`[Error] ${err.stack}`);
  }
  const message = status >= 500 ? 'Service temporarily unavailable. Please try again later.' : err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    status,
    ...(status < 500 && process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorMiddleware };
