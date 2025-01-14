import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { AccountLayout, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { Market, PairMarket, Swapper, TokenID } from "../types";
import { DECIMALS, MINTS } from "../mints";
import { SERUM_PROGRAM } from "../serum/serumConstants";
import { Parser } from "../utils/Parser";
import { AMMMarket, SwapInfo } from "../AMMMarket";
import { Market as SerumMarket, OpenOrders, Orderbook, parseInstructionErrorResponse } from '@project-serum/serum';
import BN from 'bn.js';
import Decimal from "decimal.js";
import { AMM_INFO_LAYOUT_V4, getMultipleAccounts } from "../utils/utils";

export const RAYDIUM_AMM_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

export class RaydiumMarket extends AMMMarket implements Swapper, PairMarket {
  mintA: PublicKey;
  mintB: PublicKey;

  market!: SerumMarket;
  dexname: string;
  swapFeeNumerator: number;
  swapFeeDenominator: number;

  INST_LAYOUT = new Parser()
    .u8("cmd")
    .u64("in_amount")
    .u64("min_out_amount");
  constructor(
    name: string,
    public tokenIdA: TokenID,
    public tokenIdB: TokenID,
    public amm: PublicKey,
    public ammAuthority: PublicKey,
    public openOrders: PublicKey,
    public targetOrders: PublicKey,
    public raydiumVaultA: PublicKey,
    public raydiumVaultB: PublicKey,
    public serumMarket: PublicKey,
    public serumBids: PublicKey,
    public serumAsks: PublicKey,
    public serumEvents: PublicKey,
    public serumVaultA: PublicKey,
    public serumVaultB: PublicKey,
    public serumVaultSigner: PublicKey,
  ) {
    super(name, tokenIdA, tokenIdB, raydiumVaultA, raydiumVaultB);
    if (name !== `${tokenIdA}/${tokenIdB}`) {
      throw new Error("Incorrect name!");
    }
    this.mintA = MINTS[tokenIdA];
    this.mintB = MINTS[tokenIdB];
    this.dexname = "Raydium";

    this.swapFeeNumerator = 0;
    this.swapFeeDenominator = 0;

  }

  getSwapper(): Swapper {
    return this;
  }

  async createSwapInstructions(
    _fromToken: TokenID,
    fromAmount: number,
    fromTokenAccount: PublicKey,
    _toToken: TokenID,
    minToAmount: number,
    toTokenAccount: PublicKey,
    tradeOwner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const buffer = this.INST_LAYOUT.encode({
      cmd: 9,
      in_amount: fromAmount,
      min_out_amount: minToAmount
    });

    const ix = new TransactionInstruction({
      programId: RAYDIUM_AMM_PROGRAM,
      keys: [
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: this.amm, isSigner: false, isWritable: true },
        { pubkey: this.ammAuthority, isSigner: false, isWritable: false },
        { pubkey: this.openOrders, isSigner: false, isWritable: true },
        { pubkey: this.targetOrders, isSigner: false, isWritable: true },
        { pubkey: this.raydiumVaultA, isSigner: false, isWritable: true },
        { pubkey: this.raydiumVaultB, isSigner: false, isWritable: true },
        { pubkey: SERUM_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: this.serumMarket, isSigner: false, isWritable: true },
        { pubkey: this.serumBids, isSigner: false, isWritable: true },
        { pubkey: this.serumAsks, isSigner: false, isWritable: true },
        { pubkey: this.serumEvents, isSigner: false, isWritable: true },
        { pubkey: this.serumVaultA, isSigner: false, isWritable: true },
        { pubkey: this.serumVaultB, isSigner: false, isWritable: true },
        { pubkey: this.serumVaultSigner, isSigner: false, isWritable: false },
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tradeOwner, isSigner: true, isWritable: false },
      ],
      data: buffer,
    });

    return [ix];
  }

  getFeeNumerator(): number {
    return 25;
  }
  
  getFeeDenominator(): number {
    return 10000;
  }

  async loadMarket(connection: Connection) {
    console.time(`Market.load`);
    this.market = await SerumMarket.load(connection, this.serumMarket, {}, SERUM_PROGRAM);
    console.timeEnd(`Market.load`);
  }

  async getTokenCount(
    connection: Connection,
    side: "buy" | "sell" = "buy"
  ) {

    // トークンの数を取る
    const raws = await getMultipleAccounts(
      connection,
      [this.getInputVault(side), this.getOutputVault(side), this.amm, this.openOrders]
    );

    let needTakePnlCoin;
    let needTakePnlPc;

    let totalPnlCoin;
    let totalPnlPc;
    let baseTokenTotal, quoteTokenTotal;

    let pnlNumerator, pnlDenominator, swapFeeNumerator, swapFeeDenominator;

    const tokens = raws.map((raw) => {
      if (raw != undefined) {
        if (raw.publicKey.equals(this.amm)) {
          const accountInfo = AMM_INFO_LAYOUT_V4.decode(raw.accountInfo.data);
          needTakePnlCoin = accountInfo.needTakePnlCoin;
          needTakePnlPc = accountInfo.needTakePnlPc;
          totalPnlCoin = accountInfo.totalPnlCoin;
          totalPnlPc = accountInfo.totalPnlPc;
          pnlNumerator = accountInfo.pnlNumerator;
          pnlDenominator = accountInfo.pnlDenominator;
          this.swapFeeNumerator = accountInfo.swapFeeNumerator;
          this.swapFeeDenominator = accountInfo.swapFeeDenominator;
          // console.log(`amm\n${JSON.stringify(accountInfo, null, 2)}`);

        } else if (raw.publicKey.equals(this.openOrders)) {
          const accountInfo = OpenOrders.getLayout(SERUM_PROGRAM).decode(raw.accountInfo.data);
          baseTokenTotal = accountInfo.baseTokenTotal;
          quoteTokenTotal = accountInfo.quoteTokenTotal;
          
        } else {
          const accountInfo = AccountLayout.decode(raw.accountInfo.data);

          // console.log(`account\n${JSON.stringify(accountInfo, null, 2)}`);

          accountInfo.mint = new PublicKey(accountInfo.mint);
          accountInfo.owner = new PublicKey(accountInfo.owner);
          accountInfo.amount = u64.fromBuffer(accountInfo.amount);
          accountInfo.pubkey = raw.publicKey;
          return accountInfo;
        }

      } else {
        undefined;
      }
    });

    // console.log(`needTakePnlCoin: ${needTakePnlCoin}`);
    // console.log(`needTakePnlPc: ${needTakePnlPc}`);
    // console.log(`totalPnlCoin: ${totalPnlCoin}`);
    // console.log(`totalPnlPc: ${totalPnlPc}`);
    // console.log(`baseTokenTotal: ${baseTokenTotal}`);
    // console.log(`quoteTokenTotal: ${quoteTokenTotal}`);

    // console.log(`pnlNumerator: ${pnlNumerator}`);
    // console.log(`pnlDenominator: ${pnlDenominator}`);
    // console.log(`swapFeeNumerator: ${swapFeeNumerator}`);
    // console.log(`swapFeeDenominator: ${swapFeeDenominator}`);

    const inputTokenTake = side === "buy" ? needTakePnlPc : needTakePnlCoin;
    const outputTokenTake = side === "buy" ? needTakePnlCoin : needTakePnlPc;

    const inputTokenSerum = side === "buy" ? quoteTokenTotal : baseTokenTotal;
    const outputTokenSerum = side === "buy" ? baseTokenTotal : quoteTokenTotal;

    const inputTokenAccount = tokens.find((token) => this.getInputVault(side).equals(token.pubkey));
    const outputTokenAccount = tokens.find((token) => this.getOutputVault(side).equals(token.pubkey));

    if (inputTokenAccount === undefined || outputTokenAccount === undefined) {
      throw new Error("Unable to fetch accounts for specified tokens.");
    }

    const inPoolAmount = new u64(inputTokenAccount.amount.add(new u64(inputTokenSerum)).sub(new u64(inputTokenTake)));
    const outPoolAmount = new u64(outputTokenAccount.amount.add(new u64(outputTokenSerum)).sub(new u64(outputTokenTake)));

    // console.log(`inPoolAmount:${inPoolAmount}`);
    // console.log(`outPoolAmount:${outPoolAmount}`);

    return {
      inPoolAmount: inPoolAmount,
      outPoolAmount: outPoolAmount,
    };
  }

  async getSerumInfo(
    connection: Connection,
    inputTradeAmount = new u64(0),
    slippage = 1
  ) {



    // console.time(`orderbook load`);
    const accountInfos = await connection.getMultipleAccountsInfo([
      this.serumAsks,
      this.serumBids,
    ]);
    // console.timeEnd(`orderbook load`);


    const orderbooks = accountInfos.map((info) => {
      if (info != undefined) {
        const orderbook = Orderbook.decode(this.market, info.data);
        if (!orderbook) {
          console.log(`no order book data.`);
          return;
        }

        return orderbook;
      } else {
        undefined;
      }
    });

    const asks = orderbooks[0],
      bids = orderbooks[1];

    if (!asks || !bids) {
      return;
    }

    const serumBuyInfo = this.forecastBuy(asks, slippage);

    // console.log(`inputTradeAmount:${serumBuyInfo.inputTradeAmount}`);
    // console.log(`noSlippageOutputAmount:${serumBuyInfo.noSlippageOutputAmount}`);
    // console.log(`expectedOutputAmount:${serumBuyInfo.expectedOutputAmount}`);
    // console.log(`price:${serumBuyInfo.price}`);
    // console.log(`rate:${serumBuyInfo.rate}`);
    // console.log(`priceImpact:${serumBuyInfo.priceImpact}`);
    // console.log(`worstPrice:${serumBuyInfo.worstPrice}`);


    const serumSellInfo = this.forecastSell(bids, slippage);

    // console.log(`inputTradeAmount:${serumSellInfo.inputTradeAmount}`);
    // console.log(`noSlippageOutputAmount:${serumSellInfo.noSlippageOutputAmount}`);
    // console.log(`expectedOutputAmount:${serumSellInfo.expectedOutputAmount}`);
    // console.log(`price:${serumSellInfo.price}`);
    // console.log(`rate:${serumSellInfo.rate}`);
    // console.log(`priceImpact:${serumSellInfo.priceImpact}`);
    // console.log(`worstPrice:${serumSellInfo.worstPrice}`);

    return {
      buyInfo: serumBuyInfo,
      sellInfo: serumSellInfo
    };

  }

  forecastBuy(orderBook: Orderbook, slippage: number): SwapInfo {
    let coinOut = 0
    let bestPrice = 0
    let worstPrice = 0
    // let availablePc = pcIn
    let priceImpact = 0;
    let prePriceImpact = 0;
    let orderablePc = 0;
    let avgPrice = 0;

    let price, size: number;
    for ([price, size] of orderBook.getL2(1000)) {

      if (bestPrice === 0 && price !== 0) {
        bestPrice = price
      }

      if (avgPrice === 0 && price !== 0) {
        avgPrice = price
      }

      worstPrice = price
      const orderPcVaule = price * size
      prePriceImpact = (avgPrice - bestPrice) / bestPrice * 100
      // console.log(`price:${price}, size:${size}, coinOut:${coinOut}, orderValue:${orderPcVaule}, orderableValue:${orderablePc}, avgPrice:${avgPrice}, priceImpcat:${prePriceImpact}`);

      if (prePriceImpact > (slippage / 10)) {
        break;
      } else {
        priceImpact = prePriceImpact
        coinOut += size
        orderablePc += orderPcVaule
        avgPrice = orderablePc / coinOut;
      }

      // if (orderPcVaule >= availablePc) {
      //   coinOut += availablePc / price
      //   availablePc = 0
      //   break
      // } else {
      //   coinOut += size
      //   availablePc -= orderPcVaule
      // }
    }

    coinOut = coinOut * 0.993

    // console.log(`ask bestprice:${bestPrice}`);


    worstPrice = (worstPrice * (100 + slippage)) / 100
    const amountOutWithSlippage = (coinOut * (100 - slippage)) / 100
    const rate = coinOut / orderablePc;


    // const avgPrice = (pcIn - availablePc) / coinOut;
    // const maxInAllow = pcIn - availablePc

    return {
      market: this,
      inputTradeAmount: new u64(orderablePc * DECIMALS[this.tokenIdB]),
      noSlippageOutputAmount: new u64(coinOut * DECIMALS[this.tokenIdA]),
      expectedOutputAmount: new u64(amountOutWithSlippage * DECIMALS[this.tokenIdA]),
      price: new Decimal(avgPrice),
      rate: new Decimal(rate),
      priceImpact: new Decimal(priceImpact),
      // minimumOutputAmount: new u64(amountOutWithSlippage * DECIMALS[this.tokenIdA]),
    }
  }

  forecastSell(orderBook: Orderbook, slippage: number): SwapInfo {
    let pcOut = 0
    let bestPrice = 0
    let worstPrice = 0
    // let availableCoin = coinIn

    let coinIn = 0;
    let priceImpact = 0;
    let prePriceImpact = 0;
    let orderableValue = 0;
    let avgPrice = 0;

    let price, size: number;
    for ([price, size] of orderBook.getL2(1000)) {

      if (bestPrice === 0 && price !== 0) {
        bestPrice = price
      }

      if (avgPrice === 0 && price !== 0) {
        avgPrice = price
      }

      worstPrice = price
      const orderVaule = price * size
      prePriceImpact = (bestPrice - avgPrice) / bestPrice * 100
      // console.log(`price:${price}, size:${size}, orderValue:${orderVaule}, orderableValue:${orderableValue}, avgPrice:${avgPrice}, priceImpcat:${prePriceImpact}`);

      if (prePriceImpact > (slippage / 10)) {
        break;
      } else {
        priceImpact = prePriceImpact
        pcOut += price * size
        orderableValue += orderVaule
        coinIn += size;
        avgPrice = pcOut / coinIn;
      }

      // if (availableCoin <= size) {
      //   pcOut += availableCoin * price
      //   availableCoin = 0
      //   break
      // } else {
      //   pcOut += price * size
      //   availableCoin -= size
      // }
    }

    pcOut = pcOut * 0.993

    // console.log(`bid bestprice:${bestPrice}`);

    // const priceImpact = ((bestPrice - worstPrice) / bestPrice) * 100

    worstPrice = (worstPrice * (100 - slippage)) / 100
    const amountOutWithSlippage = (pcOut * (100 - slippage)) / 100
    // const minimumOutputAmount = (amountOutWithSlippage * (100 - slippage)) / 100
    const rate = pcOut / coinIn;

    // const avgPrice = pcOut / (coinIn - availableCoin);
    // const maxInAllow = coinIn - availableCoin

    return {
      market: this,
      inputTradeAmount: new u64(coinIn * DECIMALS[this.tokenIdA]),
      noSlippageOutputAmount: new u64(pcOut * DECIMALS[this.tokenIdB]),
      expectedOutputAmount: new u64(amountOutWithSlippage * DECIMALS[this.tokenIdB]),
      price: new Decimal(avgPrice),
      rate: new Decimal(rate.toString()),
      priceImpact: new Decimal(priceImpact.toString()),
      // minimumOutputAmount: new u64(amountOutWithSlippage * DECIMALS[this.tokenIdB])
    }
  }

  // async getSwapInfos(connection: Connection,
  //   inputTradeAmount = new u64(0),
  //   slippage = 1
  // ) {
  //   const swapInfo = await super.getSwapInfos(connection, inputTradeAmount, slippage);

  //   // console.time(`getSerumInfo`);
  //   const serumInfo = await this.getSerumInfo(connection, inputTradeAmount, slippage);
  //   // console.timeEnd(`getSerumInfo`);

  //   if (!serumInfo) {
  //     return swapInfo;
  //   }

  //   // console.log(`swap buy:${swapInfo.buyInfo.rate}, serum buy: ${serumInfo?.buyInfo.rate}`);
  //   // console.log(`swap sell:${swapInfo.sellInfo.rate}, serum sell: ${serumInfo?.sellInfo.rate}`);
  //   // console.log(`swap sell:${swapInfo.sellInfo.expectedOutputAmount}, serum sell: ${serumInfo?.sellInfo.expectedOutputAmount}`);

  //   return {
  //     buyInfo: swapInfo.buyInfo.rate.gt(serumInfo.buyInfo.rate) ? swapInfo.buyInfo : serumInfo.buyInfo,
  //     sellInfo: swapInfo.sellInfo.rate.gt(serumInfo.sellInfo.rate) ? swapInfo.sellInfo : serumInfo.sellInfo,
  //   }


  // }
}


export const RAYDIUM_BTC_USDC_MARKET = new RaydiumMarket(
  "BTC/USDC",
  TokenID.BTC,
  TokenID.USDC,
  new PublicKey("6kbC5epG18DF2DwPEW34tBy5pGFS7pEGALR3v5MGxgc5"),  // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("L6A7qW935i2HgaiaRx6xNGCGQfFr4myFU51dUSnCshd"),   // openOrders
  new PublicKey("6DGjaczWfFthTYW7oBk3MXP2mMwrYq86PA3ki5YF6hLg"),  // targetOrders
  new PublicKey("HWTaEDR6BpWjmyeUyfGZjeppLnH7s8o225Saar7FYDt5"),  // vaultA
  new PublicKey("7iGcnvoLAxthsXY3AFSgkTDoqnLiuti5fyPNm2VwZ3Wz"),  // vaultB

  new PublicKey("A8YFbxQYFVqKZaoYJLLUVcQiWP7G2MeEgW5wsAQgMvFw"),  // market
  new PublicKey("6wLt7CX1zZdFpa6uGJJpZfzWvG6W9rxXjquJDYiFwf9K"),  // bids
  new PublicKey("6EyVXMMA58Nf6MScqeLpw1jS12RCpry23u9VMfy8b65Y"),  // asks
  new PublicKey("6NQqaa48SnBBJZt9HyVPngcZFW81JfDv9EjRX2M4WkbP"),  // events
  new PublicKey("GZ1YSupuUq9kB28kX9t1j9qCpN67AMMwn4Q72BzeSpfR"),  // vaultA
  new PublicKey("7sP9fug8rqZFLbXoEj8DETF81KasaRA1fr6jQb6ScKc5"),  // vaultB
  new PublicKey("GBWgHXLf1fX4J1p5fAkQoEbnjpgjxUtr4mrVgtj9wW8a"),  // vaultSigner
);

export const RAYDIUM_ETH_USDC_MARKET = new RaydiumMarket(
  "ETH/USDC",
  TokenID.ETH,
  TokenID.USDC,
  new PublicKey("AoPebtuJC4f2RweZSxcVCcdeTgaEXY64Uho8b5HdPxAR"),  // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("7PwhFjfFaYp7w9N8k2do5Yz7c1G5ebp3YyJRhV4pkUJW"),   // openOrders
  new PublicKey("BV2ucC7miDqsmABSkXGzsibCVWBp7gGPcvkhevDSTyZ1"),  // targetOrders
  new PublicKey("EHT99uYfAnVxWHPLUMJRTyhD4AyQZDDknKMEssHDtor5"),  // vaultA
  new PublicKey("58tgdkogRoMsrXZJubnFPsFmNp5mpByEmE1fF6FTNvDL"),  // vaultB

  new PublicKey("4tSvZvnbyzHXLMTiFonMyxZoHmFqau1XArcRCVHLZ5gX"),  // market
  new PublicKey("8tFaNpFPWJ8i7inhKSfAcSestudiFqJ2wHyvtTfsBZZU"),  // bids
  new PublicKey("2po4TC8qiTgPsqcnbf6uMZRMVnPBzVwqqYfHP15QqREU"),  // asks
  new PublicKey("Eac7hqpaZxiBtG4MdyKpsgzcoVN6eMe9tAbsdZRYH4us"),  // events
  new PublicKey("7Nw66LmJB6YzHsgEGQ8oDSSsJ4YzUkEVAvysQuQw7tC4"),  // vaultA
  new PublicKey("EsDTx47jjFACkBhy48Go2W7AQPk4UxtT4765f3tpK21a"),  // vaultB
  new PublicKey("C5v68qSzDdGeRcs556YoEMJNsp8JiYEiEhw2hVUR8Z8y"),  // vaultSigner
)

export const RAYDIUM_SOL_USDC_MARKET = new RaydiumMarket(
  "SOL/USDC",
  TokenID.SOL,
  TokenID.USDC,
  new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"),  // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc"),  // openOrders
  new PublicKey("CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR"),  // targetOrders
  new PublicKey("DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz"),  // vaultA
  new PublicKey("HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz"),  // vaultB

  new PublicKey("9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT"),  // market
  new PublicKey("14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ"),  // bids
  new PublicKey("CEQdAFKdycHugujQg9k2wbmxjcpdYZyVLfV9WerTnafJ"),  // asks
  new PublicKey("5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht"),  // events
  new PublicKey("36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6"),  // vaultA
  new PublicKey("8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ"),  // vaultB
  new PublicKey("F8Vyqk3unwxkXukZFQeYyGmFfTG3CAX4v24iyrjEYBJV"),  // vaultSigner
)

export const RAYDIUM_USDT_USDC_MARKET = new RaydiumMarket(
  "USDT/USDC",
  TokenID.USDT,
  TokenID.USDC,
  new PublicKey("7TbGqz32RsuwXbXY7EyBCiAnMbJq1gm1wKmfjQjuwoyF"),  // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("6XXvXS3meWqnftEMUgdY8hDWGJfrb8t22x2k1WyVYwhF"),  // openOrders
  new PublicKey("AXY75qWM1t5X16FaeUovd9ZjL1W698cV843sDHV5EMqb"),  // targetOrders
  new PublicKey("Enb9jGaKzgDBfEbbUN3Ytx2ZLoZuBhBpjVX6DULiRmvu"),  // vaultA
  new PublicKey("HyyZpz1JUZjsfyiVSt3qz6E9PkwnBcyhUg4zKGthMNeH"),  // vaultB

  new PublicKey("77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS"),  // market
  new PublicKey("37m9QdvxmKRdjm3KKV2AjTiGcXMfWHQpVFnmhtb289yo"),  // bids
  new PublicKey("AQKXXC29ybqL8DLeAVNt3ebpwMv8Sb4csberrP6Hz6o5"),  // asks
  new PublicKey("9MgPMkdEHFX7DZaitSh6Crya3kCCr1As6JC75bm3mjuC"),  // events
  new PublicKey("H61Y7xVnbWVXrQQx3EojTEqf3ogKVY5GfGjEn5ewyX7B"),  // vaultA
  new PublicKey("9FLih4qwFMjdqRAGmHeCxa64CgjP1GtcgKJgHHgz44ar"),  // vaultB
  new PublicKey("FGBvMAu88q9d1Csz7ZECB5a2gbWwp6qicNxN2Mo7QhWG"),  // vaultSigner
)

export const RAYDIUM_RAY_USDC_MARKET = new RaydiumMarket(
  "RAY/USDC",
  TokenID.RAY,
  TokenID.USDC,
  new PublicKey("6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg"),  // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("J8u8nTHYtvudyqwLrXZboziN95LpaHFHpd97Jm5vtbkW"),  // openOrders
  new PublicKey("3cji8XW5uhtsA757vELVFAeJpskyHwbnTSceMFY5GjVT"),  // targetOrders
  new PublicKey("FdmKUE4UMiJYFK5ogCngHzShuVKrFXBamPWcewDr31th"),  // vaultA
  new PublicKey("Eqrhxd7bDUCH3MepKmdVkgwazXRzY6iHhEoBpY7yAohk"),  // vaultB

  new PublicKey("2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep"),  // market
  new PublicKey("Hf84mYadE1VqSvVWAvCWc9wqLXak4RwXiPb4A91EAUn5"),  // bids
  new PublicKey("DC1HsWWRCXVg3wk2NndS5LTbce3axwUwUZH1RgnV4oDN"),  // asks
  new PublicKey("H9dZt8kvz1Fe5FyRisb77KcYTaN8LEbuVAfJSnAaEABz"),  // events
  new PublicKey("GGcdamvNDYFhAXr93DWyJ8QmwawUHLCyRqWL3KngtLRa"),  // vaultA
  new PublicKey("22jHt5WmosAykp3LPGSAKgY45p7VGh4DFWSwp21SWBVe"),  // vaultB
  new PublicKey("FmhXe9uG6zun49p222xt3nG1rBAkWvzVz7dxERQ6ouGw"),  // vaultSigner
)

export const RAYDIUM_mSOL_USDC_MARKET = new RaydiumMarket(
  "mSOL/USDC",
  TokenID.mSOL,
  TokenID.USDC,
  new PublicKey("ZfvDXXUhZDzDVsapffUyXHj9ByCoPjP4thL6YXcZ9ix"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("4zoatXFjMSirW2niUNhekxqeEZujjC1oioKCEJQMLeWF"),  // openOrders
  new PublicKey("Kq9Vgb8ntBzZy5doEER2p4Zpt8SqW2GqJgY5BgWRjDn"),   // targetOrders
  new PublicKey("8JUjWjAyXTMB4ZXcV7nk3p6Gg1fWAAoSck7xekuyADKL"),  // vaultA
  new PublicKey("DaXyxj42ZDrp3mjrL9pYjPNyBp5P8A2f37am4Kd4EyrK"),  // vaultB

  new PublicKey("6oGsL2puUgySccKzn9XA9afqF217LfxP5ocq4B3LWsjy"),  // market
  new PublicKey("8qyWhEcpuvEsdCmY1kvEnkTfgGeWHmi73Mta5jgWDTuT"),  // bids
  new PublicKey("PPnJy6No31U45SVSjWTr45R8Q73X6bNHfxdFqr2vMq3"),   // asks
  new PublicKey("BC8Tdzz7rwvuYkJWKnPnyguva27PQP5DTxosHVQrEzg9"),  // events
  new PublicKey("2y3BtF5oRBpLwdoaGjLkfmT3FY3YbZCKPbA9zvvx8Pz7"),  // vaultA
  new PublicKey("6w5hF2hceQRZbaxjPJutiWSPAFWDkp3YbY2Aq3RpCSKe"),  // vaultB
  new PublicKey("9dEVMESKXcMQNndoPc5ji9iTeDJ9GfToboy8prkZeT96"),  // vaultSigner
)

export const RAYDIUM_APT_USDC_MARKET = new RaydiumMarket(
  "APT/USDC",
  TokenID.APT,
  TokenID.USDC,
  new PublicKey("4crhN3D8R5rnZd66q9b32P7K649e5XdzCfPMPiTzBceH"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("9ZkyYVUKZ3iWZnx6uJNUNKdv3NW3WcKNWZMg2YDYTxSx"),  // openOrders
  new PublicKey("FWKNVdavvUKdcpCCU3XT1dsCEbHF1ak21q2EzoyMy1av"),   // targetOrders
  new PublicKey("6egmkyieHa2R2TiVoLkwmy3fXG1F8EG8KmEMBN2Lahh7"),  // vaultA
  new PublicKey("4dcKsdDe39Yp4NDzko1Jv6ViSDo2AUMh2KGxT6giidpA"),  // vaultB

  new PublicKey("ATjWoJDChATL7E5WVeSk9EsoJAhZrHjzCZABNx3Miu8B"),  // market
  new PublicKey("5M3bbs43jpQWkXccVbny317rKFFq9bZT3ccv3YoLSwRd"),  // bids
  new PublicKey("EZYkKSRfdqbQbwBrVmkkWXmosYFB4cVhcT4jLT3Qjfxt"),   // asks
  new PublicKey("7tnT8FCXaN5zryRpjJieFHLLVBUtZYR3LhYDh3da9HJh"),  // events
  new PublicKey("GesJe56oHgbA9gTxNz5BFGXxhGdScteKNdmYeLj6PBmq"),  // vaultA
  new PublicKey("GvjFcsncRnqfmRig7kkgoeur7QzkZaPurpHHyWyeriNu"),  // vaultB
  new PublicKey("Hfn1km6sEcBnQ6S1SLYsJZkwQzx7kJJ9o8UqwWhPNiW3"),  // vaultSigner
)

export const RAYDIUM_SRM_USDC_MARKET = new RaydiumMarket(
  "SRM/USDC",
  TokenID.SRM,
  TokenID.USDC,
  new PublicKey("8tzS7SkUZyHPQY7gLqsMCXZ5EDCgjESUHcB17tiR1h3Z"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("GJwrRrNeeQKY2eGzuXGc3KBrBftYbidCYhmA6AZj2Zur"),  // openOrders
  new PublicKey("26LLpo8rscCpMxyAnJsqhqESPnzjMGiFdmXA4eF2Jrk5"),   // targetOrders
  new PublicKey("zuLDJ5SEe76L3bpFp2Sm9qTTe5vpJL3gdQFT5At5xXG"),  // vaultA
  new PublicKey("4usvfgPDwXBX2ySX11ubTvJ3pvJHbGEW2ytpDGCSv5cw"),  // vaultB

  new PublicKey("ByRys5tuUWDgL73G8JBAEfkdFf8JWBzPBDHsBVQ5vbQA"),  // market
  new PublicKey("AuL9JzRJ55MdqzubK4EutJgAumtkuFcRVuPUvTX39pN8"),  // bids
  new PublicKey("8Lx9U9wdE3afdqih1mCAXy3unJDfzSaXFqAvoLMjhwoD"),   // asks
  new PublicKey("6o44a9xdzKKDNY7Ff2Qb129mktWbsCT4vKJcg2uk41uy"),  // events
  new PublicKey("Ecfy8et9Mft9Dkavnuh4mzHMa2KWYUbBTA5oDZNoWu84"),  // vaultA
  new PublicKey("hUgoKy5wjeFbZrXDW4ecr42T4F5Z1Tos31g68s5EHbP"),  // vaultB
  new PublicKey("GVV4ZT9pccwy9d17STafFDuiSqFbXuRTdvKQ1zJX6ttX"),  // vaultSigner
)

export const RAYDIUM_SBR_USDC_MARKET = new RaydiumMarket(
  "SBR/USDC",
  TokenID.SBR,
  TokenID.USDC,
  new PublicKey("5cmAS6Mj4pG2Vp9hhyu3kpK9yvC7P6ejh9HiobpTE6Jc"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("8bEDWrUBqMV7ei55PgySABm8swC9WFW24NB6U5f5sPJT"),  // openOrders
  new PublicKey("G2nswHPqZLXtMimXZtsiLHVZ5gJ9GTiKRdLxahDDdYag"),   // targetOrders
  new PublicKey("8vwzjpW7KPGFLQdRuyoBBoiBCsNG6SLRGssKMNsofch2"),  // vaultA
  new PublicKey("AcK6bv25Q7xofBUiXKwUgueSi3ELS6anMbmNn2NPV8FZ"),  // vaultB

  new PublicKey("HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs"),  // market
  new PublicKey("FdGKYpHxpQEkRitZw6KZ8b21Q2mYiATHXZgJjFDhnRWM"),  // bids
  new PublicKey("cxqTRyeoGeh6TBEgo3NAieHaMkdmfZiCjSEfkNAe1Y3"),   // asks
  new PublicKey("EUre4VPaLh7B95qG3JPS3atquJ5hjbwtX7XFcTtVNkc7"),  // events
  new PublicKey("38r5pRYVzdScrJNZowNyrpjVbtRKQ5JMcQxn7PgKE45L"),  // vaultA
  new PublicKey("4YqAGXQEQTQbn4uKX981yCiSjUuYPV8aCajc9qQh3QPy"),  // vaultB
  new PublicKey("84aqZGKMzbr8ddA267ML7JUTAjieVJe8oR1yGUaKwP53"),  // vaultSigner
)

export const RAYDIUM_FTT_USDC_MARKET = new RaydiumMarket(
  "FTT/USDC",
  TokenID.FTT,
  TokenID.USDC,
  new PublicKey("4C2Mz1bVqe42QDDTyJ4HFCFFGsH5YDzo91Cen5w5NGun"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("23WS5XY3srvBtnP6hXK64HAsXTuj1kT7dd7srjrJUNTR"),  // openOrders
  new PublicKey("CYbPm6BCkMyX8NnnS7AoCUkpxHVwYyxvjQWwZLsrFcLR"),   // targetOrders
  new PublicKey("4TaBaR1ZgHNuQM3QNHnjJdAT4Sws9cz46MtVWVebg7Ax"),  // vaultA
  new PublicKey("7eDiHvsfcZf1VFC2sUDJwr5EMMr66TpQ2nmAreUjoASV"),  // vaultB

  new PublicKey("2Pbh1CvRVku1TgewMfycemghf6sU9EyuFDcNXqvRmSxc"),  // market
  new PublicKey("9HTDV2r7cQBUKL3fgcJZCUfmJsKA9qCP7nZAXyoyaQou"),  // bids
  new PublicKey("EpnUJCMCQNZi45nCBoNs6Bugy67Kj3bCSTLYPfz6jkYH"),   // asks
  new PublicKey("2XHxua6ZaPKpCGUNvSvTwc9teJBmexp8iMWCLu4mtzGb"),  // events
  new PublicKey("4LXjM6rptNvhBZTcWk4AL49oF4oA8AH7D4CV6z7tmpX3"),  // vaultA
  new PublicKey("2ycZAqQ3YNPfBZnKTbz2FqPiV7fmTQpzF95vjMUekP5z"),  // vaultB
  new PublicKey("B5b9ddFHrjndUieLAKkyzB1xmq8sNqGGZPmbyYWPzCyu"),  // vaultSigner
)

export const RAYDIUM_ORCA_USDC_MARKET = new RaydiumMarket(
  "ORCA/USDC",
  TokenID.ORCA,
  TokenID.USDC,
  new PublicKey("C5yXRTp39qv5WZrfiqoqeyK6wvbqS97oBqbsDUqfZyu"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("BUwThGpiXwei6xeAZyeSofZYAsQRwnqhyyZ3Xe3J1YAB"),  // openOrders
  new PublicKey("3g7Ef2aZzvWo57Cggv8o8dnMLGz2NSB1BRNyvVnb8AYm"),   // targetOrders
  new PublicKey("48uXZgcnxxDSipQoXMdFmvDsu3xwDsEjHnhKXVYpeHvF"),  // vaultA
  new PublicKey("8eLo3ppAUnjwa4HekixbZ6wTkKGgcMXF3NzxYpduV3if"),  // vaultB

  new PublicKey("8N1KkhaCYDpj3awD58d85n973EwkpeYnRp84y1kdZpMX"),  // market
  new PublicKey("HaAjqsdR6CzDJAioL6s9RGYL7tNC84Hv65S1Gm6MeS9s"),  // bids
  new PublicKey("BQUychhbQfWHsAdTtrcy3DxPRm3dbqZTfYy1W7PQS9e"),   // asks
  new PublicKey("3ajZQLGpAiTnX9quZyoRw1T4E5emWbTAjFtdVyfevXds"),  // events
  new PublicKey("4noUQEJF15yMVWHc7JkWid5EKoE6XLjQEHfdN3pT43NZ"),  // vaultA
  new PublicKey("38DxyYjp4ZqAqjrvAPvDhdALYd4y91jxcpnj28hbvyky"),  // vaultB
  new PublicKey("Dtz4cysczNNTUbHMqnZW2UfUm87bGecR98snGZePt2ot"),  // vaultSigner
)

export const RAYDIUM_MNDE_mSOL_MARKET = new RaydiumMarket(
  "MNDE/mSOL",
  TokenID.MNDE,
  TokenID.mSOL,
  new PublicKey("2kPA9XUuHUifcCYTnjSuN7ZrC3ma8EKPrtzUhC86zj3m"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("G3qeShDT2w3Y9XnJbk5TZsx1qbxkBLFmRsnNVLMnkNZb"),  // openOrders
  new PublicKey("DfMpzNeT4XHs2xtN74j5q94QfqPSJbng5BgGyyyChsVm"),   // targetOrders
  new PublicKey("F1zwWuPfYLZfLykDYUqu43A74TUsv8mHuWL6BUrwVhL7"),  // vaultA
  new PublicKey("TuT7ftAgCQGsETei4Q4nMBwp2QLcDwKnixAEgFSBuao"),  // vaultB

  new PublicKey("AVxdeGgihchiKrhWne5xyUJj7bV2ohACkQFXMAtpMetx"),  // market
  new PublicKey("9YBjtad6ZxR7hxNXyTjRRPnPgS7geiBMHbBp4BqHsgV2"),  // bids
  new PublicKey("8UZpvreCr8bprUwstHMPb1pe5jQY82N9fJ1XLa3oKMXg"),   // asks
  new PublicKey("3eeXmsg8byQEC6Q18NE7MSgSbnAJkxz8KNPbW2zfKyfY"),  // events
  new PublicKey("aj1igzDQNRg18h9yFGvNqMPBfCGGWLDvKDp2NdYh92C"),  // vaultA
  new PublicKey("3QjiyDAny7ZrwPohN8TecXL4jBwGWoSUe7hzTiX35Pza"),  // vaultB
  new PublicKey("6Ysd8CE6KwC7KQYpPD9Ax8B77z3bWRnHt1SVrBM8AYC9"),  // vaultSigner
)

export const RAYDIUM_MER_USDC_MARKET = new RaydiumMarket(
  "MER/USDC",
  TokenID.MER,
  TokenID.USDC,
  new PublicKey("BkfGDk676QFtTiGxn7TtEpHayJZRr6LgNk9uTV2MH4bR"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("FNwXaqyYNKNwJ8Qc39VGzuGnPcNTCVKExrgUKTLCcSzU"),  // openOrders
  new PublicKey("DKgXbNmsm1uCJ2eyh6xcnTe1G6YUav8RgzaxrbkG4xxe"),   // targetOrders
  new PublicKey("6XZ1hoJQZARtyA17mXkfnKSHWK2RvocC3UDNsY7f4Lf6"),  // vaultA
  new PublicKey("F4opwQUoVhVRaf3CpMuCPpWNcB9k3AXvMMsfQh52pa66"),  // vaultB

  new PublicKey("G4LcexdCzzJUKZfqyVDQFzpkjhB1JoCNL8Kooxi9nJz5"),  // market
  new PublicKey("DVjhW8nLFWrpRwzaEi1fgJHJ5heMKddssrqE3AsGMCHp"),  // bids
  new PublicKey("CY2gjuWxUFGcgeCy3UiureS3kmjgDSRF59AQH6TENtfC"),   // asks
  new PublicKey("8w4n3fcajhgN8TF74j42ehWvbVJnck5cewpjwhRQpyyc"),  // events
  new PublicKey("4ctYuY4ZvCVRvF22QDw8LzUis9yrnupoLQNXxmZy1BGm"),  // vaultA
  new PublicKey("DovDds7NEzFn493DJ2yKBRgqsYgDXg6z38pUGXe1AAWQ"),  // vaultB
  new PublicKey("BUDJ4F1ZknbZiwHb6xHEsH6o1LuW394DE8wKT8CoAYNF"),  // vaultSigner
)

export const RAYDIUM_PORT_USDC_MARKET = new RaydiumMarket(
  "PORT/USDC",
  TokenID.PORT,
  TokenID.USDC,
  new PublicKey("6nJes56KF999Q8VtQTrgWEHJGAfGMuJktGb8x2uWff2u"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("ENfqr7WFKJy9VRwfDkgL4HvMM6GU7pHyowzZsZwx8P39"),  // openOrders
  new PublicKey("9wjp6tFY1XNH6KhdCHeDgeUsNLVjTwxA3iC9k5aun2NW"),   // targetOrders
  new PublicKey("GGurDvQctUDgcegSYZetkNGytcWEfLes6yXzYruhLuLP"),  // vaultA
  new PublicKey("3FmHEQRHaKMS4vA41eYTVmfxX9ErxdAScS2tvgWvNHSz"),  // vaultB

  new PublicKey("8x8jf7ikJwgP9UthadtiGFgfFuyyyYPHL3obJAuxFWko"),  // market
  new PublicKey("9Y24T3co7Cc7cGbG2mFc9n3LQonAWgtayqfLz3p28JPa"),  // bids
  new PublicKey("8uQcJBapCnxy3tNEB8tfmssUvqYWvuCsSHYtdNFbFFjm"),   // asks
  new PublicKey("8ptDxtRLWXAKYQYRoRXpKmrJje31p8dsDsxeZHEksqtV"),  // events
  new PublicKey("8rNKJFsd9yuGx7xTTm9sb23JLJuWJ29zTSTznGFpUBZB"),  // vaultA
  new PublicKey("5Vs1UWLxZHHRW6yRYEEK3vpzE5HbQ8BFm27PnAaDjqgb"),  // vaultB
  new PublicKey("63ZaXnSj7SxWLFEcjmK79fyGokJxhR3UEXomN7q7Po25"),  // vaultSigner
)

export const RAYDIUM_weWETH_USDC_MARKET = new RaydiumMarket(
  "weWETH/USDC",
  TokenID.weWETH,
  TokenID.USDC,
  new PublicKey("EoNrn8iUhwgJySD1pHu8Qxm5gSQqLK3za4m8xzD2RuEb"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("6iwDsRGaQucEcfXX8TgDW1eyTfxLAGrypxdMJ5uqoYcp"),  // openOrders
  new PublicKey("EGZL5PtEnSHrNmeoQF64wXG6b5oqiTArDvAQuSRyomX5"),   // targetOrders
  new PublicKey("DVWRhoXKCoRbvC5QUeTECRNyUSU1gwUM48dBMDSZ88U"),  // vaultA
  new PublicKey("HftKFJJcUTu6xYcS75cDkm3y8HEkGgutcbGsdREDWdMr"),  // vaultB

  new PublicKey("8Gmi2HhZmwQPVdCwzS7CM66MGstMXPcTVHA7jF19cLZz"),  // market
  new PublicKey("3nXzH1gYKM1FKdSLHM7GCRG76mhKwyDjwinJxAg8jjx6"),  // bids
  new PublicKey("b3L5dvehk48X4mDoKzZUZKA4nXGpPAMFkYxHZmsZ98n"),   // asks
  new PublicKey("3z4QQPFdgNSxazqEAzmZD5C5tJWepczimVqWak2ZPY8v"),  // events
  new PublicKey("8cCoWNtgCL7pMapGZ6XQ6NSyD1KC9cosUEs4QgeVq49d"),  // vaultA
  new PublicKey("C7KrymKrLWhCsSjFaUquXU3SYRmgYLRmMjQ4dyQeFiGE"),  // vaultB
  new PublicKey("FG3z1H2BBsf5ekEAxSc1K6DERuAuiXpSdUGkYecQrP5v"),  // vaultSigner
)

export const RAYDIUM_SLC_USDC_MARKET = new RaydiumMarket(
  "SLC/USDC",
  TokenID.SLC,
  TokenID.USDC,
  new PublicKey("84Sk8vke7cSvKeLuEv6Y59GUJi9dKZUQTc3nxnNqKaNS"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("GrsptRCTC9tUhpuqeLbb6EYyGkjoGvtcpAm34vKQG4d3"),  // openOrders
  new PublicKey("3bjQpeq4ZnCo3VnPjib1UZdgkrRHUTkuVCPQAaPTj5wD"),   // targetOrders
  new PublicKey("BTVMJ1D7zc4eCNNwLmJ8nVrADJK734AicBxrMqH33y1q"),  // vaultA
  new PublicKey("2GQb6TfLkbZ8TmidVQycmJZpkZNYaHXs6uDhFTkBnFmE"),  // vaultB

  new PublicKey("DvmDTjsdnN77q7SST7gngLydP1ASNNpUVi4cNfU95oCr"),  // market
  new PublicKey("CWV58CaZXCkvaVMx2nRrx6K5CN3CafKDqYHu5HAmHJ7p"),  // bids
  new PublicKey("GCHLTigMHNjCnoWwL6sAGqVLh3AWvqU8mgb2HUtcmadp"),   // asks
  new PublicKey("EMbRLesmacYyj7a618abpTYnMCZrPpisJZL1G7FxTjNz"),  // events
  new PublicKey("7HPWx59RQLAbEFYegMC1sepdTo86i9d5pg5c5yiXqPSC"),  // vaultA
  new PublicKey("DeUNDMfX7G6kXaaK5ZsaCFBoSwuJDErqK8hJzz2pdhDk"),  // vaultB
  new PublicKey("CaQ8qAjV44hExigiWGpiVEQM78zazMe1VNe1TKQF9cA5"),  // vaultSigner
)

export const RAYDIUM_WOOF_USDC_MARKET = new RaydiumMarket(
  "WOOF/USDC",
  TokenID.WOOF,
  TokenID.USDC,
  new PublicKey("EZRHhpvAP4zEX1wZtTQcf6NP4FLWjs9c6tMRBqfrXgFD"),   // amm
  new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),  // ammAuthority
  new PublicKey("GBGxwY1eqBJcTVAjwFDpLGQGCv5eoQTciudT9ttFybqZ"),  // openOrders
  new PublicKey("EdQNfUu9EAX6aT7ixLV9zYBRLhArCgrxPAQPr3CBdFK7"),   // targetOrders
  new PublicKey("6LP3CwLwA7StkyMQ9NpKUqLS9ipMmUjPrKhQ8V9w1BoH"),  // vaultA
  new PublicKey("6HXfUDRXJkywFYvrKVgZMhnhvfqiU8T9pVYhJzyHEcmS"),  // vaultB

  new PublicKey("CwK9brJ43MR4BJz2dwnDM7EXCNyHhGqCJDrAdsEts8n5"),  // market
  new PublicKey("D5S8oWsPjytRq6uXB9H7fHxzFTpcmvULwYbuhAeAKNu4"),  // bids
  new PublicKey("3PZAPrwUkhTqjaB7sDHLEj669J6hQXzPFTrnv7tgcgZT"),   // asks
  new PublicKey("4V7fTH8x6qYz4GyvEVbzq1yLoGcpoByo6nCrsiA1HUUv"),  // events
  new PublicKey("2VcGBzs54DWCVtAQsw8fx1VVdrxEvX7bJz3AD4j8EBHX"),  // vaultA
  new PublicKey("3rfTMxRqmtoVvVsZXnvf2ifpFweeKSWxuFkYtyQnN9KG"),  // vaultB
  new PublicKey("BUwcHs7HSHMexNjrEuSaP3TY5xdqBo87384VmWMV9BQF"),  // vaultSigner
)