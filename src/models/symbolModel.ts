import { model, Schema, Model, Document } from "mongoose";

const SymbolSchema: Schema = new Schema({
  _id: String,
  userId: {
    type: String,
    required: true,
  },
  symbol: {
    type: String, //TCS
    required: true,
  },
  trades: [{ type: String, ref: "Trade" }], //6184c3ba00f50de18cc3d033
  averagePrice: {
    type: Number,
  },
  totalQuantity: {
    type: Number,
  },
  firstPurchaseDate: {
    type: Date,
  },
  lastTradedPrice: {
    type: Number,
  },
  marketCap: {
    type: Number,
  },
});

export const SymbolCode: Model<any> = model("Symbol", SymbolSchema);
