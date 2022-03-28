import * as express from 'express';
import {
    getChartData,
    getHoldings,
} from '../controllers/holdingController';
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

export default (router: express.Router) => {
    router.get('/holdings/:userId', getHoldings);
    router.get('/holdings/chart/:userId', getChartData);
};
