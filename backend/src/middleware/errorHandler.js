// Centralized error handler. Returning the underlying error detail makes
// client-side debugging much easier.
function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message,
    stack: err.stack,
  });
}

module.exports = errorHandler;
