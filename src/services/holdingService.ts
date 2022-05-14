import yahooFinance from "yahoo-finance2";
import { Holding } from "../models/holdingModel";
import { IndustryName, NSE } from "../shared/constants";

export default class HoldingService {
    /* Delete holdings by userId.
     * @param {string} userId - user id
     */
    public static async deleteHoldings(holdingIds: string[]) {
        const result = await Holding.deleteMany({ id: { $in: holdingIds } });
        return result;
    }

    /* Get holdings by userId.
     * @param {string} userId - user id
     * @returns {Holding[]} - array of holdings with LTP, totalInvestedAmount, totalQuantity, averagePrice for each symbol
     */
    public static async getHoldings(userId: string, holdingDate: Date) {
        let chartData = {
            marketCapSection: {},
            industry: {},
        };
        const overview = {
            investedAmount: 0,
            currentValue: 0,
            profitLoss: 0,
            profitLossPercentage: 0,
        };
        // Check if holdingsArray.remainingQuantity is more than 0 at a date<=holdingDate
        let holdings = await Holding.aggregate([
            {
                $match: {
                    userId,
                    // "holdingsUpdates.totalQuantity": { $gt: 0 },
                    holdingsUpdates: {
                        $elemMatch: {
                            date: { $lte: holdingDate },
                            remainingQuantity: { $gt: 0 },
                        },
                    },
                },
            },
            {
                $project: {
                    // _id: 0,
                    symbol: 1,
                    holdingUpdates: {
                        // remove all holdingUpdates where date is less than holdingDate
                        $filter: {
                            input: "$holdingsUpdates",
                            as: "holdingUpdates",
                            cond: {
                                $lte: ["$$holdingUpdates.date", holdingDate],
                            },
                        },
                    },
                },
            },
            {
                $addFields: {
                    // get averagePrice from last element of holdingsUpdates
                    averagePrice: {
                        $arrayElemAt: ["$holdingUpdates.averagePrice", -1],
                    },
                    totalQuantity: {
                        $arrayElemAt: ["$holdingUpdates.remainingQuantity", -1],
                    },
                },
            },
            {
                $addFields: {
                    investedAmount: {
                        $multiply: ["$averagePrice", "$totalQuantity"],
                    },
                },
            },
            { $sort: { symbol: 1 } },
        ]);
        // Helps to get any undetected bug where totalQuantity < 0
        holdings = holdings.filter((obj) => obj.totalQuantity !== 0);
        if (holdings?.length > 0) {
            const symbols: string[] = [];
            for (let i = 0; i < holdings.length; i += 1) {
                const symbol = this.getYahooSymbol(holdings[i].symbol);
                symbols.push(symbol);
            }
            if (symbols.length > 0) {
                // get the stock data from yahoo finance
                const results = await yahooFinance.quote(symbols);
                for (let i = 0; i < holdings.length; i += 1) {
                    const yahooSymbol = HoldingService.getYahooSymbol(
                        holdings[i].symbol,
                    );
                    if (yahooSymbol !== results[i].symbol) {
                        // eslint-disable-next-line no-console
                        console.log(
                            `${yahooSymbol} info missing from yahoo-finance2 module`,
                        );
                    }
                    // Assign symbol-specific data to the holding
                    holdings[i].lastTradedPrice = results[i].regularMarketPrice;
                    // Return the market cap of the stock in scale of 10M
                    const marketCap = results[i].marketCap / 10000000;
                    holdings[i].marketCapSection = HoldingService.getMarketCapSection(marketCap);
                    holdings[i].industry = IndustryName[holdings[i].symbol];
                    holdings[i].currentValue = +(
                        holdings[i].totalQuantity * holdings[i].lastTradedPrice
                    ).toFixed(2);
                    holdings[i].profitLoss = +(
                        holdings[i].currentValue - holdings[i].investedAmount
                    ).toFixed(2);
                    holdings[i].profitLossPercentage = +(
                        (holdings[i].profitLoss / holdings[i].investedAmount)
                        * 100
                    ).toFixed(2);
                    // Update the overview object
                    overview.investedAmount += holdings[i].investedAmount;
                    overview.currentValue += holdings[i].currentValue;
                    // Add the symbolInfo for the pie charts of marketCap and industry
                    chartData = HoldingService.addSymbolInfoToChartData(
                        chartData,
                        ["marketCapSection", "industry"],
                        [holdings[i].marketCapSection, holdings[i].industry],
                        holdings[i].symbol,
                        holdings[i].investedAmount,
                    );
                }
            }
        }
        overview.currentValue = +overview.currentValue.toFixed(2);
        overview.investedAmount = +overview.investedAmount.toFixed(2);
        overview.profitLoss = +(
            overview.currentValue - overview.investedAmount
        ).toFixed(2);
        overview.profitLossPercentage = +(
            ((overview.currentValue - overview.investedAmount)
                    / overview.investedAmount)
                * 100
        ).toFixed(2) || 0;
        return { holdings, chartData, overview };
    }

    /* Get single symbol by holdingId and userId.
     * @param {string} userId - user id
     * @param {string} symbol - symbol
     * @returns {Holding} - holding with details from yahoo finance
     * @throws {Error} - if holdingId or userId is not found
     */
    public static async getSymbolDetails(userId: string, symbol: string) {
        const holdingDataPromise = Holding.findOne({ symbol, userId }).lean();

        let holdingData: any;
        let symbolSummary: any;
        const yahooSymbol = this.getYahooSymbol(symbol);
        // get the stock data from yahoo finance
        const symbolSummaryPromise = yahooFinance.quoteSummary(yahooSymbol, {
            modules: ["price", "summaryProfile"],
        });
        await Promise.all([holdingDataPromise, symbolSummaryPromise]).then(
            (values) => {
                [holdingData, symbolSummary] = values;
                // symbolSummary = values[1];
                if (!holdingData) {
                    holdingData = {};
                }
                holdingData.lastTradedPrice = symbolSummary.price.regularMarketPrice;
                // Return the market cap of the stock in scale of 10M
                const marketCap = symbolSummary.price.marketCap / 10000000;
                holdingData.marketCapSection = HoldingService.getMarketCapSection(marketCap);
                if (symbolSummary.summaryProfile) {
                    holdingData.industry = IndustryName[symbol];
                }
            },
        );
        return { holdingData, symbolSummary };
    }

    private static getYahooSymbol(symbol: string) {
        let yahooSymbol;
        if (NSE[symbol] && NSE[symbol] === "None") {
            yahooSymbol = `${symbol}.BO`;
        } else {
            yahooSymbol = `${symbol}.NS`;
        }
        return yahooSymbol;
    }

    private static addSymbolInfoToChartData<T>(
        chartData: T,
        chartCategories: string[],
        subsections: string[],
        symbol: string,
        investedAmount: number,
    ) {
        for (let i = 0; i < chartCategories.length; i += 1) {
            // check if chartData object has the section in it, if not create one and add the info
            let subsectionObject = chartData[chartCategories[i]][subsections[i]];
            if (subsectionObject) {
                subsectionObject.totalInvestedAmount += investedAmount;
                subsectionObject.data.push(
                    investedAmount,
                );
                subsectionObject.labels.push(
                    symbol,
                );
            } else {
                subsectionObject = {
                    totalInvestedAmount: investedAmount,
                    data: [investedAmount],
                    labels: [symbol],
                };
            }
        }
        return chartData;
    }

    private static getMarketCapSection(marketCap: number) {
        if (marketCap < 5000) {
            return "Small cap";
        }
        if (marketCap < 20000) {
            return "Mid cap";
        }
        return "Large cap";
    }

    public static async getHistoricalData(symbol: string) {
        const yahooSymbol = this.getYahooSymbol(symbol);
        const today = new Date();
        // const before1y = new Date(
        //     today.getFullYear() - 1,
        //     today.getMonth(),
        //     today.getDate(),
        // );
        const result = await yahooFinance.historical(yahooSymbol, {
            period1: "2021-01-01",
            period2: today,
            interval: "1d",
        });
        const data = result;
        const chartjsFormat = {
            labels: [],
            data: [],
        };
        for (let i = 1; i < result.length; i += 1) {
            chartjsFormat.labels.push(result[i].date.toDateString());
            chartjsFormat.data.push(data[i].open);
        }
        return chartjsFormat;
    }

    // Return the past 1 year weekly stock price, and the details of the symbols from yahoo finance
    public static async getSymbolHistory(userId: string, symbol: string) {
        const symbolDataWithHoldingInfo = this.getSymbolDetails(userId, symbol);
        const priceChartData = this.getHistoricalData(symbol);
        let result: any;
        await Promise.all([symbolDataWithHoldingInfo, priceChartData]).then(
            (values: any) => {
                const holding = values[0].holdingData;
                const data = values[0].symbolSummary;
                const chartjsFormat = values[1];
                result = { holding, data, previousYearPrices: chartjsFormat };
            },
        );
        return result;
    }
}
