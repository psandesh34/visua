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
