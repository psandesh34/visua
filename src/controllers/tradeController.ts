import { Request, Response, NextFunction } from 'express';
import TradeService from '../services/tradeService';

export async function getRunningSumOfInvestedAmount(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const result = await TradeService.getRunningSumOfInvestedAmount(
            req.params.userId
        );
        res.send(result);
    } catch (err) {
        next(err);
    }
}

export async function getSymbolTrades(req: Request, res: Response, next: NextFunction) {
    try {
        const symbol = req.query.symbol as string;
        const result = await TradeService.getSymbolTrades(req.params.userId, symbol);
        res.send(result);
    } catch (err) {
        next(err);
    }
}
