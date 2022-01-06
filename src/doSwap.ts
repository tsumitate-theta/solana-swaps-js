// test only works in node
import * as fs from "fs";
import { RAYDIUM_SRM_USDC_MARKET, RAYDIUM_MER_USDC_MARKET } from "./raydium";
import { ORCA_MNDE_mSOL_MARKET, ORCA_ORCA_USDC_MARKET, ORCA_SBR_USDC_MARKET, ORCA_USDT_USDC_MARKET, ORCA_FTT_USDC_MARKET, ORCA_pSOL_USDC_MARKET, ORCA_weWETH_USDC_MARKET, ORCA_BTC_USDC_MARKET, ORCA_ETH_USDC_MARKET, ORCA_mSOL_USDC_MARKET, ORCA_PORT_USDC_MARKET, ORCA_RAY_USDC_MARKET, ORCA_SOL_USDC_MARKET, ORCA_APT_USDC_MARKET, ORCA_scnSOL_USDC_MARKET, ORCA_SLND_USDC_MARKET, ORCA_stSOL_USDC_MARKET } from "./orca"
import { SABER_PAI_USDC_MARKET, SABER_USTv2_USDC_MARKET } from './saber';
import { Connection, Keypair, ParsedAccountData, PublicKey, Transaction } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SwapperType, TokenID } from "./types";
import { MINTS, DECIMALS } from "./mints";
import { MERCURIAL_USTv1_USDC_MARKET } from "./mercurial";
import invariant from "tiny-invariant";

if(process.argv.length < 6) {
  console.log(`Usage: node ${process.argv[1]} privateKeyFile COIN buySell sellAmt`);
  console.log("privateKeyFile is the address of the private key json to use");
  console.log("COIN is one of BTC, ETH or SOL");
  console.log("buySell is buy or sell");
  process.exit();
}

const [, , fileStr, coin, buySell, sellAmt, buyAmt] = process.argv;

// export async function getOwnedTokenAccounts(
//   connection:Connection,
//   owner: PublicKey
// ): Promise<PublicKey[]> {
//   const accounts = await connection.getProgramAccounts(
//     TOKEN_PROGRAM_ID,
//     {
//       filters: [
//         {
//           memcmp: {
//             offset: AccountLayout.offsetOf('owner'),
//             bytes: owner.toBase58(),
//           },
//         },
//         {
//           dataSize: AccountLayout.span,
//         },
//       ],
//     },
//   );
//   return accounts.map((r: any) => {
//     console.log(JSON.stringify(r, null, 2));
//     return r.pubkey;
//   });
// }

// async function createAssociatedTokAcc(connection: Connection, keypair:Keypair, tokenId: TokenID, aTokenAddr: PublicKey) {
//   console.log(`Creating token account for ${tokenId}:${MINTS[tokenId]}, ${aTokenAddr.toBase58()}`);
//   const ix = Token.createAssociatedTokenAccountInstruction(
//         ASSOCIATED_TOKEN_PROGRAM_ID,
//         TOKEN_PROGRAM_ID,
//         MINTS[tokenId],
//         aTokenAddr,
//         keypair.publicKey,
//         keypair.publicKey,
//       );
//   const tx = new Transaction();
//   tx.add(ix);
//   const sig = await connection.sendTransaction(tx, [keypair], {preflightCommitment: 'confirmed'});
//   await connection.confirmTransaction(sig, 'confirmed');
// }

async function getAssociatedTokAcc(tokenId: TokenID, owner: PublicKey) : Promise<PublicKey> {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, MINTS[tokenId], owner);

}

// async function getOrAssociatedTokAcc(connection: Connection, tokenId: TokenID, keypair:Keypair) : Promise<PublicKey> {
//   const ownedAccounts = await  getOwnedTokenAccounts(connection, keypair.publicKey);
//   const tokenAccount = await getAssociatedTokAcc(tokenId, keypair.publicKey);

//   ownedAccounts.forEach((a) => {
//     console.log(`${a}`);
//   });
  
//   if (ownedAccounts.some((p) => {p.equals(tokenAccount)})) {
//     return tokenAccount
//   } 
//   await createAssociatedTokAcc(connection, keypair, tokenId, tokenAccount);
//   return tokenAccount;
// }

async function doSwap() {
  const keyStr = fs.readFileSync(fileStr, "utf8");
  const privateKey = JSON.parse(keyStr);
  const keypair = Keypair.fromSecretKey(new Uint8Array(privateKey));

    //const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  // const conn = new Connection("https://lokidfxnwlabdq.main.genesysgo.net:8899/", "confirmed");
  const conn = new Connection("https://192.168.1.50:10899", "confirmed");

  const aptTokenAccount = await getAssociatedTokAcc(TokenID.APT, keypair.publicKey);
  const btcTokenAccount = await getAssociatedTokAcc(TokenID.BTC, keypair.publicKey);
  const ethTokenAccount =  await getAssociatedTokAcc(TokenID.ETH, keypair.publicKey); 
  const solTokenAccount = await getAssociatedTokAcc(TokenID.SOL, keypair.publicKey);
  const msolTokenAccount = await getAssociatedTokAcc(TokenID.mSOL, keypair.publicKey);
  const usdcTokenAccount = await getAssociatedTokAcc(TokenID.USDC, keypair.publicKey);
  const usdtTokenAccount = await getAssociatedTokAcc(TokenID.USDT, keypair.publicKey);
  const ustTokenAccount = await getAssociatedTokAcc(TokenID.UST, keypair.publicKey);
  const sbrTokenAccount = await getAssociatedTokAcc(TokenID.SBR, keypair.publicKey);
  const orcaTokenAccount = await getAssociatedTokAcc(TokenID.ORCA, keypair.publicKey);
  const rayTokenAccount = await getAssociatedTokAcc(TokenID.RAY, keypair.publicKey);
  const ustv2TokenAccount = await getAssociatedTokAcc(TokenID.USTv2, keypair.publicKey);
  const mndeTokenAccount = await getAssociatedTokAcc(TokenID.MNDE, keypair.publicKey);
  const fttTokenAccount = await getAssociatedTokAcc(TokenID.FTT, keypair.publicKey);
  const srmTokenAccount = await getAssociatedTokAcc(TokenID.SRM, keypair.publicKey);
  const merTokenAccount = await getAssociatedTokAcc(TokenID.MER, keypair.publicKey);
  const portTokenAccount = await getAssociatedTokAcc(TokenID.PORT, keypair.publicKey);
  const wewethTokenAccount = await getAssociatedTokAcc(TokenID.weWETH, keypair.publicKey);
  const paiTokenAccount = await getAssociatedTokAcc(TokenID.PAI, keypair.publicKey);
  const psolTokenAccount = await getAssociatedTokAcc(TokenID.pSOL, keypair.publicKey);
  const slndTokenAccount = await getAssociatedTokAcc(TokenID.SLND, keypair.publicKey);
  const stsolTokenAccount = await getAssociatedTokAcc(TokenID.stSOL, keypair.publicKey);
  const scnsolTokenAccount = await getAssociatedTokAcc(TokenID.scnSOL, keypair.publicKey);
  


  
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
  }[coin];
  invariant(mainTokenType);

  const tokenAccounts: Record<TokenID, PublicKey | undefined> = {
    APT: aptTokenAccount,
    USDC: usdcTokenAccount,
    BTC: btcTokenAccount,
    ETH: ethTokenAccount,
    SOL: solTokenAccount,
    mSOL: msolTokenAccount,
    USDT: usdtTokenAccount,
    UST: ustTokenAccount,
    SBR: sbrTokenAccount,
    ORCA: orcaTokenAccount,
    RAY: rayTokenAccount,
    USTv2: ustv2TokenAccount,
    MNDE: mndeTokenAccount,
    SRM: srmTokenAccount,
    PAI: paiTokenAccount,
    FTT: fttTokenAccount,
    MER: merTokenAccount,
    PORT: portTokenAccount,
    weWETH: wewethTokenAccount,
    pSOL: psolTokenAccount,
    SLND: slndTokenAccount,
    stSOL: stsolTokenAccount,
    scnSOL: scnsolTokenAccount,
  }
  const mainTokenAcc = tokenAccounts[mainTokenType];
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
  }[coin];
  invariant(getSwapper);
  const swapper = getSwapper();

  const tokenBAcc = tokenAccounts[swapper.tokenIdB]
  invariant(tokenBAcc);

  const buyTokenID = isBuy ? mainTokenType : swapper.tokenIdB;
  const buyTokenAcc = isBuy ? mainTokenAcc : tokenBAcc;
  const sellTokenID = isBuy ? swapper.tokenIdB : mainTokenType;
  const sellTokenAcc = isBuy ? tokenBAcc : mainTokenAcc;

  const swapperType = {
    APT: SwapperType.Single,
    BTC: SwapperType.Single,
    ETH: SwapperType.Single,
    SOL: SwapperType.Single,
    mSOL: SwapperType.Single,
    USDT: SwapperType.Single,
    UST: SwapperType.Single,
    SBR: SwapperType.Single,
    ORCA: SwapperType.Single,
    RAY: SwapperType.Single,
    USTv2: SwapperType.Single,
    MNDE: SwapperType.Single,
    FTT: SwapperType.Single,
    SRM: SwapperType.Single,
    MER: SwapperType.Single,
    PORT: SwapperType.Single,
    weWETH: SwapperType.Single,
    PAI: SwapperType.Single,
    pSOL: SwapperType.Single,
    SLND: SwapperType.Single,
    stSOL: SwapperType.Single,
    scnSOL: SwapperType.Single,
  }[coin];
  invariant(swapperType);

  console.log(`sellAmt:${sellAmt}, buyAmt:${buyAmt}`);

  const parsedBuyBeforeAmt = ((await conn.getParsedAccountInfo(buyTokenAcc, 'confirmed')).value?.data as ParsedAccountData).parsed.info.tokenAmount.uiAmount;
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

  const sig = await conn.sendTransaction(tradeTx, [keypair], {preflightCommitment: 'confirmed'});
  await conn.confirmTransaction(sig, 'confirmed');

  const parsedBuyAfterAmt = ((await conn.getParsedAccountInfo(buyTokenAcc, 'confirmed')).value?.data as ParsedAccountData).parsed.info.tokenAmount.uiAmount;

  console.log(sig);
  console.log(`Received ${parsedBuyAfterAmt - parsedBuyBeforeAmt}`);
  console.log("DONE");
  process.exit();
}

doSwap();
