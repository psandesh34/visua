import fs from 'fs';
import { Trade } from '../models/tradeModel';
import { Portfolio } from '../models/portfolioModel';
import { Holding } from '../models/holdingModel';
import { ApiError } from '../shared/services';
import holdingService from './holdingService';
import tradeService from './tradeService';
import { generateObjectId, getSymbol } from '../shared/helper';
import { parse } from 'csv-parse';
// import { parse } from 'csv-parse/lib/sync';

export default class portfolioService {
    /*
     * import the tradebook from uploaded CSV. Sample tradebook can be found in the root directory(smallTradebook.csv)
     * @param {string} fileName - uploaded CSV file name
     * @param {string} userId - user id (Multiple users be implemented later)
     * @returns {message: string} - message to be displayed to the user
     */
    public static async importPortfolio(fileName: string, userId: string) {
        const tradesArray = [];
        const holdingsObject: Record<string, any> = {};
        const holdingsArray = [];
        var parser = parse({ columns: true }, async function (err, records) {
            for (const data of records) {
                const tradeId = generateObjectId();
                data.quantity = +parseInt(data.quantity);
                data.price = +parseFloat(data.price).toFixed(2);
                // get the available (NSE/BSE)symbol, remove any suffixes
                data.symbol = await getSymbol(data.symbol);
                const trade = new Trade({
                    _id: tradeId,
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
                    // Get the array length here and use it to calculate averga price and total queantitiy
                    const updatesArrayLength: number =
                        holdingsObject[data.symbol].holdingsUpdates.length;
                    const currentQuantity =
                        holdingsObject[data.symbol].holdingsUpdates[updatesArrayLength - 1]
                            .totalQuantity;
                    const currentAverage =
                        holdingsObject[data.symbol].holdingsUpdates[updatesArrayLength - 1]
                            .averagePrice;
                    // if totalQuantity==0, make averagePrice 0. See if this is required anywhere
                    // holdingsObject[data.symbol].holdingsUpdates.push({
                    // 	date: data.trade_date,
                    // 	averagePrice: data.price,
                    // 	quantity: data.quantity,
                    // });

                    // if (currentQuantity === 0) {
                    // 	holdingsObject[data.symbol].averagePrice = 0;
                    // } else {
                    if (data.trade_type === 'buy') {
                        const newAverage =
                            (currentAverage * currentQuantity + data.price * data.quantity) /
                            (currentQuantity + data.quantity);
                        // holdingsObject[data.symbol].averagePrice = newAverage;
                        const newQuantity = currentQuantity + data.quantity;
                        holdingsObject[data.symbol].holdingsUpdates.push({
                            date: new Date(data.trade_date),
                            averagePrice: newAverage,
                            totalQuantity: newQuantity,
                            remainingQuantity: newQuantity,
                            isSellTrade: false,
                        });
                    } else {
                        // sell trade
                        let newAverage = 0;
                        let quantityToSubtract = data.quantity;
                        let subtractedQuantity = 0;
                        data.quantity = -data.quantity;
                        let quantityAfterSelling = 0;
                        let alreadySubtractedQuantity = 0;
                        for (
                            let i = 0;
                            i < holdingsObject[data.symbol].holdingsUpdates.length;
                            i++
                        ) {
                            if (quantityToSubtract === 0) {
                                break;
                            }
                            if (!holdingsObject[data.symbol].holdingsUpdates[i].isSellTrade) {
                                if (
                                    holdingsObject[data.symbol].holdingsUpdates[i]
                                        .remainingQuantity < (quantityToSubtract + alreadySubtractedQuantity)
                                ) {
                                    quantityToSubtract = quantityToSubtract -
                                        holdingsObject[data.symbol].holdingsUpdates[i]
                                            .remainingQuantity + alreadySubtractedQuantity;
                                    alreadySubtractedQuantity +=
                                        holdingsObject[data.symbol].holdingsUpdates[i]
                                            .remainingQuantity;
                                    subtractedQuantity =
                                        holdingsObject[data.symbol].holdingsUpdates[i]
                                            .remainingQuantity;
                                    holdingsObject[data.symbol].holdingsUpdates[
                                        i
                                    ].remainingQuantity = 0;
                                } else {
                                    holdingsObject[data.symbol].holdingsUpdates[
                                        i
                                    ].remainingQuantity =
                                        holdingsObject[data.symbol].holdingsUpdates[i]
                                            .remainingQuantity -
                                        quantityToSubtract -
                                        alreadySubtractedQuantity;
                                    quantityAfterSelling =
                                        holdingsObject[data.symbol].holdingsUpdates[i]
                                            .remainingQuantity;
                                    subtractedQuantity =
                                        quantityToSubtract + alreadySubtractedQuantity;
                                    quantityToSubtract = 0;
                                }
                            }
                            // Check if holdingsUpdates has more but trades next. If this is the last trade, then averagePrice will not change
                            if (i + 1 < holdingsObject[data.symbol].holdingsUpdates.length) {
                                newAverage =
                                    (currentAverage * currentQuantity -
                                        holdingsObject[data.symbol].holdingsUpdates[i]
                                            .averagePrice *
                                            subtractedQuantity) /
                                    (currentQuantity - subtractedQuantity);
                            }
                        }
                        // currentQuantity is becoming undefined for some reason, please check
                        const newQuantity = quantityAfterSelling;
                        // holdingsObject[data.symbol].averagePrice = newQuantity? newAverage: 0;
                        holdingsObject[data.symbol].holdingsUpdates.push({
                            date: new Date(data.trade_date),
                            averagePrice: newQuantity ? newAverage : 0,
                            totalQuantity: newQuantity,
                            isSellTrade: true,
                        });
                    }

                    // holdingsObject[data.symbol].totalQuantity += data.quantity;
                    holdingsObject[data.symbol].trades.push(tradeId);
                    // }
                } else {
                    holdingsObject[data.symbol] = {
                        userId: userId,
                        totalQuantity: data.quantity,
                        averagePrice: data.price,
                        trades: [tradeId],
                        holdingsUpdates: [
                            {
                                date: data.trade_date,
                                averagePrice: data.price,
                                totalQuantity: data.quantity,
                                remainingQuantity: data.quantity,
                                isSellTrade: false,
                            },
                        ],
                    };
                }
            }
            setTimeout(() => {}, 5000);
            for (const symbol in holdingsObject) {
                let hobj = new Holding();
                hobj.userId = holdingsObject[symbol].userId;
                hobj.symbol = symbol;
                hobj.totalQuantity = holdingsObject[symbol].totalQuantity;
                hobj.averagePrice = holdingsObject[symbol].averagePrice;
                hobj.trades = holdingsObject[symbol].trades;

                hobj.holdingsUpdates = holdingsObject[symbol].holdingsUpdates;
                holdingsArray.push(hobj);
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
        fs.createReadStream(`uploads/${fileName}`).pipe(parser);
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
