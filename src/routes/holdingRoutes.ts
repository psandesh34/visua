import * as express from "express";
import * as holdingController from "../controllers/holdingController";

export default (router: express.Router) => {
    router.get("/holdings/:userId", holdingController.getHoldings);
    router.get("/symbol/historical", holdingController.getHistoricalData);
    router.get("/symbol/history/:userId", holdingController.getSymbolHistory);
};
