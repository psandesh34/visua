import * as express from 'express';
import { getRunningSumOfInvestedAmount } from '../controllers/tradeController';

export default (router: express.Router) => {
	router.get('/tradebook/investedAmount/:userId', getRunningSumOfInvestedAmount);
};
