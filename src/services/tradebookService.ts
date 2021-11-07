import csv from "csv-parser";
import { Trade } from "../models/tradeModel";
import { Tradebook } from "../models/tradebookModel";
import { SymbolCode } from "../models/symbolModel";
import fs from "fs";
import mongoose from "mongoose";
import yahooFinance from "yahoo-finance";

export async function importPortfolio(fileName: string, userId: string) {
  const results = [];
  let tradeCreateResult: any;
  let symbolCreateResult: any;
  let tradebookCreateResult: any;
  // const today = new Date();
  fs.createReadStream(`uploads/${fileName}`)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      const tradeArray = [];
      const symbolArray = [];
      const tradebookObject = {
        userId,
        symbols: [],
        averagePrice: 0,
        totalQuantity: 0,
      };
      const symbolSet = new Set();
      //todo: change tradebook schema to
      //todo: { userId: String, trades: { TCS: [tradeId1, tradeId2], INFY: [tradeId3, tradeId4]} }
      //* use ternary operator to insert data in this above object
      results.forEach(async (result) => {
        const symbolObjectId = new mongoose.Types.ObjectId();
        tradeArray.push({
          _id: result.trade_id,
          tradeType: result.trade_type,
          tradeDate: result.trade_date,
          quantity: result.quantity,
          price: result.price,
        });
        let symbolElementFound = false;
        for (let i = 0; i < symbolArray.length; i++) {
          if (symbolArray[i].symbol === result.symbol) {
            symbolArray[i].trades.push(result.trade_id);
            symbolArray[i].totalQuantity =
              parseInt(symbolArray[i].totalQuantity) +
              parseInt(result.quantity);
            symbolArray[i].averagePrice =
              (parseFloat(symbolArray[i].averagePrice) +
                parseFloat(result.price)) /
              symbolArray[i].totalQuantity;
            symbolElementFound = true;
            break;
          }
        }
        if (!symbolElementFound) {
          symbolArray.push({
            _id: symbolObjectId,
            userId,
            symbol: result.symbol,
            trades: [result.trade_id],
            totalQuantity: result.quantity,
            averagePrice: result.price,
            // lastUpdatedDate: today,
            lastTradedPrice: undefined
          });
        }
        symbolSet.add(symbolObjectId);
      });
      tradebookObject.symbols = [...symbolSet];
      tradeCreateResult = await Trade.create(tradeArray);
      symbolCreateResult = await SymbolCode.create(symbolArray);
      tradebookCreateResult = await Tradebook.create(tradebookObject);
    });
  return { tradeCreateResult, symbolCreateResult, tradebookCreateResult };
}

export async function getPortfolio(userId: string) {
  let holdings = await SymbolCode.find({ userId }).select(
    "symbol averagePrice totalQuantity previousClose lastUpdatedDate"
  );
  const symbols = holdings.map((symbol) => symbol.symbol + '.NS');
  await yahooFinance.quote(
    {
      symbols,
      modules: ["price"],
    },
    function (err: Error, quotes) {
      if (err) {
        console.log(err);
      } else {
        holdings.forEach((el) => {
          el.lastTradedPrice = quotes[el.symbol + '.NS'].price.regularMarketPrice;
        })
      }
    }
  );
  return { userId, holdings };
}

export async function getTradebook(userId: string) {
  const tradebook = await Tradebook.findOne({ userId }).populate({
    path: "symbols",
    model: "Symbol",
    populate: {
      path: "trades",
      model: "Trade",
    },
  });
  return { tradebook };
}
