import { model, Schema, Model, Document } from "mongoose";

const OrderSchema: Schema = new Schema({
  _id: String,
  userId: {
    type: String,
    ref: "User",
    required: true,
  },
  symbol: { type: String, required: true },
  exchange: { type: String, required: true },
  segment: { type: String, required: true },
  series: { type: String, required: true },
  orderType: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

export const Order: Model<any> = model("Order", OrderSchema);
