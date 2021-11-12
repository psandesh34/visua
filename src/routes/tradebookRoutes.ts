import * as express from "express";
import { addTrade, getPortfolio, getTradeBook, postTradeBook , deletePortfolio } from "../controllers/tradebookControllers";
import multer from "multer";
const upload = multer({dest: 'uploads/'});

export default (router: express.Router) => {
  router.get("/tradebook", getTradeBook);
  router.post('/trade', addTrade);
  router.post('/tradebook/upload', upload.single('file'), postTradeBook);
  router.get('/portfolio/:userId', getPortfolio);
  router.post('/delete/portfolio/' , deletePortfolio)
};
