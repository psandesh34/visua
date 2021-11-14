import { Trade } from "../models/tradeModel";

export async function deleteTrades(userId: string) {
    //todo:  Add a check if userId exists once userId table is added.
    const result = await Trade.deleteMany({ userId });
    return result;
}