import { Request, Response, NextFunction } from "express";
import fs from "fs";
import csv from "csv-parser";
import { Tradebook } from "../models/tradebookModel";
import { Trade } from "../models/tradeModel";
import mongoose from "mongoose";
import { SymbolCode } from "../models/symbolModel";
import * as tradebookService from "../services/tradebookService";

//& Use below if you want info about single stock
// import yahooStockPrices from "yahoo-stock-prices";
import yahooFinance from "yahoo-finance";
import { Error } from "mongoose";

export async function getTradeBook(req: Request, res: Response) {
  let result: any;
  //& This works for only a single symbol
  // const data = await yahooStockPrices.getCurrentData(['IBULHSGFIN.NS', 'AEGISCHEM.NS']);

  //& This works for multiple symbols
  let symbols = ['TCS.NS'];
  await yahooFinance.quote(
    { symbols },
    function (err: Error, quotes) {
      if (err) {
        console.log(err);
      } else {
        result = quotes;
      }
    }
  );

  res.send(result);
}

export async function addTrade(req: Request, res: Response) {
  const tradeInfo = req.body;
  console.log(`~ tradeInfo`, tradeInfo);
  const trade = {
    // tradeId: tradeInfo.trade_id,
    tradeType: tradeInfo.trade_type,
    tradeDate: tradeInfo.trade_date,
    quantity: tradeInfo.quantity,
    price: tradeInfo.price,
  };
  console.log(`~ trade`, trade);
  const createTrade = await Trade.create(trade);
  console.log(`~ createTrade`, createTrade);

  // const result = await Tradebook.create(tradeInfo);
  res.send(createTrade);
}

export async function postTradeBook(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await tradebookService.importPortfolio(req.file.filename, req.body.userId);
    res.send(result);
  } catch (err) {
    next(err);
  }
}

export async function getPortfolio(req: Request, res: Response) {
  const userId = req.params.userId;
  const result = await tradebookService.getPortfolio(userId);
  res.send(result);
}

export async function deletePortfolio(req: Request, res: Response){
  const userId = req.body.userId;
  const result = await tradebookService.deletePortfolio(userId)
  res.send(result);
}