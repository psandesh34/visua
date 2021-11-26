import { model, Schema, Model, Document } from "mongoose";

const holdingSchema = new Schema({
    symbol: String,
    userId: String,
    averagePrice: Number,
    totalQuantity: {
        type: Number,
        default: 0,
        index: true
    },
    firstPurchaseDate: Date
});

export const Holding: Model<any> = model("Holding", holdingSchema);
