import { Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendErrorResponse = (res: Response, error: unknown): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  } else if (error instanceof Error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'An unknown error occurred',
    });
  }
};

export const sendSuccessResponse = (res: Response, data: unknown, message = 'Success'): void => {
  res.status(200).json({
    success: true,
    message,
    data,
  });
};
