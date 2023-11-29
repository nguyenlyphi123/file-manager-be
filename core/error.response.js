class ErrorResponse extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class BadRequestError extends ErrorResponse {
  constructor(message) {
    super(message, 400);
  }
}

class UnauthorizedError extends ErrorResponse {
  constructor(message) {
    super(message, 401);
  }
}

class ForbiddenError extends ErrorResponse {
  constructor(message) {
    super(message, 403);
  }
}

class NotFoundError extends ErrorResponse {
  constructor(message) {
    super(message, 404);
  }
}

class InternalServerError extends ErrorResponse {
  constructor(message) {
    super(message, 500);
  }
}

const errorHandler = (error, req, res, next) => {
  let { status, message } = error;

  if (!status) {
    status = 500;
  }

  res.status(status).json({
    success: false,
    message: message || 'Internal server error',
  });
};

module.exports = {
  ErrorResponse,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
  errorHandler,
};
