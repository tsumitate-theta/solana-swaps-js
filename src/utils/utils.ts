import { Connection, PublicKey, Commitment, AccountInfo } from "@solana/web3.js";
import { nu64, struct, u8 } from 'buffer-layout'
import { publicKey, u128, u64 } from '@project-serum/borsh'

export async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getMultipleAccounts(
    connection: Connection,
    publicKeys: PublicKey[],
    commitment?: Commitment,
  ): Promise<
    {
      publicKey: PublicKey;
      context: { slot: number };
      accountInfo: AccountInfo<Buffer>;
    }[]
  > {
    const len = publicKeys.length;
    if (len === 0) {
      return [];
    }
    if (len > 100) {
      const mid = Math.floor(publicKeys.length / 2);
      return Promise.all([
        getMultipleAccounts(connection, publicKeys.slice(0, mid), commitment),
        getMultipleAccounts(connection, publicKeys.slice(mid, len), commitment),
      ]).then((a) => a[0].concat(a[1]));
    }
    const publicKeyStrs = publicKeys.map((pk) => pk.toBase58());
    // load connection commitment as a default
    commitment ||= connection.commitment;
  
    const args = commitment ? [publicKeyStrs, { commitment }] : [publicKeyStrs];
    // @ts-ignore
    const resp = await connection._rpcRequest('getMultipleAccounts', args);
    if (resp.error) {
      throw new Error(resp.error.message);
    }
    return resp.result.value.map(
      ({ data, executable, lamports, owner }, i: number) => ({
        publicKey: publicKeys[i],
        context: resp.result.context,
        accountInfo: {
          data: Buffer.from(data[0], 'base64'),
          executable,
          owner: new PublicKey(owner),
          lamports,
        },
      }),
    );
  }

  export const AMM_INFO_LAYOUT_V4 = struct([
    u64('status'),
    u64('nonce'),
    u64('orderNum'),
    u64('depth'),
    u64('coinDecimals'),
    u64('pcDecimals'),
    u64('state'),
    u64('resetFlag'),
    u64('minSize'),
    u64('volMaxCutRatio'),
    u64('amountWaveRatio'),
    u64('coinLotSize'),
    u64('pcLotSize'),
    u64('minPriceMultiplier'),
    u64('maxPriceMultiplier'),
    u64('systemDecimalsValue'),
    // Fees
    u64('minSeparateNumerator'),
    u64('minSeparateDenominator'),
    u64('tradeFeeNumerator'),
    u64('tradeFeeDenominator'),
    u64('pnlNumerator'),
    u64('pnlDenominator'),
    u64('swapFeeNumerator'),
    u64('swapFeeDenominator'),
    // OutPutData
    u64('needTakePnlCoin'),
    u64('needTakePnlPc'),
    u64('totalPnlPc'),
    u64('totalPnlCoin'),
  
    u64('poolOpenTime'),
    u64('punishPcAmount'),
    u64('punishCoinAmount'),
    u64('orderbookToInitTime'),
  
    u128('swapCoinInAmount'),
    u128('swapPcOutAmount'),
    u64('swapCoin2PcFee'),
    u128('swapPcInAmount'),
    u128('swapCoinOutAmount'),
    u64('swapPc2CoinFee'),
  
    publicKey('poolCoinTokenAccount'),
    publicKey('poolPcTokenAccount'),
    publicKey('coinMintAddress'),
    publicKey('pcMintAddress'),
    publicKey('lpMintAddress'),
    publicKey('ammOpenOrders'),
    publicKey('serumMarket'),
    publicKey('serumProgramId'),
    publicKey('ammTargetOrders'),
    publicKey('poolWithdrawQueue'),
    publicKey('poolTempLpTokenAccount'),
    publicKey('ammOwner'),
    publicKey('pnlOwner')
  ])