import { u64 } from "@solana/spl-token";
import { Connection, Keypair } from "@solana/web3.js";
import { RAYDIUM_ETH_USDC_MARKET, RAYDIUM_SBR_USDC_MARKET } from ".";
import { ORCA_ETH_USDC_MARKET, ORCA_SBR_USDC_MARKET } from "./orca";
import * as fs from "fs";
import * as os from 'os';
import { SwapClient } from "./client";
import { SwapInfo } from "./AMMMarket";
import Decimal from "decimal.js";

const keyPairPath = process.env.KEYPAIR || `${os.homedir()}/.config/solana/id.json`;
const keypair = Keypair.fromSecretKey(new Uint8Array(
    JSON.parse(
        fs.readFileSync(keyPairPath, "utf8")
    )
));

const connection = new Connection(process.env.ENDPOINT_URL || "https://ssc-dao.genesysgo.net", "confirmed");

async function getPrice() {
    const client = SwapClient.load(connection, keypair);
    await client.prepare();


    const inputTradeAmount = new u64(3918.275096 * 10 ** 6);

    const markets = [ORCA_ETH_USDC_MARKET, RAYDIUM_ETH_USDC_MARKET];
    await RAYDIUM_ETH_USDC_MARKET.loadMarket(connection);
    
    // const markets = [ORCA_SBR_USDC_MARKET, RAYDIUM_SBR_USDC_MARKET];
    // await RAYDIUM_SBR_USDC_MARKET.loadMarket(connection);

    const buyInfos: SwapInfo[] = [];
    const sellInfos: SwapInfo[] = [];
    for (const market of markets) {
        const { buyInfo, sellInfo } = await market.getSwapInfos(connection);
        buyInfos.push(buyInfo);
        sellInfos.push(sellInfo);
    }

    buyInfos.forEach((buyInfo) => {
        sellInfos.forEach((sellInfo) => {
            const ratio = buyInfo.rate.mul(sellInfo.rate);
            
            console.log(`buy:${buyInfo.market.dexname}(${buyInfo.rate}) -> sell:${sellInfo.market.dexname}(${sellInfo.rate}), ratio:${ratio}`);

            if (ratio.gt(new Decimal(1.002))) {
                console.log(`lets arb!!! buy:${buyInfo.market.dexname} -> sell:${sellInfo.market.dexname}, ratio:${ratio}`);

                client.doArb(buyInfo, sellInfo);
            }
        })
    })



};

getPrice();