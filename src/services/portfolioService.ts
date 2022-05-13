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
                // No need to execute further if quantity is 0
                if (data.quantity < 0) continue;
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

                    if (data.trade_type === 'buy') {
                        const newAverage =
                            (currentAverage * currentQuantity + data.price * data.quantity) /
                            (currentQuantity + data.quantity);
                        const newQuantity = currentQuantity + data.quantity;
                        holdingsObject[data.symbol].holdingsUpdates.push({
                            date: new Date(data.trade_date),
                            buyPrice: data.price,
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
                        let subtractedInvestment = 0;
                        const lastHoldingUpdate = holdingsObject[data.symbol].holdingsUpdates[holdingsObject[data.symbol].holdingsUpdates.length - 1];
                        const originalRemainingQuantities: number[] = holdingsObject[data.symbol].holdingsUpdates
                            .map(update => update.remainingQuantity);
                        const originalAveragePrices: number[] = holdingsObject[data.symbol].holdingsUpdates
                            .map(update => update.averagePrice);
                        let lastBuyRemainingQty: number;
                        let lastBuyAveragePrice: number;
                        let isAllQuantitySold = false;
                        for (
                            let i = 0;
                            i < holdingsObject[data.symbol].holdingsUpdates.length;
                            i++
                        ) {
                            const currentHoldingUpdate = holdingsObject[data.symbol].holdingsUpdates[i];
                            if (quantityToSubtract === 0) {
                                // We only want to execute below code one time once everything is sold.
                                if(!isAllQuantitySold) {
                                    // Update the averagePrice only if this not the last holding update(there are more buy trades after this)
                                    if (
                                        i + 1 < holdingsObject[data.symbol].holdingsUpdates.length &&
                                        !currentHoldingUpdate.isSellTrade
                                    ) {
                                        newAverage =
                                        Math.abs(
                                            (lastBuyAveragePrice * lastBuyRemainingQty) - subtractedInvestment) /
                                            (originalRemainingQuantities[originalRemainingQuantities.length - 1] - subtractedQuantity);
                                    }
                                    isAllQuantitySold = true
                                }
                            } else if (!currentHoldingUpdate.isSellTrade) {
                                const CurrentRemainingQuantity = currentHoldingUpdate.remainingQuantity;
                                if (quantityToSubtract > CurrentRemainingQuantity) {
                                    quantityToSubtract -= CurrentRemainingQuantity;
                                    subtractedQuantity = CurrentRemainingQuantity;
                                }
                                else {
                                    subtractedQuantity = quantityToSubtract;
                                    quantityToSubtract = 0;
                                    // If this is the last element of holdingsUpdates, average will be the buying price the stock.
                                    // If this is not the last element, it will be caught in first if condition of this for loop.
                                    newAverage = currentHoldingUpdate.buyPrice;
                                }
                                subtractedInvestment += subtractedQuantity * currentHoldingUpdate.buyPrice;
                            }

                            for(let j = i; j < holdingsObject[data.symbol].holdingsUpdates.length; j++) {
                                // Dont subtract again if everything has been sold.
                                if(!isAllQuantitySold){
                                    lastBuyAveragePrice = holdingsObject[data.symbol].holdingsUpdates[j].averagePrice;
                                    lastBuyRemainingQty = holdingsObject[data.symbol].holdingsUpdates[j].remainingQuantity;
                                    holdingsObject[data.symbol].holdingsUpdates[j].remainingQuantity -= subtractedQuantity;
                                }
                            }
                        }
                        const newQuantity = lastHoldingUpdate.remainingQuantity;

                        holdingsObject[data.symbol].holdingsUpdates.push({
                            date: new Date(data.trade_date),
                            averagePrice: newAverage,
                            totalQuantity: newQuantity,
                            remainingQuantity: newQuantity,
                            isSellTrade: true,
                        });
                    }

                    holdingsObject[data.symbol].trades.push(tradeId);
                } else {
                    // First trade should always be a buy trade.
                    if(data.trade_type === 'buy') {
                        holdingsObject[data.symbol] = {
                            userId: userId,
                            totalQuantity: data.quantity,
                            averagePrice: data.price,
                            trades: [tradeId],
                            holdingsUpdates: [
                                {
                                    date: data.trade_date,
                                    buyPrice: data.price,
                                    averagePrice: data.price,
                                    totalQuantity: data.quantity,
                                    remainingQuantity: data.quantity,
                                    isSellTrade: false,
                                },
                            ],
                        };
                    }
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
