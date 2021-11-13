import { Holding } from "../models/holdingModel";

export async function deleteHoldings(holdingIds: string[]) {
    const result = await Holding.deleteMany({ id: { $in: holdingIds } });
    return result;
}