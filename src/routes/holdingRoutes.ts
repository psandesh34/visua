import * as express from 'express';
import * as holdingController from '../controllers/holdingController';
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

export default (router: express.Router) => {
    router.get('/holdings/:userId', holdingController.getHoldings);
    router.get('/symbol/historical', holdingController.getHistoricalData);
};
