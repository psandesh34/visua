import { Request, Response, NextFunction } from 'express';
import holdingService from '../services/holdingService';

export async function getHoldings(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		let result: any;
		const symbol = req.query.symbol as string;
		if (symbol) {
			result = await holdingService.getSymbolDetails(req.params.userId, symbol);
		} else {
			result = await holdingService.getHoldings(req.params.userId);
		}
		res.send(result);
	} catch (err) {
		next(err);
	}
}

export async function getHoldingsOverview(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await holdingService.getHoldingsOverview(req.params.userId);
		res.send(result);
	} catch (err) {
		next(err);
	}
}

export async function getChartData(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await holdingService.getChartData(req.params.userId);
		res.send(result);
	} catch (err) {
		next(err);
	}
}
