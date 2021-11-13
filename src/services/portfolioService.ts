import csv from "csv-parser";
import { Order } from "../models/orderModel";
import { Portfolio } from "../models/portfolioModel";
import fs from "fs";
import yahooFinance from "yahoo-finance";
import { Holding } from "../models/holdingModel";
import * as orderService from "./orderService";
import * as holdingService from "./holdingService";

/*
* import the tradebook from uploaded CSV. Sample tradebook can be found in the root directory(smallTradebook.csv)
* @param {string} fileName - uploaded CSV file name
* @param {string} userId - user id (Multiple users be implemented later)
* @returns {message: string} - message to be displayed to the user
*/
export async function importPortfolio(fileName: string, userId: string) {
  const results = [];
  const ordersArray = [];
  const holdingsObject = {};
  const holdingsArray = [];
  fs.createReadStream(`uploads/${fileName}`)
    .pipe(csv())
    .on("data", (data) => {
      data.quantity = +parseInt(data.quantity);
      data.price = +parseFloat(data.price).toFixed(2);
      results.push(data);
      ordersArray.push({
        _id: data.order_id,
        userId,
        symbol: data.symbol,
        exchange: data.exchange,
        segment: data.segment,
        series: data.series,
        orderType: data.trade_type,
        quantity: data.quantity,
        price: data.price
      });
      if (data.trade_type === "sell") {
        data.quantity = -data.quantity;
      }
      if (holdingsObject.hasOwnProperty(data.symbol)) {
        // averagePrice can only change if the tradeType is a buy
        if (data.trade_type === "buy") {
          holdingsObject[data.symbol].averagePrice =
            +((
              data.quantity * data.price
              + holdingsObject[data.symbol].averagePrice * holdingsObject[data.symbol].totalQuantity
            ) /
              (data.quantity + holdingsObject[data.symbol].totalQuantity)).toFixed(2);
        }
        holdingsObject[data.symbol].totalQuantity += data.quantity;
        // if totalQuantity==0, remove the symbol from holdingsObject
        if (holdingsObject[data.symbol].totalQuantity === 0) {
          delete holdingsObject[data.symbol];
        }
      }
      else {
        holdingsObject[data.symbol] = {
          firstPurchaseDate: data.order_execution_time,
          totalQuantity: data.quantity,
          averagePrice: data.price
        };
      }
    })
    .on("end", async () => {
      for (const symbol in holdingsObject) {
        holdingsArray.push(Object.assign({ symbol }, holdingsObject[symbol]));
      }
      //TODO: Implement mongoose transactions for following
      await Order.insertMany(ordersArray);
      const holdingsInsertResult = await Holding.insertMany(holdingsArray);
      let holdingIds = holdingsInsertResult.map(holding => holding.id);
      await Portfolio.create({
        userId,
        holdings: holdingIds
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
  const portfolio = await Portfolio.findOne({ userId }).select('-__v').populate('holdings', '-__v').lean();
  if (portfolio.holdings.length > 0) {
    // '.NS' refers to the symbol prefix for NSE in yahoo finance
    const symbols = portfolio.holdings.map((symbol) => symbol.symbol + '.NS');
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
              const yahooSymbol = el.symbol + '.NS';
              el.lastTradedPrice = quotes[yahooSymbol].price.regularMarketPrice;
              // Return the market cap of the stock in scale of 10M
              let marketCap = quotes[yahooSymbol].price.marketCap / 10000000;
              el.sector = quotes[yahooSymbol].summaryProfile.sector;
              el.industry = quotes[yahooSymbol].summaryProfile.industry;
              if (marketCap < 5000) {
                el.marketCapSection = 'Small cap';
              }
              else if (marketCap < 20000) {
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
  }
  return portfolio;
}

export async function deletePortfolio(userId: string) {
  // todo: implement mongoose transactions or pre-hooks
  const result = await Portfolio.findOne({ userId }).select('holdings').lean();
  await orderService.deleteOrders(userId);
  await holdingService.deleteHoldings(result.holdings);
  const deleteResult = await Portfolio.deleteOne({ userId }).lean();
  return { message: "Portfolio deleted successfully", result: deleteResult };
}
