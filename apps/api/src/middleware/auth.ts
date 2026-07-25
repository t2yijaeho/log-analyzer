import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from '../errors/ApiError.js';

export function isAuthorizedHeader(header: string | undefined, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice('Bearer '.length), 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function requireAccessToken(req: Request, _res: Response, next: NextFunction): void {
  if (!isAuthorizedHeader(req.header('Authorization'), config.accessToken)) {
    next(ApiError.unauthorized());
    return;
  }
  next();
}
