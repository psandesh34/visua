import * as express from "express";
import { getHoldings } from "../controllers/holdingController";
import multer from "multer";
const upload = multer({dest: 'uploads/'});

export default (router: express.Router) => {
  router.get('/holdings/:userId', getHoldings);
};
