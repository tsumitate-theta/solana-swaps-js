import { Token, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SimulatedTransactionResponse, Transaction } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { DECIMALS, MINTS, TokenID } from ".";
import { SwapInfo } from "./AMMMarket";
import { DecimalUtil, U64Utils } from "./utils";

export class SwapClient {

    wallets: Map<TokenID, PublicKey>;

    constructor(
        public connection: Connection,
        public keypair: Keypair
    ) {
        this.wallets = new Map();
    }

    static load(
        connection: Connection,
        keypair: Keypair,
    ) {
        const client = new SwapClient(connection, keypair);
        // TODO
        return client;
    }

    async checkOrCreateAssociatedTokenAccount(tokenId: TokenID) {
        const mint = MINTS[tokenId];
        const acc = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mint,
            this.keypair.publicKey
        );

        this.wallets.set(tokenId, acc);

        const accInfo = await this.connection.getAccountInfo(acc);
        if (accInfo) {
            // good
            console.log(`Token account for ${tokenId} exists`);
        }
        else {
            console.log(`Token account for ${tokenId} being created...`);
            // create it and init
            const createIx = Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                mint,
                acc,
                this.keypair.publicKey,
                this.keypair.publicKey
            );
            const tx = new Transaction().add(createIx);
            const sig = await this.connection.sendTransaction(tx, [this.keypair]);
            this.connection.confirmTransaction(sig);
        }
    }

    async prepare() {
        await Promise.all(Object.entries(TokenID).map(([str, tokenId]) => {
            return this.checkOrCreateAssociatedTokenAccount(tokenId);
        }));
    }

    async doArb(buyInfo: SwapInfo, sellInfo: SwapInfo) {
        // this.wallets.forEach((value, key) => {
        //     console.log(`${key}: ${value.toString()}`);
        // });
        console.log(`buy rate:${buyInfo.rate}`);
        console.log(`sell rate:${sellInfo.rate}`);


        console.log(`${sellInfo.market.dexname}, inPoolAmount: ${sellInfo.inPoolAmount}, outPoolAmount: ${sellInfo.outPoolAmount}`);

        const buyTradeValue = DecimalUtil.fromU64(buyInfo.inputTradeAmount, DECIMALS[buyInfo.market.tokenIdB]);
        const sellTradeValue = DecimalUtil.fromU64(sellInfo.inputTradeAmount, DECIMALS[buyInfo.market.tokenIdA]).mul(sellInfo.price);

        const isSellMin = sellTradeValue.lt(buyTradeValue);

        let minInputAmount, minInputAmountU64, minOutputAmountU64, resultOutputAmount, resultOutputAmountU64;

        if (isSellMin) {
            
            minOutputAmountU64 = sellInfo.inputTradeAmount;

            resultOutputAmount = DecimalUtil.fromU64(sellInfo.minimumOutputAmount, DECIMALS[buyInfo.market.tokenIdB]);
            resultOutputAmountU64 = sellInfo.minimumOutputAmount;

            minInputAmount = DecimalUtil.fromU64(resultOutputAmountU64, DECIMALS[buyInfo.market.tokenIdB]).div(new Decimal(1.002))
            minInputAmountU64 = DecimalUtil.toU64(minInputAmount, DECIMALS[buyInfo.market.tokenIdB]);
        } else {
            minInputAmount = DecimalUtil.fromU64(buyInfo.inputTradeAmount, DECIMALS[buyInfo.market.tokenIdB]);
            minInputAmountU64 = buyInfo.inputTradeAmount;

            minOutputAmountU64 = buyInfo.minimumOutputAmount;

            resultOutputAmount = DecimalUtil.fromU64(minInputAmountU64, DECIMALS[buyInfo.market.tokenIdB]).mul(new Decimal(1.002));
            resultOutputAmountU64 = DecimalUtil.toU64(resultOutputAmount, DECIMALS[buyInfo.market.tokenIdB]);
        }

        // const minInputAmount = Decimal.min(buyTradeValue, sellTradeValue);
        console.log(`buyInput:${buyInfo.inputTradeAmount}, price:${buyInfo.price}, buyTradeValue:${buyTradeValue}`);
        console.log(`sellInput:${sellInfo.inputTradeAmount},  price:${sellInfo.price}, sellTradeValue:${sellTradeValue}`);


        console.log(`isSellMin: ${isSellMin}`);
        console.log(`minInputAmount: ${minInputAmount}`);
        console.log(`minInputAmountU64: ${minInputAmountU64}`);

        console.log(`minOutputAmountU64: ${minOutputAmountU64}`);

        // const resultOutputAmount = minInputAmount.mul(new Decimal(1.002));
        // const resultOutputAmountU64 = DecimalUtil.toU64(resultOutputAmount, DECIMALS[buyInfo.market.tokenIdB]);
        console.log(`resultOutputAmount: ${resultOutputAmount}`);
        console.log(`resultOutputAmountU64: ${resultOutputAmountU64}`);


        const tokenBAccount = this.wallets.get(buyInfo.market.tokenIdB);
        const tokenAAccount = this.wallets.get(buyInfo.market.tokenIdA);
        invariant(tokenBAccount);
        invariant(tokenAAccount);

        // buyInfo.market.getMinimumAmountOut(
        //     buyInfo.
        // )

        // console.log(`sellTokenAccount:${sellTokenAccount.toString()}`);
        // console.log(`buyTokenAccount:${buyTokenAccount.toString()}`);

        const buyIx = (await buyInfo.market.createSwapInstructions(
            buyInfo.market.tokenIdB,
            minInputAmountU64.toNumber(),
            tokenBAccount,

            buyInfo.market.tokenIdA,
            minOutputAmountU64.toNumber(),
            tokenAAccount,

            this.keypair.publicKey
        ))[0];

        // sell instruction
        const sellIx = (await sellInfo.market.createSwapInstructions(
            sellInfo.market.tokenIdA,
            minOutputAmountU64.toNumber(),
            tokenAAccount,

            sellInfo.market.tokenIdB,
            resultOutputAmountU64.toNumber(),
            tokenBAccount,

            this.keypair.publicKey
        ))[0];

        // send transaction
        const tx = new Transaction();
        tx.add(buyIx);
        tx.add(sellIx);


        let simulateResult: SimulatedTransactionResponse | null = null;
        try {
            simulateResult = (
                await this.connection.simulateTransaction(tx, [this.keypair])
            ).value;
        } catch (e) {
            console.warn('Simulate transaction failed');
        }

        if (simulateResult) {
            if (simulateResult.logs) {
                for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
                    const line = simulateResult.logs[i];
                    console.log(line);
                }
            }
            if (simulateResult.err) {
                console.log(`${JSON.stringify(simulateResult.err)}`);
            }
        }

        // const sig = await this.connection.sendTransaction(tx, [this.keypair], { preflightCommitment: 'processed' });
        // await this.connection.confirmTransaction(sig);
    }
}