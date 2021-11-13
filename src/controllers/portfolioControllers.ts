import { Request, Response, NextFunction } from "express";
import * as tradebookService from "../services/portfolioService";

export async function importPortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await tradebookService.importPortfolio(req.file.filename, req.body.userId);
    res.send(result);
  } catch (err) {
    next(err);
  }
}

export async function getPortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId;
    const result = await tradebookService.getPortfolio(userId);
    res.send(result);
  } catch (err) {
    next(err);
  }
}

export async function deletePortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId;
    const result = await tradebookService.deletePortfolio(userId);
    res.send(result);
  } catch (err) {
    next(err);
  }
}