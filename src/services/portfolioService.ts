import csv from "csv-parser";
import fs from "fs";
import yahooFinance from "yahoo-finance";
import * as tradeService from "./tradeService";
import * as holdingService from "./holdingService";
import { Trade } from "../models/tradeModel";
import { Portfolio } from "../models/portfolioModel";
import { Holding } from "../models/holdingModel";
import { NSE } from "../shared/symbols";
import { ApiError } from "../shared/services";
/*
 * import the tradebook from uploaded CSV. Sample tradebook can be found in the root directory(smallTradebook.csv)
 * @param {string} fileName - uploaded CSV file name
 * @param {string} userId - user id (Multiple users be implemented later)
 * @returns {message: string} - message to be displayed to the user
 */
export async function importPortfolio(fileName: string, userId: string) {
  const results = [];
  const tradesArray = [];
  const holdingsObject = {};
  const holdingsArray = [];
  fs.createReadStream(`uploads/${fileName}`)
    .pipe(csv())
    .on("data", (data) => {
      data.quantity = +parseInt(data.quantity);
      data.price = +parseFloat(data.price).toFixed(2);
      results.push(data);
      if (data.symbol.slice(-3) === "-BE")
        data.symbol = data.symbol.slice(0, -3);
      if (data.exchange === "BSE")
        data.symbol = NSE[data.symbol] || data.symbol;
      const trade = new Trade({
        _id: data.trade_id,
        userId: userId,
        symbol: data.symbol,
        exchange: data.exchange,
        segment: data.segment,
        tradeType: data.trade_type,
        quantity: data.quantity,
        price: data.price,
        tradeDate: data.trade_date,
        orderExecutionTime: data.order_execution_time || data.trade_date,
      });
      tradesArray.push(trade);
      if (data.trade_type === "sell") {
        data.quantity = -data.quantity;
      }
      if (holdingsObject.hasOwnProperty(data.symbol)) {
        // averagePrice can only change if the tradeType is a buy
        if (data.trade_type === "buy") {
          holdingsObject[data.symbol].averagePrice = +(
            (data.quantity * data.price +
              holdingsObject[data.symbol].averagePrice *
                holdingsObject[data.symbol].totalQuantity) /
            (data.quantity + holdingsObject[data.symbol].totalQuantity)
          ).toFixed(2);
        }
        holdingsObject[data.symbol].totalQuantity += data.quantity;
        // if totalQuantity==0, make averagePrice 0
        if (holdingsObject[data.symbol].totalQuantity === 0) {
          holdingsObject[data.symbol].averagePrice = 0;
        }
      } else {
        holdingsObject[data.symbol] = {
          firstPurchaseDate: data.order_execution_time,
          totalQuantity: data.quantity,
          averagePrice: data.price,
        };
      }
    })
    .on("end", async () => {
      for (const symbol in holdingsObject) {
        holdingsArray.push(Object.assign({ symbol }, holdingsObject[symbol]));
      }
      //TODO: Implement mongoose transactions for following
      await Trade.insertMany(tradesArray);
      const holdingsInsertResult = await Holding.insertMany(holdingsArray);
      let holdingIds = holdingsInsertResult.map((holding) => holding.id);
      await Portfolio.create({
        userId,
        holdings: holdingIds,
      });
    });
  return { message: "Started tradebook import." };
}

/*
 * get the portfolio of the user
 * @param {string} userId - user id
 * @returns {user, holdings} - portfolio of the user
 */
export async function getPortfolio(userId: string) {
  const portfolio = await Portfolio.findOne({ userId })
    .select("-__v")
    .populate({
      path: "holdings",
      select: "-__v",
      match: { totalQuantity: { $gt: 0 } },
    })
    .lean();
  if (!portfolio)
    throw new ApiError("notFoundError", 404, "Portfolio not found");
  if (portfolio.holdings?.length > 0) {
    // '.NS' refers to the symbol prefix for NSE in yahoo finance
    // const symbols = portfolio.holdings.map((symbol) => symbol.symbol + '.NS');
    const symbols = [];
    for (let i = 0; i < portfolio.holdings.length; i++) {
      symbols.push(portfolio.holdings[i].symbol + ".NS");
    }
    if (symbols.length > 0) {
      // get the stock data from yahoo finance
      await yahooFinance.quote(
        {
          symbols,
          modules: ["price", "summaryProfile"],
        },
        function (err: Error, quotes) {
          if (err) {
            console.log(err);
          } else {
            portfolio.holdings.forEach((el) => {
              const yahooSymbol = el.symbol + ".NS";
              el.lastTradedPrice = quotes[yahooSymbol].price.regularMarketPrice;
              // Return the market cap of the stock in scale of 10M
              let marketCap = quotes[yahooSymbol].price.marketCap / 10000000;
              el.sector = quotes[yahooSymbol].summaryProfile.sector;
              el.industry = quotes[yahooSymbol].summaryProfile.industry;
              if (marketCap < 5000) {
                el.marketCapSection = "Small cap";
              } else if (marketCap < 20000) {
                el.marketCapSection = "Mid cap";
              } else {
                el.marketCapSection = "Large cap";
              }
            });
          }
        }
      );
    }
  }
  return portfolio;
}

export async function deletePortfolio(userId: string) {
  // todo: implement mongoose transactions or pre-hooks
  const result = await Portfolio.findOne({ userId }).select("holdings").lean();
  if (!result) throw new ApiError("notFoundError", 404, "Portfolio not found");
  await tradeService.deleteTrades(userId);
  await holdingService.deleteHoldings(result.holdings);
  const deleteResult = await Portfolio.deleteOne({ userId }).lean();
  return { message: "Portfolio deleted successfully", result: deleteResult };
}
