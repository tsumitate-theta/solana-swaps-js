import { u64 } from "@solana/spl-token";
import { Connection, Keypair } from "@solana/web3.js";
import { RAYDIUM_BTC_USDC_MARKET, RAYDIUM_ETH_USDC_MARKET, RAYDIUM_SBR_USDC_MARKET, RAYDIUM_SLC_USDC_MARKET, RAYDIUM_WOOF_USDC_MARKET } from ".";
import { ORCA_BTC_USDC_MARKET, ORCA_ETH_USDC_MARKET, ORCA_SBR_USDC_MARKET, ORCA_SLC_USDC_MARKET, ORCA_WOOF_USDC_MARKET } from "./orca";
import * as fs from "fs";
import * as os from 'os';
import { SwapClient } from "./client";
import { SwapInfo } from "./AMMMarket";
import Decimal from "decimal.js";
import { sleep } from "./utils/utils";

const interval = process.env.INTERVAL || 1000;
const keyPairPath = process.env.KEYPAIR || `${os.homedir()}/.config/solana/id.json`;
const keypair = Keypair.fromSecretKey(new Uint8Array(
    JSON.parse(
        fs.readFileSync(keyPairPath, "utf8")
    )
));

const connection = new Connection(process.env.ENDPOINT_URL || "https://ssc-dao.genesysgo.net", "confirmed");

const ARB_MARKETS = [
    [ORCA_BTC_USDC_MARKET, RAYDIUM_BTC_USDC_MARKET],
    [ORCA_SBR_USDC_MARKET, RAYDIUM_SBR_USDC_MARKET],
    [ORCA_SLC_USDC_MARKET, RAYDIUM_SLC_USDC_MARKET],
    [ORCA_WOOF_USDC_MARKET, RAYDIUM_WOOF_USDC_MARKET],
];



async function runArbtrage() {
    const client = SwapClient.load(connection, keypair);
    await client.prepare();

    // const markets = [ORCA_SLC_USDC_MARKET, RAYDIUM_SLC_USDC_MARKET];
    // await RAYDIUM_SLC_USDC_MARKET.loadMarket(connection);

    // const markets = [ORCA_SBR_USDC_MARKET, RAYDIUM_SBR_USDC_MARKET];
    // await RAYDIUM_SBR_USDC_MARKET.loadMarket(connection);

    // await Promise.all(
    //     ARB_MARKETS.flat().map((market) => {
    //         if ('loadMarket' in market) {
    //             return market.loadMarket(connection);
    //         }
    //     })
    // );

    while (true) {

        console.time(`loop`);

        for ( const arb_markets of ARB_MARKETS) {
            await checkMarket(connection, arb_markets, client);
        }

        console.timeEnd(`loop`);

        await sleep(interval);

    }
};

async function checkMarket(connection: Connection, arb_markets, client: SwapClient) {

    const buyInfos: SwapInfo[] = [];
    const sellInfos: SwapInfo[] = [];

    for (const market of arb_markets) {
        const { buyInfo, sellInfo } = await market.getSwapInfos(connection, 1);
        buyInfos.push(buyInfo);
        sellInfos.push(sellInfo);


        // console.log(`${buyInfo.market.dexname} Buy ${buyInfo.market.name} ${buyInfo.price}, ${buyInfo.expectedOutputAmount}`);
        // console.log(`${sellInfo.market.dexname} Sell ${sellInfo.market.name} ${sellInfo.price}, ${sellInfo.expectedOutputAmount}`);
    }

    buyInfos.forEach((buyInfo) => {
        sellInfos.forEach(async (sellInfo) => {
            const ratio = buyInfo.rate.mul(sellInfo.rate);

            if (ratio.gt(new Decimal(1.001))) {
                console.log(`buy:${buyInfo.market.dexname}(${buyInfo.rate}) -> sell:${sellInfo.market.dexname}(${sellInfo.rate}), ratio:${ratio}`);
            }

            if (ratio.gt(new Decimal(1.001))) {
                console.log(`lets arb!!! buy:${buyInfo.market.dexname} -> sell:${sellInfo.market.dexname}, ratio:${ratio}`);

                try {
                    await client.doArb(buyInfo, sellInfo);
                } catch (e) {
                    console.log(`Arb Swap Error: ${e}`);
                }
                
            }
        })
    })
}

async function runSwapInfo() {
    const client = SwapClient.load(connection, keypair);
    await client.prepare();

    const market = RAYDIUM_SLC_USDC_MARKET;
    // const market = RAYDIUM_WOOF_USDC_MARKET
    const { buyInfo,  } = await ORCA_WOOF_USDC_MARKET.getSwapInfos(connection, 1);

    console.log(`buyInfo`);
    console.log(`inPoolAmount: ${buyInfo.inPoolAmount}`);
    console.log(`outPoolAmount: ${buyInfo.outPoolAmount}`);

    console.log(`${buyInfo.inputTradeAmount}`);
    console.log(`${buyInfo.noSlippageOutputAmount}`);
    console.log(`${buyInfo.expectedOutputAmount}`);

    console.log(`${buyInfo.rate}`);
    console.log(`${buyInfo.price}`);

    console.log(`${buyInfo.priceImpact}`);
    console.log(`${buyInfo.slippage}`);


    const { sellInfo,  } = await RAYDIUM_WOOF_USDC_MARKET.getSwapInfos(connection, 1);
    console.log(`sellInfo`);

    console.log(`inPoolAmount: ${sellInfo.inPoolAmount}`);
    console.log(`outPoolAmount: ${sellInfo.outPoolAmount}`);
    
    console.log(`${sellInfo.inputTradeAmount}`);
    console.log(`${sellInfo.noSlippageOutputAmount}`);
    console.log(`${sellInfo.expectedOutputAmount}`);

    console.log(`${sellInfo.rate}`);
    console.log(`${sellInfo.price}`);

    console.log(`${sellInfo.priceImpact}`);
    console.log(`${sellInfo.slippage}`);

    await client.doArb(buyInfo, sellInfo);
}

function replacer(key, value) {
    console.log("key:[" + key + "]\t type:[" + (typeof value) + "]\tvalue:[" + value + "]");
    return value;
}

// runSwapInfo();


runArbtrage();