import { model, Schema, Model, Document, SchemaDefinition } from 'mongoose';

export interface holdingInterface extends Document {
    userId: string;
    symbol: string;
    trades: string[];
    holdingsHistory: [
        {
            date: Date;
            totalQuantity: number;
            averagePrice: number;
        }
    ];
}

const holdingUpdatesSchema = new Schema({
    date: {
        type: Date,
        required: true,
    },
    totalQuantity: {
        type: Number,
        required: true,
    },
    averagePrice: {
        type: Number,
        required: true,
    },
    isSellTrade: {
        type: Boolean,
        required: true,
    },
    remainingQuantity: {
        type: Number,
        required: true
    },
    buyPrice: {
        type: Number
    }
}, { _id: false });

const holdingSchema = new Schema({
    symbol: String,
    userId: String,
    trades: [String],
    holdingsUpdates: [
        holdingUpdatesSchema
    ]
});

export const Holding: Model<any> = model('Holding', holdingSchema);
