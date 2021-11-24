import { Holding } from "../models/holdingModel";

export async function deleteHoldings(holdingIds: string[]) {
  const result = await Holding.deleteMany({ id: { $in: holdingIds } });
  return result;
}

// get holdings bu userId
export async function getHoldings(userId: string) {
  const result = await Holding.find({
    userId,
    totalQuantity: { $gt: 0 },
  }).lean();
  return result;
}
