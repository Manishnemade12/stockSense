import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

export const sendList = <T>(res: Response, data: T[], meta: PaginationMeta): Response => {
  return res.status(200).json({
    success: true,
    data,
    meta,
  });
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400
): Response => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};
