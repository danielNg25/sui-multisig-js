import {
    PublicKey,
    Keypair,
    Ed25519Keypair,
    Ed25519PublicKey,
    Secp256k1Keypair,
    Secp256k1PublicKey,
    SignatureScheme,
    fromB64,
    toB64,
    JsonRpcProvider,
    RawSigner,
    TransactionBlock,
    SignedTransaction,
} from '@mysten/sui.js';

export class MultisigKeypair {
    public rawPublicKey: string;
    public publicKey: PublicKey;
    public weight: number;
    private keypair?: Keypair;

    constructor(
        rawPublicKey: string,
        publicKey: PublicKey,
        weight: number,
        keypair?: Keypair
    ) {
        this.rawPublicKey = rawPublicKey;
        this.publicKey = publicKey;
        this.weight = weight;
        this.keypair = keypair;
    }

    static fromSerializedPubkey = (
        schema: SignatureScheme,
        pubkey: string,
        weight: number
    ): MultisigKeypair => {
        let publicKey: PublicKey;
        if (schema === 'ED25519') {
            publicKey = new Ed25519PublicKey(fromB64(pubkey).slice(1));
        } else {
            publicKey = new Secp256k1PublicKey(fromB64(pubkey).slice(1));
        }
        return new MultisigKeypair(pubkey, publicKey, weight);
    };

    static fromSerializedPrivatekey = (
        schema: SignatureScheme,
        privatekey: string,
        weight: number
    ): MultisigKeypair => {
        let keypair: Keypair;
        if (schema === 'ED25519') {
            keypair = Ed25519Keypair.fromSecretKey(
                fromB64(privatekey).slice(1)
            );
        } else {
            keypair = Secp256k1Keypair.fromSecretKey(
                fromB64(privatekey).slice(1)
            );
        }
        const publicKey = keypair.getPublicKey();
        const rawPublicKey = publicKeyToRawPublicKey(publicKey);
        return new MultisigKeypair(rawPublicKey, publicKey, weight, keypair);
    };

    static fromKeypair = (
        keypair: Keypair,
        weight: number
    ): MultisigKeypair => {
        const publicKey = keypair.getPublicKey();
        const rawPublicKey = publicKeyToRawPublicKey(publicKey);
        return new MultisigKeypair(rawPublicKey, publicKey, weight, keypair);
    };

    hasKeypair = (): boolean => {
        return this.keypair !== undefined;
    };

    signTransactionBlock = async (
        tx: TransactionBlock,
        provider: JsonRpcProvider
    ): Promise<SignedTransaction> => {
        if (!this.hasKeypair()) {
            throw new Error('Secret key not provided');
        }
        const signer = new RawSigner(this.keypair!, provider);
        return signer.signTransactionBlock({ transactionBlock: tx });
    };
}

const publicKeyToRawPublicKey = (publicKey: PublicKey): string => {
    const zeroArray = new Uint8Array([0]);
    const publicKeyBytes = publicKey.toBytes();
    const rawPublicKeyBytes = new Uint8Array([...zeroArray, ...publicKeyBytes]);
    return toB64(rawPublicKeyBytes);
};
