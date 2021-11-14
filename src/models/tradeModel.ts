import { model, Schema, Model, Document } from "mongoose";

const TradeSchema: Schema = new Schema({
  _id: String,
  userId: {
    type: String,
    ref: "User",
    required: true,
  },
  symbol: { type: String, required: true },
  exchange: { type: String, required: true },
  segment: { type: String, required: true },
  tradeType: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

export const Trade: Model<any> = model("Trade", TradeSchema);
