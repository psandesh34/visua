import { model, Schema, Model } from "mongoose";

// export interface TradebookInterface extends Document {
//   userId: string;
//   tradebook: [
//     {
//       symbol: string;
//       trades: [
//         {
//           tradeType: string;
//           tradeDate: Date;
//           quantity: number;
//           price: number;
//           tradeId: string;
//         }
//       ];
//       averagePrice: number;
//       totalQuantity: number;
//       currentMarketPrice: number;
//     }
//   ];
// }

const TradebookSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  symbols: [{ type: Schema.Types.ObjectId, ref: "Symbol" }],
});

export const Tradebook: Model<any> = model("Tradebook", TradebookSchema);
