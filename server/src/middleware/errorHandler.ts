import { Request, Response, NextFunction } from 'express';
import { AppError, sendError } from '../utils/response';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof AppError) {
    logger.warn(`Handled application error [${err.code}]: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      details: err.details
    });
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // Handle Axios errors from internal services
  if (err.isAxiosError) {
    const status = err.response?.status || 502;
    const responseData = err.response?.data;
    const message =
      responseData?.detail?.message ||
      responseData?.detail ||
      responseData?.error?.message ||
      err.message ||
      'An upstream service call failed.';

    let code = responseData?.detail?.code || responseData?.error?.code;
    if (!code) {
      if (status === 502 || status === 503 || String(message).toLowerCase().includes('provider') || String(message).toLowerCase().includes('ollama') || String(message).toLowerCase().includes('gemma')) {
        code = 'PROVIDER_UNAVAILABLE';
      } else {
        code = 'UPSTREAM_SERVICE_ERROR';
      }
    }

    logger.error(`Upstream Axios error [${code}]: ${message}`, {
      url: err.config?.url,
      status
    });

    return sendError(res, code, typeof message === 'string' ? message : JSON.stringify(message), status);
  }

  // Catch-all unhandled errors (never expose internal stack trace or credentials)
  logger.error('Unhandled internal server error:', {
    message: err?.message,
    stack: err?.stack
  });

  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred while processing your request.',
    500
  );
}
