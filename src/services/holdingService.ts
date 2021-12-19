import { AnyArray } from 'mongoose';
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
	public static async getHoldings(userId: string) {
		const chartData = {
			marketCapSection: {},
			industry: {},
		};
		const overview = {
			investedAmount: 0,
			currentValue: 0,
			profitLoss: 0,
			profitLossPercentage: 0,
		};
		const holdings = await Holding.aggregate([
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
			{ $sort: { investedAmount: -1 } },
		]);
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
							holdings.forEach((el: any) => {
								const yahooSymbol = HoldingService.getYahooSymbol(el.symbol);
								el.lastTradedPrice =
									quotes[yahooSymbol].price.regularMarketPrice;
								// Return the market cap of the stock in scale of 10M
								let marketCap = quotes[yahooSymbol].price.marketCap / 10000000;
								if (marketCap < 5000) {
									el.marketCapSection = 'Small cap';
								} else if (marketCap < 20000) {
									el.marketCapSection = 'Mid cap';
								} else {
									el.marketCapSection = 'Large cap';
								}
								el.industry = industryName[el.symbol];
								el.currentValue = +(
									el.totalQuantity * el.lastTradedPrice
								).toFixed(2);
								el.profitLoss = +(el.currentValue - el.investedAmount).toFixed(
									2
								);
								el.profitLossPercentage = +(
									((el.currentValue - el.investedAmount) / el.investedAmount) *
									100
								).toFixed(2);
								overview.investedAmount += el.investedAmount;
								overview.currentValue += el.currentValue;
								if (
									chartData.marketCapSection.hasOwnProperty(el.marketCapSection)
								) {
									chartData.marketCapSection[
										el.marketCapSection
									].totalInvestedAmount += el.investedAmount;
									chartData.marketCapSection[el.marketCapSection].data.push(
										el.investedAmount
									);
									chartData.marketCapSection[el.marketCapSection].labels.push(
										el.symbol
									);
								} else {
									chartData.marketCapSection[el.marketCapSection] = {
										totalInvestedAmount: el.investedAmount,
										data: [el.investedAmount],
										labels: [el.symbol],
									};
								}
								if (chartData.industry.hasOwnProperty(el.industry)) {
									chartData.industry[el.industry].totalInvestedAmount +=
										el.investedAmount;
									chartData.industry[el.industry].data.push(el.investedAmount);
									chartData.industry[el.industry].labels.push(el.symbol);
								} else {
									chartData.industry[el.industry] = {
										totalInvestedAmount: el.investedAmount,
										data: [el.investedAmount],
										labels: [el.symbol],
									};
								}
							});
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
		overview.profitLossPercentage = +(
			((overview.currentValue - overview.investedAmount) /
				overview.investedAmount) *
			100
		).toFixed(2) || 0;
		return { holdings, chartData, overview };
	}

	/* Get overview of holdings by userId.
	 * @param {string} userId - user id
	 * @returns userId - user id & totalInvestedAmount
	 */
	public static async getHoldingsOverview(userId: string) {
		const overview = await Holding.aggregate([
			{
				$match: {
					userId,
					totalQuantity: { $gt: 0 },
				},
			},
			{
				$group: {
					_id: { userId },
					totalInvestedAmount: {
						$sum: {
							$multiply: ['$averagePrice', '$totalQuantity'],
						},
					},
				},
			},
		]);
		//Will contain only one element because of the group by clause
		return overview[0];
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
					if (marketCap < 5000) {
						holding.marketCapSection = 'Small cap';
					} else if (marketCap < 20000) {
						holding.marketCapSection = 'Mid cap';
					} else {
						holding.marketCapSection = 'Large cap';
					}
					if (quotes.summaryProfile) {
						holding.industry = industryName[symbol];
					}
				}
			}
		);
		return { holding, data };
	}

	public static getYahooSymbol(symbol: string) {
		if (NSE[symbol] && NSE[symbol] === 'None') {
			symbol = symbol + '.BO';
		} else {
			symbol = symbol + '.NS';
		}
		return symbol;
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
