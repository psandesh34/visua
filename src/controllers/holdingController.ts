import { Request, Response, NextFunction } from "express";
import holdingService from "../services/holdingService";

export async function getHoldings(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        // const symbol = req.query.symbol as string;
        const holdingDate = req.query.holdingDate
            ? new Date(req.query.holdingDate as string)
            : new Date();
        holdingDate.setUTCHours(0, 0, 0, 0);
        // get next day of the holdingDate
        const result = await holdingService.getHoldings(req.params.userId, holdingDate);
        res.send(result);
    } catch (err) {
        res.status(err.statusCode || 500).send(err);
    }
}

export async function getHistoricalData(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const symbol = req.query.symbol as string;
        const result = await holdingService.getHistoricalData(symbol);
        res.send(result);
    } catch (err) {
        next(err);
    }
}

// Get holdings info, symbol sector and other basic stuff and previous year stock prices with 1 week interval
export async function getSymbolHistory(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const symbol = req.query.symbol as string;
        const result = await holdingService.getSymbolHistory(
            req.params.userId,
            symbol,
        );
        res.send(result);
    } catch (err) {
        next(err);
    }
}
