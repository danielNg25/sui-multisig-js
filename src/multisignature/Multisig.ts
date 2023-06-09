import {
    JsonRpcProvider,
    SignedTransaction,
    SuiAddress,
    TransactionBlock,
    fromB64,
} from '@mysten/sui.js';
import { execSync } from 'child_process';
import { MultisigKeypair } from './MultisigKeypair';

export class Multisig {
    public provider: JsonRpcProvider;
    public multisigAddress: SuiAddress;
    public threshold: number;
    private keypairs: MultisigKeypair[];
    private constructPhrase: string;

    constructor(
        provider: JsonRpcProvider,
        keypairs: MultisigKeypair[],
        threshold: number
    ) {
        this.provider = provider;
        this.keypairs = keypairs;
        this.threshold = threshold;

        const pubkeyList = keypairs
            .map((multisigPublicKey) => multisigPublicKey.rawPublicKey)
            .join(' ');

        const weightList = keypairs
            .map((multisigPublicKey) => multisigPublicKey.weight.toString())
            .join(' ');

        this.constructPhrase = ` --pks ${pubkeyList} --weights ${weightList} --threshold ${threshold} `;
        const result = execSync(
            `sui keytool multi-sig-address ${this.constructPhrase}`,
            { encoding: 'utf-8' }
        );

        this.multisigAddress = result.split(' ')[2].split('\n')[0];
    }

    public buildUnsignedTransaction = async (
        tx: TransactionBlock
    ): Promise<Uint8Array> => {
        tx.setSender(this.multisigAddress);
        return await tx.build({ provider: this.provider });
    };

    public signTransaction = async (
        tx: TransactionBlock | Uint8Array | string,
        account: number | string // index | raw pubkey
    ): Promise<SignedTransaction> => {
        let keypair: MultisigKeypair;

        if (typeof tx === 'string') {
            tx = TransactionBlock.from(fromB64(tx));
        } else if (tx instanceof Uint8Array) {
            tx = TransactionBlock.from(tx);
        }

        if (typeof account === 'number') {
            keypair = this.keypairs[account];
        } else {
            const foundKeypair = this.keypairs.find(
                (keypair) => keypair.rawPublicKey === account
            );

            if (foundKeypair === undefined) {
                throw new Error('Account not found');
            }
            keypair = foundKeypair;
        }

        tx.setSender(this.multisigAddress);
        return await keypair.signTransactionBlock(tx, this.provider);
    };

    public combinePartialSignature = (
        signedTransactions: SignedTransaction[]
    ): string => {
        const transactionBlockBytes =
            signedTransactions[0].transactionBlockBytes;

        if (
            !signedTransactions.every(
                (signedTransaction) =>
                    signedTransaction.transactionBlockBytes ===
                    transactionBlockBytes
            )
        ) {
            throw new Error('Signatures not from the same transaction');
        }

        const signatures = signedTransactions.map(
            (signedTransaction) => signedTransaction.signature
        );

        const sigs = signatures.join(' ');
        const result = execSync(
            `sui keytool multi-sig-combine-partial-sig ${this.constructPhrase} --sigs ${sigs}`,
            { encoding: 'utf-8' }
        );

        return result.split('\n')[2].split(' ')[2].split('"')[1];
    };

    public executeMultisigTransaction = (
        unsignedTx: string,
        serializedMultisigTransaction: string
    ): string => {
        return execSync(
            `sui client execute-signed-tx --tx-bytes ${unsignedTx} --signatures ${serializedMultisigTransaction}`,
            {
                encoding: 'utf-8',
            }
        );
    };

    public combineAndExecuteMultisigTransaction = (
        signedTransactions: SignedTransaction[]
    ): string => {
        const combinedSignature =
            this.combinePartialSignature(signedTransactions);

        return this.executeMultisigTransaction(
            signedTransactions[0].transactionBlockBytes,
            combinedSignature
        );
    };
}
