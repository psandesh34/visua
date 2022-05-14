import { model, Schema, Model } from "mongoose";

const PortfolioSchema: Schema = new Schema({
    userId: {
        type: String,
        // Users to be stored in a separate collection later(after implementing login)
        // ref: "User",
        unique: true,
        index: true,
    },
    holdings: [{ type: Schema.Types.ObjectId, ref: "Holding" }],
    invested: {
        String,
        default: 0,
    },
    // Uploaded files can be stored in the database later. For now, we just store the file name.
    uploads: [{ type: String }],
});

export interface portfolioInterface {
    userId: string;
    holdings: string[];
    invested: number;
    uploads: string[];
}

export const Portfolio: Model<any> = model("Portfolio", PortfolioSchema);
