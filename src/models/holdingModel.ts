import { model, Schema, Model, Document } from "mongoose";

const holdingSchema = new Schema({
    symbol: String,
    averagePrice: Number,
    totalQuantity: Number,
    firstPurchaseDate: Date
});

export const Holding: Model<any> = model("Holding", holdingSchema);
