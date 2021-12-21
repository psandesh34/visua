import { NSE } from './constants';

export async function getSymbol(symbol: string) {
  //Add more suffixes here
	if (symbol.slice(-3) === '-BE') symbol = symbol.slice(0, -3);
	symbol = NSE[symbol] || symbol;
	if (NSE[symbol] && NSE[symbol] != 'None') symbol = NSE[symbol];
	return symbol;
}
