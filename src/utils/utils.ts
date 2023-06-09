import { SignedTransaction } from '@mysten/sui.js';

export const signedTransactionFromString = (
    singedTransactionString: string
): SignedTransaction => {
    return JSON.parse(singedTransactionString);
};
