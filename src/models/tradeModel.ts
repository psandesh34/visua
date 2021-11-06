import { model, Schema, Model, Document } from "mongoose";

const TradeSchema: Schema = new Schema({
  _id: String,
  // tradeId: {
  //   type: String,
  //   required: true,
  //   unique: true
  // },
  tradeType: {
    type: String,
    required: true,
  },
  tradeDate: {
    type: Date,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  }
});

export const Trade: Model<any> = model("Trade", TradeSchema);
