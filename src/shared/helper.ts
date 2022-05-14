import mongoose from "mongoose";
import { NSE } from "./constants";

export async function getSymbol(symbol: string) {
    let nseSymbol = symbol;
    // Add more suffixes here
    if (symbol.slice(-3) === "-BE") nseSymbol = symbol.slice(0, -3);
    nseSymbol = NSE[symbol] || symbol;
    if (NSE[symbol] && NSE[symbol] !== "None") nseSymbol = NSE[symbol];
    return nseSymbol;
}

export function generateObjectId() {
    return new mongoose.Types.ObjectId();
}
