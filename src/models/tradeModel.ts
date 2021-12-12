import { model, Schema, Model, Document } from 'mongoose';

const TradeSchema: Schema = new Schema<tradeInterface>({
	_id: String,
	userId: {
		type: String,
		ref: 'User',
		required: [true, 'Why no userId?'],
		index: true,
	},
	symbol: { type: String, required: [true, 'Why no symbol?'] },
	exchange: { type: String, default: 'NSE' },
	segment: { type: String, default: 'EQ' },
	tradeType: { type: String, required: [true, 'Why no tradeType?'] },
	quantity: { type: Number, required: [true, 'Why no quantity?'] },
	price: { type: Number, required: [true, 'Why no price?'] },
	tradeDate: { type: Date, required: [true, 'Why no date?'], index: true },
	orderExecutionTime: { type: Date },
});

export interface tradeInterface extends Document {
	userId: string;
	symbol: string;
	exchange: string;
	segment: string;
	tradeType: string;
	quantity: number;
	price: number;
	tradeDate: Date;
	orderExecutionTime: Date;
}

export const Trade: Model<tradeInterface> = model('Trade', TradeSchema);
