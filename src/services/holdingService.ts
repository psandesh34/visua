import yahooFinance from 'yahoo-finance';
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
			{ $sort: { investedAmount: -1 } },
		]);
		console.log(`HoldingService ~ getHoldings ~ holdings`, holdings);
		// Helps to get any undetected bug where totalQuantity < 0
		holdings = holdings.filter(function (obj) {
			return obj.totalQuantity !== 0;
		});
		if (holdings?.length > 0) {
			const symbols = [];
			for (let i = 0; i < holdings.length; i++) {
				let symbol = this.getYahooSymbol(holdings[i].symbol);
				symbols.push(symbol);
			}
			if (symbols.length > 0) {
				// get the stock data from yahoo finance
				await yahooFinance.quote(
					{
						symbols,
						modules: ['price', 'summaryProfile'],
					},
					function (err: Error, quotes: any) {
						if (err) {
							console.log(err);
						} else {
							for (let el of holdings) {
								const yahooSymbol = HoldingService.getYahooSymbol(el.symbol);
								// Assign symbol-specific data to the holding
								el.lastTradedPrice =
									quotes[yahooSymbol].price.regularMarketPrice;
								// Return the market cap of the stock in scale of 10M
								let marketCap = quotes[yahooSymbol].price.marketCap / 10000000;
								el.marketCapSection =
									HoldingService.getMarketCapSection(marketCap);
								el.industry = industryName[el.symbol];
								el.currentValue = +(
									el.totalQuantity * el.lastTradedPrice
								).toFixed(2);
								el.profitLoss = +(el.currentValue - el.investedAmount).toFixed(
									2
								);
								el.profitLossPercentage = +(
									(el.profitLoss / el.investedAmount) *
									100
								).toFixed(2);
								// Update the overview object
								overview.investedAmount += el.investedAmount;
								overview.currentValue += el.currentValue;
								// Add the symbolInfo for the pie charts of marketCap and industry
								chartData = HoldingService.addSymbolInfoToChartData(
									chartData,
									['marketCapSection', 'industry'],
									[el.marketCapSection, el.industry],
									el.symbol,
									el.investedAmount
								);
							}
						}
					}
				);
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
		await yahooFinance.quote(
			{
				symbol: yahooSymbol,
				modules: ['summaryProfile', 'financialData', 'price', 'summaryDetail'],
			},
			function (err: Error, quotes: any) {
				if (err) {
					console.log(err);
				} else {
					data = quotes;
					holding.lastTradedPrice = quotes.price.regularMarketPrice;
					// Return the market cap of the stock in scale of 10M
					let marketCap = quotes.price.marketCap / 10000000;
					holding.marketCapSection =
						HoldingService.getMarketCapSection(marketCap);
					if (quotes.summaryProfile) {
						holding.industry = industryName[symbol];
					}
				}
			}
		);
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
}
