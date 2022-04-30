import * as express from 'express';
import * as tradeController from '../controllers/tradeController';

export default (router: express.Router) => {
    router.get('/tradebook/investedAmount/:userId', tradeController.getRunningSumOfInvestedAmount);
    router.get('/trades/:userId', tradeController.getSymbolTrades);
};
