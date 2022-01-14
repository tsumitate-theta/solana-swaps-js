import { Market } from "@project-serum/serum";
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

    getTokenAccount(tokenId: TokenID) {
        return this.wallets.get(tokenId);
    }

    async doArb(buyInfo: SwapInfo, sellInfo: SwapInfo) {
        // this.wallets.forEach((value, key) => {
        //     console.log(`${key}: ${value.toString()}`);
        // });
        // console.log(`buy rate:${buyInfo.rate}`);
        // console.log(`sell rate:${sellInfo.rate}`);

        // console.log(`${buyInfo.market.dexname}, inPoolAmount: ${buyInfo.inPoolAmount}, outPoolAmount: ${buyInfo.outPoolAmount}`);
        // console.log(`${sellInfo.market.dexname}, inPoolAmount: ${sellInfo.inPoolAmount}, outPoolAmount: ${sellInfo.outPoolAmount}`);

        const buyTradeValue = DecimalUtil.fromU64(buyInfo.inputTradeAmount, DECIMALS[buyInfo.market.tokenIdB]);
        const sellTradeValue = DecimalUtil.fromU64(sellInfo.inputTradeAmount, DECIMALS[sellInfo.market.tokenIdA]).mul(sellInfo.price);

        const isSellMin = sellTradeValue.lt(buyTradeValue);

        let minInputAmount, minInputAmountU64, minOutputAmountU64, resultOutputAmount, resultOutputAmountU64;

        if (isSellMin) {

            // buyのoutputをsellのinput量に調整する
            minOutputAmountU64 = sellInfo.inputTradeAmount;

            // 最終アウトプットは期待値に設定する
            resultOutputAmountU64 = sellInfo.expectedOutputAmount;

            // 最終アウトプットのUI量を計算
            resultOutputAmount = DecimalUtil.fromU64(sellInfo.expectedOutputAmount, DECIMALS[buyInfo.market.tokenIdB]);

            // 最終アウトプット量から初期インプット量を逆算する。控えめに0.1%の利益でよしとする
            // minInputAmount = DecimalUtil.fromU64(resultOutputAmountU64, DECIMALS[buyInfo.market.tokenIdB]).div(new Decimal(1.001));

            // buyInfoのrateで初期インプット量を逆算する
            minInputAmount = DecimalUtil.fromU64(minOutputAmountU64, DECIMALS[buyInfo.market.tokenIdA]).div(buyInfo.rate.mul(new Decimal(0.9995)));

            // 初期インプット料のUI量を計算する
            minInputAmountU64 = DecimalUtil.toU64(minInputAmount, DECIMALS[buyInfo.market.tokenIdB]);
        } else { // buyトレードの方が価値が小さい場合


            // buyInfoのインプット量をそのままインプットに設定する
            minInputAmountU64 = buyInfo.inputTradeAmount;

            // インプットのUI値を計算しておく
            minInputAmount = DecimalUtil.fromU64(buyInfo.inputTradeAmount, DECIMALS[buyInfo.market.tokenIdB]);

            // buyトレードの期待値をアウトプットに設定する
            minOutputAmountU64 = buyInfo.expectedOutputAmount;

            // 初期インプット量から最終アウトプット料を計算する。控えめに0.1%の利益でよしとする
            // resultOutputAmount = DecimalUtil.fromU64(minInputAmountU64, DECIMALS[buyInfo.market.tokenIdB]).mul(new Decimal(1.001));

            // sellInfoのrateで最終アウトプットを計算する
            resultOutputAmount = DecimalUtil.fromU64(minOutputAmountU64, DECIMALS[buyInfo.market.tokenIdA]).mul(sellInfo.rate.mul(new Decimal(0.9995)));

            // 最終アウトプットのUI値を計算する
            resultOutputAmountU64 = DecimalUtil.toU64(resultOutputAmount, DECIMALS[buyInfo.market.tokenIdB]);
        }

        // console.log(`buyInput:${buyInfo.inputTradeAmount}, price:${buyInfo.price}, buyTradeValue:${buyTradeValue}`);
        // console.log(`sellInput:${sellInfo.inputTradeAmount},  price:${sellInfo.price}, sellTradeValue:${sellTradeValue}`);


        console.log(`isSellMin: ${isSellMin}`);
        // console.log(`minInputAmount: ${minInputAmount}`);
        console.log(`minInputAmountU64: ${minInputAmountU64}`);

        console.log(`minOutputAmountU64: ${minOutputAmountU64}`);

        // console.log(`resultOutputAmount: ${resultOutputAmount}`);
        console.log(`resultOutputAmountU64: ${resultOutputAmountU64}`);

        console.log(`return: ${resultOutputAmount.div(minInputAmount)}`);


        const tokenBAccount = this.wallets.get(buyInfo.market.tokenIdB);
        const tokenAAccount = this.wallets.get(buyInfo.market.tokenIdA);
        invariant(tokenBAccount);
        invariant(tokenAAccount);

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


        // let simulateResult: SimulatedTransactionResponse | null = null;
        // try {
        //     simulateResult = (
        //         await this.connection.simulateTransaction(tx, [this.keypair])
        //     ).value;
        // } catch (e) {
        //     console.warn('Simulate transaction failed');
        // }

        // if (simulateResult) {
        //     if (simulateResult.logs) {
        //         for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
        //             const line = simulateResult.logs[i];
        //             console.log(line);
        //         }
        //     }
        //     if (simulateResult.err) {
        //         console.log(`${JSON.stringify(simulateResult.err)}`);
        //     }
        // }

        const sig = await this.connection.sendTransaction(tx, [this.keypair], { preflightCommitment: 'processed' });
        console.log(`transaction send: ${sig}`);
        this.connection.confirmTransaction(sig)
            .then((result) => {
                console.log(`${sig} sucess!!!`);
            });

    }
}