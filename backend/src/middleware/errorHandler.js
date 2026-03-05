/**
 * errorHandler.js
 * Centralised error handling — formats API errors consistently.
 */

function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  // Log full error in dev
  if (process.env.NODE_ENV !== "production") {
    console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    path: req.path,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
