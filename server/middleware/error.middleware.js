const errorMiddleware = (err, req, res, next) => {
  console.error(`[Error] ${err.stack}`);

  const status = err.status || 500;
  const message = status >= 500 ? 'Service temporarily unavailable. Please try again later.' : err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    status,
    ...(status < 500 && process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorMiddleware };
