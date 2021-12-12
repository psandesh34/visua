import { Request, Response, NextFunction } from 'express';
import portfolioService from '../services/portfolioService';

export async function importPortfolio(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await portfolioService.importPortfolio(
			req.file.filename,
			req.body.userId
		);
		res.send(result);
	} catch (err) {
		next(err);
	}
}

export async function deletePortfolio(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const userId = req.params.userId;
		const result = await portfolioService.deletePortfolio(userId);
		res.send(result);
	} catch (err) {
		next(err);
	}
}
