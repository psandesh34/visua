import { Request, Response, NextFunction } from "express";
import * as holdingService from "../services/holdingService";

export async function getHoldings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await holdingService.getHoldings(req.params.userId);
    res.send(result);
  } catch (err) {
    next(err);
  }
}