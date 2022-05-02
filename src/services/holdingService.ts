import yahooFinance from 'yahoo-finance2';
import { Holding } from '../models/holdingModel';
import { industryName, NSE } from '../shared/constants';

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
							totalQuantity: { $gt: 0 },
						},
					},
				},
			},
			{
				$project: {
					// _id: 0,
					symbol: 1,
					holdingUpdates: {
						//remove all holdingUpdates where date is less than holdingDate
						$filter: {
							input: '$holdingsUpdates',
							as: 'holdingUpdates',
							cond: {
								$lte: ['$$holdingUpdates.date', holdingDate],
							},
						},
					},
				},
			},
			{
				$addFields: {
					// get averagePrice from last element of holdingsUpdates
					averagePrice: {
						$arrayElemAt: ['$holdingUpdates.averagePrice', -1],
					},
					totalQuantity: {
						$arrayElemAt: ['$holdingUpdates.totalQuantity', -1],
					},
				},
			},
			{
				$addFields: {
					investedAmount: {
						$multiply: ['$averagePrice', '$totalQuantity'],
					},
				},
			},
			{ $sort: { symbol: 1 } },
		]);
		// Helps to get any undetected bug where totalQuantity < 0
		holdings = holdings.filter(function (obj) {
			return obj.totalQuantity !== 0;
		});
		if (holdings?.length > 0) {
			const symbols: string[] = [];
			for (let i = 0; i < holdings.length; i++) {
				let symbol = this.getYahooSymbol(holdings[i].symbol);
				symbols.push(symbol);
			}
			if (symbols.length > 0) {
				// get the stock data from yahoo finance
				const results = await yahooFinance.quote(symbols);
				// function (err: Error, quotes: any) {
				// 	if (err) {
				// 		console.log(err);
				// 	} else {
				for (let i = 0; i<holdings.length; i++) {
					const yahooSymbol = HoldingService.getYahooSymbol(holdings[i].symbol);
					if (yahooSymbol !== results[i].symbol) {
						console.log(
							`${yahooSymbol} info missing from yahoo-fnance2 module`
						);
					}
					// Assign symbol-specific data to the holding
					holdings[i].lastTradedPrice = results[i].regularMarketPrice;
					// Return the market cap of the stock in scale of 10M
					let marketCap = results[i].marketCap / 10000000;
					holdings[i].marketCapSection = HoldingService.getMarketCapSection(marketCap);
					holdings[i].industry = industryName[holdings[i].symbol];
					holdings[i].currentValue = +(holdings[i].totalQuantity * holdings[i].lastTradedPrice).toFixed(2);
					holdings[i].profitLoss = +(holdings[i].currentValue - holdings[i].investedAmount).toFixed(2);
					holdings[i].profitLossPercentage = +(
						(holdings[i].profitLoss / holdings[i].investedAmount) *
						100
					).toFixed(2);
					// Update the overview object
					overview.investedAmount += holdings[i].investedAmount;
					overview.currentValue += holdings[i].currentValue;
					// Add the symbolInfo for the pie charts of marketCap and industry
					chartData = HoldingService.addSymbolInfoToChartData(
						chartData,
						['marketCapSection', 'industry'],
						[holdings[i].marketCapSection, holdings[i].industry],
						holdings[i].symbol,
						holdings[i].investedAmount
					);
				}
				// 		}
				// 	}
				// );
			}
		}
		overview.currentValue = +overview.currentValue.toFixed(2);
		overview.investedAmount = +overview.investedAmount.toFixed(2);
		overview.profitLoss = +(
			overview.currentValue - overview.investedAmount
		).toFixed(2);
		overview.profitLossPercentage =
			+(
				((overview.currentValue - overview.investedAmount) /
					overview.investedAmount) *
				100
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
		let holding: any = await Holding.findOne({ symbol, userId }).lean();
		if (!holding) {
			holding = {};
		}
		let data: any;
		const yahooSymbol = this.getYahooSymbol(symbol);
		// get the stock data from yahoo finance
		const result = await yahooFinance.quoteSummary(yahooSymbol, {
            modules: ["price", "summaryProfile"]
        });
		// function (err: Error, quotes: any) {
		// 	if (err) {
		// 		console.log(err);
		// 	} else {
		data = result;
		holding.lastTradedPrice = result.price.regularMarketPrice;
		// Return the market cap of the stock in scale of 10M
		let marketCap = result.price.marketCap / 10000000;
		holding.marketCapSection = HoldingService.getMarketCapSection(marketCap);
		if (result.summaryProfile) {
			holding.industry = industryName[symbol];
		}
		// 		}
		// 	}
		// );
        console.log(`HoldingService ~ getSymbolDetails ~ { holding, data }`, { holding, data });
		return { holding, data };
	}

	private static getYahooSymbol(symbol: string) {
		if (NSE[symbol] && NSE[symbol] === 'None') {
			symbol = symbol + '.BO';
		} else {
			symbol = symbol + '.NS';
		}
		return symbol;
	}

	private static addSymbolInfoToChartData<T>(
		chartData: T,
		chartCategories: string[],
		subsections: string[],
		symbol: string,
		investedAmount: number
	) {
		for (let i = 0; i < chartCategories.length; i++) {
			//check if chartData object has the section in it, if not create one and add the info
			if (chartData[chartCategories[i]].hasOwnProperty(subsections[i])) {
				chartData[chartCategories[i]][subsections[i]].totalInvestedAmount +=
					investedAmount;
				chartData[chartCategories[i]][subsections[i]].data.push(investedAmount);
				chartData[chartCategories[i]][subsections[i]].labels.push(symbol);
			} else {
				chartData[chartCategories[i]][subsections[i]] = {
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
			return 'Small cap';
		} else if (marketCap < 20000) {
			return 'Mid cap';
		} else {
			return 'Large cap';
		}
	}

	public static async getChartData(userId: string) {
		const result = await Holding.aggregate([
			{
				$match: {
					userId,
					totalQuantity: { $gt: 0 },
				},
			},
			{
				$addFields: {
					investedAmount: {
						$multiply: ['$averagePrice', '$totalQuantity'],
					},
				},
			},
		]);
		return result;
	}

	public static async getHistoricalData(symbol: string) {
		const yahooSymbol = this.getYahooSymbol(symbol);
		let data: any;
		const today = new Date();
		const before1y = new Date(
			today.getFullYear() - 1,
			today.getMonth(),
			today.getDate()
		);
		const result = await yahooFinance.historical(yahooSymbol, {
			period1: '2021-01-01',
			period2: today,
			interval: '1wk',
		});
		// function (err: Error, quotes: any) {
		// if (err) {
		// console.log(err);
		// } else {
		data = result;
        console.log(`HoldingService ~ getHistoricalData ~ data`, data);
		// }
		// }
		// );
		const chartjsFormat = {
			labels: [],
			data: [],
		};
		for (let i = 1; i < result.length; i++) {
			chartjsFormat.labels.push(result[i].date.toDateString());
			chartjsFormat.data.push(data[i].open);
		}
		return chartjsFormat;
	}
}
