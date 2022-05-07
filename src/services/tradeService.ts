import { Trade } from '../models/tradeModel';

export default class TradeService {
    public static async deleteTrades(userId: string) {
        //todo:  Add a check if userId exists once userId table is added.
        const result = await Trade.deleteMany({ userId });
        return result;
    }

    // create trade
    public static async createTrade(trade: any) {
        const result = await Trade.create(trade);
        return result;
    }

    //get running sum of invested amount for a user by tradeDate
    public static async getRunningSumOfInvestedAmount(userId: string) {
        //This works but 1. not taking sell trades in account, 2. this apprach will subtract the sellingPrice from totalInvestedAmount
        // instead of substracting the buyingPrice from totalInvestedAmount
        // To avoid this, we need to store the buying Price in the trade table when tradeType=='sell'
        const result = await Trade.aggregate([
            {
                $group: {
                    _id: { time: '$tradeDate' },
                    value: { $sum: { $multiply: ['$price', '$quantity'] } },
                },
            },
            { $addFields: { _id: '$_id.time' } },
            { $sort: { _id: 1 } },
            { $group: { _id: null, data: { $push: '$$ROOT' } } },
            {
                $addFields: {
                    data: {
                        $reduce: {
                            input: '$data',
                            initialValue: { total: 0, d: [] },
                            in: {
                                total: { $sum: ['$$this.value', '$$value.total'] },
                                d: {
                                    $concatArrays: [
                                        '$$value.d',
                                        [
                                            {
                                                _id: '$$this._id',
                                                value: '$$this.value',
                                                runningTotal: {
                                                    $sum: ['$$value.total', '$$this.value'],
                                                },
                                            },
                                        ],
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            { $unwind: '$data.d' },
            { $replaceRoot: { newRoot: '$data.d' } },
        ]);
        return result;
    }

    // get all trades for the symbol and userId provided
    public static async getSymbolTrades(userId: string, symbol: string) {
        const result = await Trade.find(
            { userId, symbol },
            {
                _id: 0,
                __v: 0,
                orderExecutionTime: 0,
                symbol: 0,
                userId: 0,
                segment: 0,
            }
        );
        return result;
    }
}
