const errorMiddleware = (err, req, res, next) => {
  console.error(`[Error] ${err.stack}`);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: true,
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorMiddleware };
