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
            if (result.trade_type === "sell") {
              result.quantity = '-' + result.quantity;
              result.price = '-' + result.price;
            }
            let oldQuantity = parseInt(symbolArray[i].totalQuantity);
            symbolArray[i].totalQuantity = parseInt(symbolArray[i].totalQuantity) + parseInt(result.quantity);
            symbolArray[i].averagePrice =
              ((parseFloat(symbolArray[i].averagePrice) * oldQuantity + parseFloat(result.price) * parseInt(result.quantity)) /
              symbolArray[i].totalQuantity).toFixed(2);
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
            marketCap: undefined,
            firstPurchaseDate: result.trade_date,
            sector: undefined,
            industry: undefined,
            marketCapSection: undefined
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
  let holdings = await SymbolCode.find({ userId }).where('totalQuantity').gt(0).sort('firstPurchaseDate').select(
    "symbol averagePrice totalQuantity previousClose firstPurchaseDate"
  );
  const symbols = holdings.map((symbol) => symbol.symbol + '.NS');
  if (symbols.length > 0) {
    await yahooFinance.quote(
      {
        symbols,
        modules: ["price", "summaryProfile"],
      },
      function (err: Error, quotes) {
        if (err) {
          console.log(err);
        } else {
          holdings.forEach((el) => {
            el.lastTradedPrice = quotes[el.symbol + '.NS'].price.regularMarketPrice;
            el.marketCap = quotes[el.symbol + '.NS'].price.marketCap / 10000000;
            el.sector = quotes[el.symbol + '.NS'].summaryProfile.sector;
            el.industry = quotes[el.symbol + '.NS'].summaryProfile.industry;
            if(el.marketCap < 5000) {
              el.marketCapSection = 'Small cap';
            }
            else if(el.marketCap < 20000) {
              el.marketCapSection = 'Mid cap';
            }
            else {
              el.marketCapSection = 'Large cap';
            }
          })
        }
      }
    );
  }
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
