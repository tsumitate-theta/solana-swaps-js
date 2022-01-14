// test only works in node
import * as fs from "fs";
import * as os from 'os';

import { Connection, Keypair, ParsedAccountData, PublicKey, Transaction } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SwapperType, TokenID } from "./types";
import { MINTS, DECIMALS } from "./mints";
import { MERCURIAL_USTv1_USDC_MARKET } from "./mercurial";
import invariant from "tiny-invariant";
import { SwapClient } from "./client";
import { ORCA_APT_USDC_MARKET, ORCA_BTC_USDC_MARKET, ORCA_ETH_USDC_MARKET, ORCA_FTT_USDC_MARKET, ORCA_MNDE_mSOL_MARKET, ORCA_mSOL_USDC_MARKET, ORCA_ORCA_USDC_MARKET, ORCA_PORT_USDC_MARKET, ORCA_pSOL_USDC_MARKET, ORCA_RAY_USDC_MARKET, ORCA_SBR_USDC_MARKET, ORCA_scnSOL_USDC_MARKET, ORCA_SLC_USDC_MARKET, ORCA_SLND_USDC_MARKET, ORCA_SOL_USDC_MARKET, ORCA_stSOL_USDC_MARKET, ORCA_USDT_USDC_MARKET, ORCA_weWETH_USDC_MARKET, ORCA_WOOF_USDC_MARKET, RAYDIUM_MER_USDC_MARKET, RAYDIUM_SLC_USDC_MARKET, RAYDIUM_SRM_USDC_MARKET, RAYDIUM_WOOF_USDC_MARKET, SABER_PAI_USDC_MARKET, SABER_USTv2_USDC_MARKET } from ".";

if(process.argv.length < 6) {
  console.log(`Usage: node ${process.argv[1]} privateKeyFile COIN buySell sellAmt`);
  console.log("privateKeyFile is the address of the private key json to use");
  console.log("COIN is one of BTC, ETH or SOL");
  console.log("buySell is buy or sell");
  process.exit();
}

const [, , fileStr, coin, buySell, sellAmt, buyAmt] = process.argv;

async function getAssociatedTokAcc(tokenId: TokenID, owner: PublicKey) : Promise<PublicKey> {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, MINTS[tokenId], owner);

}

const keyPairPath = process.env.KEYPAIR || `${os.homedir()}/.config/solana/id.json`;
const keypair = Keypair.fromSecretKey(new Uint8Array(
    JSON.parse(
        fs.readFileSync(keyPairPath, "utf8")
    )
));

const connection = new Connection(process.env.ENDPOINT_URL || "https://ssc-dao.genesysgo.net", "processed");

async function doSwap() {

  const client = SwapClient.load(connection, keypair);
  await client.prepare();
  
  const isBuy = buySell === "buy";

  const mainTokenType = {
    APT: TokenID.APT,
    BTC: TokenID.BTC,
    ETH: TokenID.ETH,
    SOL: TokenID.SOL,
    mSOL: TokenID.mSOL,
    USDT: TokenID.USDT,
    UST: TokenID.UST,
    SBR: TokenID.SBR,
    ORCA: TokenID.ORCA,
    RAY: TokenID.RAY,
    USTv2: TokenID.USTv2,
    MNDE: TokenID.MNDE,
    SRM: TokenID.SRM,
    FTT: TokenID.FTT,
    MER: TokenID.MER,
    PORT: TokenID.PORT,
    weWETH: TokenID.weWETH,
    PAI: TokenID.PAI,
    pSOL: TokenID.pSOL,
    SLND: TokenID.SLND,
    stSOL: TokenID.stSOL,
    scnSOL: TokenID.scnSOL,
    SLC: TokenID.SLC,
    WOOF: TokenID.WOOF
  }[coin];
  invariant(mainTokenType);

  const mainTokenAcc = client.getTokenAccount(mainTokenType);
  invariant(mainTokenAcc);

  const getSwapper = {
    APT: () => ORCA_APT_USDC_MARKET,
    BTC: ()=> ORCA_BTC_USDC_MARKET,
    ETH: ()=> ORCA_ETH_USDC_MARKET,
    SOL: ()=> ORCA_SOL_USDC_MARKET,
    mSOL: ()=> ORCA_mSOL_USDC_MARKET,
    USDT: ()=> ORCA_USDT_USDC_MARKET,
    UST: ()=> MERCURIAL_USTv1_USDC_MARKET,
    SBR: ()=> ORCA_SBR_USDC_MARKET,
    ORCA: ()=> ORCA_ORCA_USDC_MARKET,
    RAY: ()=> ORCA_RAY_USDC_MARKET,
    USTv2: () => SABER_USTv2_USDC_MARKET,
    MNDE: ()=> ORCA_MNDE_mSOL_MARKET,
    FTT: () => ORCA_FTT_USDC_MARKET ,
    SRM: () => RAYDIUM_SRM_USDC_MARKET,
    MER: () => RAYDIUM_MER_USDC_MARKET,
    PORT: () => ORCA_PORT_USDC_MARKET,
    weWETH: () => ORCA_weWETH_USDC_MARKET,
    PAI: () => SABER_PAI_USDC_MARKET,
    pSOL: () => ORCA_pSOL_USDC_MARKET,
    SLND: () => ORCA_SLND_USDC_MARKET,
    stSOL: () => ORCA_stSOL_USDC_MARKET,
    scnSOL: () => ORCA_scnSOL_USDC_MARKET,
    SLC: () => RAYDIUM_SLC_USDC_MARKET,
    WOOF: () => ORCA_WOOF_USDC_MARKET,
  }[coin];
  invariant(getSwapper);
  const swapper = getSwapper();

  const tokenBAcc = client.getTokenAccount(swapper.tokenIdB);
  invariant(tokenBAcc);

  const buyTokenID = isBuy ? mainTokenType : swapper.tokenIdB;
  const buyTokenAcc = isBuy ? mainTokenAcc : tokenBAcc;
  const sellTokenID = isBuy ? swapper.tokenIdB : mainTokenType;
  const sellTokenAcc = isBuy ? tokenBAcc : mainTokenAcc;

  console.log(`sellAmt:${sellAmt}, buyAmt:${buyAmt}`);

  const parsedBuyBeforeAmt = ((await connection.getParsedAccountInfo(buyTokenAcc, 'confirmed')).value?.data as ParsedAccountData).parsed.info.tokenAmount.uiAmount;
  console.log(sellTokenAcc.toString());
  const tradeIxs = await swapper.createSwapInstructions(
    sellTokenID,
    parseFloat(sellAmt) * DECIMALS[sellTokenID],
    sellTokenAcc,

    buyTokenID,
    parseFloat(buyAmt) * DECIMALS[buyTokenID],
    buyTokenAcc,

    keypair.publicKey
  );

  const tradeTx = new Transaction();
  tradeIxs.forEach(ix=>tradeTx.add(ix));

  const sig = await connection.sendTransaction(tradeTx, [keypair], {preflightCommitment: 'confirmed'});
  await connection.confirmTransaction(sig, 'confirmed');

  const parsedBuyAfterAmt = ((await connection.getParsedAccountInfo(buyTokenAcc, 'confirmed')).value?.data as ParsedAccountData).parsed.info.tokenAmount.uiAmount;

  console.log(sig);
  console.log(`Received ${parsedBuyAfterAmt - parsedBuyBeforeAmt}`);
  console.log("DONE");
  process.exit();
}

doSwap();
