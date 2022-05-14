import * as express from "express";
import multer from "multer";
import {
    importPortfolio,
    deletePortfolio,
} from "../controllers/portfolioControllers";

const upload = multer({ dest: "uploads/" });

export default (router: express.Router) => {
    router.post("/tradebook/upload", upload.single("file"), importPortfolio);
    router.delete("/portfolio/:userId", deletePortfolio);
};
