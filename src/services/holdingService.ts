import yahooFinance from 'yahoo-finance';
import { Holding } from '../models/holdingModel';

export default class HoldingService {
	public static async deleteHoldings(holdingIds: string[]) {
		const result = await Holding.deleteMany({ id: { $in: holdingIds } });
		return result;
	}

	// get holdings bu userId
	public static async getHoldings(userId: string) {
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
		]);
		if (holdings?.length > 0) {
			// '.NS' refers to the symbol prefix for NSE in yahoo finance
			// const symbols = portfolio.holdings.map((symbol) => symbol.symbol + '.NS');
			const symbols = [];
			for (let i = 0; i < holdings.length; i++) {
				symbols.push(holdings[i].symbol + '.NS');
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
								const yahooSymbol = el.symbol + '.NS';
								el.lastTradedPrice =
									quotes[yahooSymbol].price.regularMarketPrice;
								// Return the market cap of the stock in scale of 10M
								let marketCap = quotes[yahooSymbol].price.marketCap / 10000000;
								el.sector = quotes[yahooSymbol].summaryProfile.sector;
								el.industry = quotes[yahooSymbol].summaryProfile.industry;
								if (marketCap < 5000) {
									el.marketCapSection = 'Small cap';
								} else if (marketCap < 20000) {
									el.marketCapSection = 'Mid cap';
								} else {
									el.marketCapSection = 'Large cap';
								}
							});
						}
					}
				);
			}
		}
		return holdings;
	}

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
}
