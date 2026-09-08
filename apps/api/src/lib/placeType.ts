import type { NextFunction, Request, Response } from 'express';
import type { PlaceType } from '@lunch-map/shared';

const VALID: PlaceType[] = ['shop', 'drink', 'dessert'];

export function requirePlaceType(req: Request, res: Response, next: NextFunction) {
  const placeType = req.params.placeType;
  if (!VALID.includes(placeType as PlaceType)) {
    res.status(400).json({ error: `placeType must be one of ${VALID.join(', ')}` });
    return;
  }
  next();
}

export function isPlaceType(v: string): v is PlaceType {
  return (VALID as string[]).includes(v);
}
