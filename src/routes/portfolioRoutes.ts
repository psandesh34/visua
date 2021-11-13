import * as express from "express";
import { getPortfolio, importPortfolio , deletePortfolio } from "../controllers/portfolioControllers";
import multer from "multer";
const upload = multer({dest: 'uploads/'});

export default (router: express.Router) => {
  router.post('/tradebook/upload', upload.single('file'), importPortfolio);
  router.get('/portfolio/:userId', getPortfolio);
  router.delete('/portfolio/:userId' , deletePortfolio)
};
