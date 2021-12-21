import csv from 'csv-parser';
import fs from 'fs';
import yahooFinance from 'yahoo-finance';
import { Trade } from '../models/tradeModel';
import { Portfolio } from '../models/portfolioModel';
import { Holding } from '../models/holdingModel';
import { NSE } from '../shared/constants';
import { ApiError } from '../shared/services';
import holdingService from './holdingService';
import tradeService from './tradeService';
import { getSymbol } from '../shared/helper';

export default class portfolioService {
	/*
	 * import the tradebook from uploaded CSV. Sample tradebook can be found in the root directory(smallTradebook.csv)
	 * @param {string} fileName - uploaded CSV file name
	 * @param {string} userId - user id (Multiple users be implemented later)
	 * @returns {message: string} - message to be displayed to the user
	 */
	public static async importPortfolio(fileName: string, userId: string) {
		const tradesArray = [];
		const holdingsObject = {};
		const holdingsArray = [];
		fs.createReadStream(`uploads/${fileName}`)
			.pipe(csv())
			.on('data', async (data) => {
				data.quantity = +parseInt(data.quantity);
				data.price = +parseFloat(data.price).toFixed(2);
				// get the available (NSE/BSE)symbol, remove any suffixes
				data.symbol = await getSymbol(data.symbol);
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
				if (holdingsObject.hasOwnProperty(data.symbol)) {
					// averagePrice can only change if the tradeType is a buy
					if (data.trade_type === 'buy') {
						holdingsObject[data.symbol].averagePrice = +(
							(data.quantity * data.price +
								holdingsObject[data.symbol].averagePrice *
									holdingsObject[data.symbol].totalQuantity) /
							(data.quantity + holdingsObject[data.symbol].totalQuantity)
						).toFixed(2);
					}
					if (data.trade_type === 'sell') {
						data.quantity = -data.quantity;
					}
					holdingsObject[data.symbol].totalQuantity += data.quantity;
					holdingsObject[data.symbol].trades.push(trade._id);
					// if totalQuantity==0, make averagePrice 0
					if (holdingsObject[data.symbol].totalQuantity === 0) {
						holdingsObject[data.symbol].averagePrice = 0;
					}
				} else {
					holdingsObject[data.symbol] = {
						userId: userId,
						firstPurchaseDate: data.order_execution_time,
						totalQuantity: data.quantity,
						averagePrice: data.price,
						trades: [data.trade_id],
					};
				}
			})
			.on('end', async () => {
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
					uploads: [fileName],
				});
			});
		return { message: 'Started tradebook import.' };
	}

	public static async deletePortfolio(userId: string) {
		// todo: implement mongoose transactions or pre-hooks
		const result = await Portfolio.findOne({ userId })
			.select('holdings')
			.lean();
		if (!result)
			throw new ApiError('notFoundError', 404, 'Portfolio not found');
		await tradeService.deleteTrades(userId);
		await holdingService.deleteHoldings(result.holdings);
		const deleteResult = await Portfolio.deleteOne({ userId }).lean();
		return { message: 'Portfolio deleted successfully', result: deleteResult };
	}
}
