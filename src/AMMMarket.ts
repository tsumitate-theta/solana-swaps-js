import { AccountLayout, u64 } from "@solana/spl-token";
import { PublicKey, Connection, TransactionInstruction } from "@solana/web3.js";
import Decimal from "decimal.js";
import { Market, TokenID, Swapper, DECIMALS } from ".";
import { U64Utils, ZERO, DecimalUtil } from "./utils";

export class AMMMarket extends Market implements Swapper{

  constructor(
    public name: string,
    public tokenIdA: TokenID,
    public tokenIdB: TokenID,
    public vaultA: PublicKey,
    public vaultB: PublicKey,
  ) {
    super(name, [tokenIdA, tokenIdB]);
  }
  createSwapInstructions(fromToken: TokenID, fromAmount: number, fromTokenAccount: PublicKey, toToken: TokenID, minToAmount: number, toTokenAccount: PublicKey, tradeOwner: PublicKey): Promise<TransactionInstruction[]> {
    throw new Error("Method not implemented.");
  }

  getSwapper(args: any): Swapper {
    throw new Error("Method not implemented.");
  }

  getInputToken(side: "buy" | "sell" = "buy") {
    return side === "buy" ? this.tokenIdB : this.tokenIdA;
  }

  getOutputToken(side: "buy" | "sell" = "buy") {
    return side === "buy" ? this.tokenIdA : this.tokenIdB;
  }

  getInputVault(side: "buy" | "sell" = "buy") {
    return side === "buy" ? this.vaultB : this.vaultA;
  }

  getOutputVault(side: "buy" | "sell" = "buy") {
    return side === "buy" ? this.vaultA : this.vaultB;
  }


  async getTokenCount(
    connection: Connection,
    side: "buy" | "sell" = "buy"
  ) {

    // トークンの数を取る
    const accountInfos = await connection.getMultipleAccountsInfo([
      this.getInputVault(side),
      this.getOutputVault(side),
    ]);

    const tokens = accountInfos.map((info) => {
      if (info != undefined) {
        const accountInfo = AccountLayout.decode(info.data);
        accountInfo.mint = new PublicKey(accountInfo.mint);
        accountInfo.owner = new PublicKey(accountInfo.owner);
        accountInfo.amount = u64.fromBuffer(accountInfo.amount);
        return accountInfo;
      } else {
        undefined;
      }
    });
    const inputTokenAccount = tokens[0],
      outputTokenAccount = tokens[1];

    if (inputTokenAccount === undefined || outputTokenAccount === undefined) {
      throw new Error("Unable to fetch accounts for specified tokens.");
    }

    return {
      inPoolAmount: new u64(inputTokenAccount.amount),
      outPoolAmount: new u64(outputTokenAccount.amount),
    };
  }


  getOutputAmount(inputTradeAmount: u64, inPoolAmount: u64, outPoolAmount: u64): u64 {
    const invariant = inPoolAmount.mul(outPoolAmount);

    const [newPoolOutputAmount] = U64Utils.ceilingDivision(
      invariant,
      inPoolAmount.add(inputTradeAmount)
    );

    const outputAmount = outPoolAmount.sub(newPoolOutputAmount);

    return new u64(outputAmount.toString());
  }

  getLPFees(inputTradeAmount: u64): u64 {
    const numerator = new u64(30);
    const denominator = new u64(10000);

    const fee = inputTradeAmount
      .mul(numerator)
      .div(denominator);

    return new u64(fee.toString());
  }

  getExpectedOutputAmount(inputTradeAmount: u64, inPoolAmount: u64, outPoolAmount: u64): u64 {
    const inputTradeLessFees = inputTradeAmount.sub(this.getLPFees(inputTradeAmount));
    return this.getOutputAmount(inputTradeLessFees, inPoolAmount, outPoolAmount);
  }


  getExpectedOutputAmountWithNoSlippage(
    inputTradeAmount: u64,
    inPoolAmount: u64,
    outPoolAmount: u64
  ): u64 {
    if (inPoolAmount.eq(ZERO)) {
      return outPoolAmount;
    }

    const inputTradeLessFees = inputTradeAmount.sub(this.getLPFees(inputTradeAmount));
    return inputTradeLessFees.mul(outPoolAmount).div(inPoolAmount);
  }

  getMinimumAmountOut(inputTradeAmount: u64, inPoolAmount: u64, outPoolAmount: u64, slippage: number): u64 {
    const slippagenumerator = new u64(slippage);
    const slippagedenominator = new u64(1000);

    const expectedOutputAmountFees = this.getExpectedOutputAmount(inputTradeAmount, inPoolAmount, outPoolAmount);
    const result = expectedOutputAmountFees
      .mul(slippagedenominator.sub(slippagenumerator))
      .div(slippagedenominator);
    return result;
  }

  getRate(inputTradeAmountU64: u64,
    inPoolAmount: u64,
    outPoolAmount: u64,
    side: "buy" | "sell" = "buy"
  ): Decimal {
    if (inputTradeAmountU64.eq(ZERO)) {
      return new Decimal(0);
    }

    const inputToken = this.getInputToken(side);
    const outputToken = this.getOutputToken(side);

    const expectedOutputAmountU64 = this.getExpectedOutputAmount(inputTradeAmountU64, inPoolAmount, outPoolAmount);
    const inputTradeAmount = DecimalUtil.fromU64(inputTradeAmountU64, DECIMALS[inputToken]);
    const outputTradeAmount = DecimalUtil.fromU64(expectedOutputAmountU64, DECIMALS[outputToken]);

    const result = outputTradeAmount.div(inputTradeAmount).toDecimalPlaces(DECIMALS[outputToken]);
    return result;
  }

  getPriceImpact(inputTradeAmount: u64,
    inPoolAmount: u64,
    outPoolAmount: u64,
    side: "buy" | "sell" = "buy"
  ): Decimal {
    if (inputTradeAmount.eq(ZERO)) {
      return new Decimal(0);
    }

    const outputToken = this.getOutputToken(side);

    const noSlippageOutputCountU64 = this.getExpectedOutputAmountWithNoSlippage(inputTradeAmount, inPoolAmount, outPoolAmount);
    const outputCountU64 = this.getExpectedOutputAmount(inputTradeAmount, inPoolAmount, outPoolAmount);

    const noSlippageOutputCount = DecimalUtil.fromU64(
      noSlippageOutputCountU64,
      DECIMALS[outputToken]
    );
    const outputCount = DecimalUtil.fromU64(outputCountU64, DECIMALS[outputToken]);

    const impact = (noSlippageOutputCount.sub(outputCount)).div(noSlippageOutputCount);
    return impact.mul(100).toDecimalPlaces(DECIMALS[outputToken]);
  }

  getOptimalInputAmount(
    inPoolAmountU64: u64,
    outPoolAmountU64: u64,
    slippage: number,
  ): u64 {
    const slippagenumerator = new u64(slippage);
    const slippagedenominator = new u64(1000);

    const result = inPoolAmountU64.mul(slippagenumerator).div(slippagedenominator);

    return new u64(result.toString());;
  }

  getSwapInfo(
    side: "buy" | "sell" = "buy",
    inPoolAmount: u64,
    outPoolAmount: u64,
    inputTradeAmount = new u64(0),
    slippage = 1
  ): SwapInfo {

    if (inputTradeAmount.isZero()) {
      inputTradeAmount = this.getOptimalInputAmount(inPoolAmount, outPoolAmount, slippage);
    }

    //   console.log(`inAmount:${inPoolAmount}, out:${outPoolAmount}, inputTradeAmount:${inputTradeAmount}`);
    const expectedOutputAmount = this.getExpectedOutputAmount(inputTradeAmount, inPoolAmount, outPoolAmount);
    const noSlippageOutputAmount = this.getExpectedOutputAmountWithNoSlippage(inputTradeAmount, inPoolAmount, outPoolAmount);
    //   console.log(`expectedOutputAmount:${expectedOutputAmount}, noSlippageOutputAmount:${noSlippageOutputAmount}`);

    const rate = this.getRate(inputTradeAmount, inPoolAmount, outPoolAmount, side);
    //   console.log(`rate:${rate.toString()}`);
    const price = side === "buy" ? new Decimal(1).div(rate) : rate;

    const priceImpact = this.getPriceImpact(inputTradeAmount, inPoolAmount, outPoolAmount, side);
    //   console.log(`priceImpact:${priceImpact.toString()}`);

    const minimumOutputAmount = this.getMinimumAmountOut(inputTradeAmount, inPoolAmount, outPoolAmount, slippage);
    //   console.log(`minimumOutputAmount:${minimumOutputAmount}`);

    return {
      market: this,
      inputTradeAmount: inputTradeAmount,
      expectedOutputAmount: expectedOutputAmount,
      noSlippageOutputAmount: noSlippageOutputAmount,
      rate: rate,
      price : price,
      priceImpact: priceImpact,
      minimumOutputAmount: minimumOutputAmount,
      inPoolAmount: inPoolAmount,
      outPoolAmount: outPoolAmount,
      slippage: slippage
    };

  }

  async getSwapInfos(connection: Connection,
    inputTradeAmount = new u64(0),
    slippage = 1
  ) {
    console.time(`getTokenCount`);
    const { inPoolAmount, outPoolAmount } = await this.getTokenCount(connection, "buy");
    console.timeEnd(`getTokenCount`);

    const buyInfo = this.getSwapInfo(
      "buy",
      inPoolAmount,
      outPoolAmount,
      inputTradeAmount,
      slippage
    );

    const sellInfo = this.getSwapInfo(
      "sell",
      outPoolAmount,
      inPoolAmount,
      inputTradeAmount,
      slippage
    );

    return {
      buyInfo: buyInfo,
      sellInfo: sellInfo
    };
  }

}

export type SwapInfo = {
  market: AMMMarket,
  inputTradeAmount: u64,
  expectedOutputAmount: u64,
  noSlippageOutputAmount: u64,
  price: Decimal,
  rate: Decimal,
  priceImpact: Decimal,
  minimumOutputAmount: u64,
  inPoolAmount?: u64,
  outPoolAmount?: u64,
  slippage?: number,
}