import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Market, PairMarket, Swapper, TokenID } from "../types";
import { Parser } from "../utils/Parser";
import { AccountLayout, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { U64Utils, ZERO } from "../utils/U64Utils";
import Decimal from "decimal.js";
import { DECIMALS } from "..";
import { DecimalUtil } from "../utils";
import { AMMMarket } from "../AMMMarket";

export const ORCA_SWAP_PROGRAM = new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP");

export class OrcaMarket extends AMMMarket implements Swapper, PairMarket {
  dexname: string;
  constructor(
    public name: string,
    public tokenIdA: TokenID,
    public tokenIdB: TokenID,
    public swap: PublicKey,
    public swapAuthority: PublicKey,
    public vaultA: PublicKey,
    public vaultB: PublicKey,
    public poolMint: PublicKey,
    public fees: PublicKey,
  ) {
    super(name, tokenIdA, tokenIdB, vaultA, vaultB);
    this.dexname = "Orca";
  }

  getSwapper(): Swapper {
    return this;
  }

  INST_LAYOUT = new Parser()
    .u8("cmd")
    .u64("in_amount")
    .u64("min_out_amount");

  async createSwapInstructions(
    fromToken: TokenID,
    fromAmount: number,
    fromTokenAccount: PublicKey,
    toToken: TokenID,
    minToAmount: number,
    toTokenAccount: PublicKey,
    tradeOwner: PublicKey,
  ): Promise<TransactionInstruction[]> {

    const buffer = this.INST_LAYOUT.encode({
      cmd: 1,
      in_amount: fromAmount,
      min_out_amount: minToAmount
    });

    const poolSource = fromToken === this.tokenIdA ? this.vaultA : this.vaultB;
    const poolDest = toToken === this.tokenIdA ? this.vaultA : this.vaultB;

    const ix = new TransactionInstruction({
      programId: ORCA_SWAP_PROGRAM,
      keys: [
        { pubkey: this.swap, isSigner: false, isWritable: false },
        { pubkey: this.swapAuthority, isSigner: false, isWritable: false },
        { pubkey: tradeOwner, isSigner: true, isWritable: false },
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolSource, isSigner: false, isWritable: true },
        { pubkey: poolDest, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.poolMint, isSigner: false, isWritable: true },
        { pubkey: this.fees, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: buffer,
    });

    return [ix];
  }

}

export const ORCA_USDT_USDC_MARKET = new OrcaMarket(
  "USDT/USDC",
  TokenID.USDT,
  TokenID.USDC,

  new PublicKey("F13xvvx45jVGd84ynK3c8T89UejQVxjCLtmHfPmAXAHP"), // swap
  new PublicKey("3cGHDS8uWhdxQj14vTmFtYHX3NMouPpE4o9MjQ43Bbf4"), // swapAuthority
  new PublicKey("AiwmnLy7xPT28dqZpkRm6i1ZGwELUCzCsuN92v4JkSeU"), // vaultA
  new PublicKey("6uUn2okWk5v4x9Gc4n2LLGHtWoa9tmizHq1363dW7t9W"), // vaultB
  new PublicKey("H2uzgruPvonVpCRhwwdukcpXK8TG17swFNzYFr2rtPxy"), // poolMint
  new PublicKey("B4RNxMJGRzKFQyTq2Uwkmpyjtew13n7KtdqZy6qgENTu"), // fees
)

export const ORCA_SBR_USDC_MARKET = new OrcaMarket(
  "SBR/USDC",
  TokenID.SBR,
  TokenID.USDC,

  new PublicKey("HiYggjP2fN53Jw46e5UuskqNP3HH98jceRxEgVoeRwNw"), // swap
  new PublicKey("ATkEV1nEkdp7zgaGpzFCsJ5WAyejcJbxqzGhQpfcDW4S"), // swapAuthority
  new PublicKey("DrJTQqNZqNCf2HDLpYg9zRCMRwnhZEVQuGjeaWtX6CA7"), // vaultA
  new PublicKey("DEVLUv1uiUSukQoBdy9fDQyehi4N2Boojy8J2LQ8bK2E"), // vaultB
  new PublicKey("CS7fA5n4c2D82dUoHrYzS3gAqgqaoVSfgsr18kitp2xo"), // poolMint
  new PublicKey("7S3KKuvcHfcKWBGLDwmoTgtB97JE8LHruP8jbmQkGfH"), // fees
)

export const ORCA_ORCA_USDC_MARKET = new OrcaMarket(
  "ORCA/USDC",
  TokenID.ORCA,
  TokenID.USDC,

  new PublicKey("2p7nYbtPBgtmY69NsE8DAW6szpRJn7tQvDnqvoEWQvjY"), // swap
  new PublicKey("3fr1AhdiAmWLeNrS24CMoAu9pPgbzVhwLtJ6QUPmw2ob"), // swapAuthority
  new PublicKey("9vYWHBPz817wJdQpE8u3h8UoY3sZ16ZXdCcvLB7jY4Dj"), // vaultA
  new PublicKey("6UczejMUv1tzdvUzKpULKHxrK9sqLm8edR1v9jinVWm9"), // vaultB
  new PublicKey("n8Mpu28RjeYD7oUX3LG1tPxzhRZh3YYLRSHcHRdS3Zx"), // poolMint
  new PublicKey("7CXZED4jfRp3qdHB9Py3up6v1C4UhHofFvfT6RXbJLRN"), // fees
)

export const ORCA_MNDE_mSOL_MARKET = new OrcaMarket(
  "MNDE/mSOL",
  TokenID.MNDE,
  TokenID.mSOL,

  new PublicKey("vjHagYsgZwG9icyFLHu2xWHWdtiS5gfeNzRhDcPt5xq"), // swap
  new PublicKey("3HWcojnC1ruEMmsE92Ez1BoebdDXzYQa4USaeWX7eTuM"), // swapAuthority
  new PublicKey("2LferrWvYWtHFfdkmixzt9g3aKa3yBNfgbRrP1CcWMMp"), // vaultA
  new PublicKey("GimsuZjYqMXM6xK6S3e9JpGvX6jaMPuNeR6s2piDESmy"), // vaultB
  new PublicKey("5PHS5w6hQwFNnLz1jJFe7TVTxSQ98cDYC3akmiAoFMXs"), // poolMint
  new PublicKey("46mdANZ2DCA2sTFchvD7WwbffbLQa4jCFkkRL23WuYG8"), // fees
);

export const ORCA_FTT_USDC_MARKET = new OrcaMarket(
  "FTT/USDC",
  TokenID.FTT,
  TokenID.USDC,

  new PublicKey("8npdwWX2BR39kcFLtTJABbcjNq7NWQvipfqxgsfk9mTX"), // swap
  new PublicKey("8zU13KiLb1e87skt4rf8q1LhamEKKecyu6Xxb4Hqnm7e"), // swapAuthority
  new PublicKey("SasuKsATA2ATrMfFfSJr86wAGVgdS69PkQT3jFASBB8"), // vaultA
  new PublicKey("3wADiuUqoakdoYYYxKqwoA4VN3uWZy5UwvLePox1mEsK"), // vaultB
  new PublicKey("FwCombynV2fTVizxPCNA2oZKoWXLZgdJThjE4Xv9sjxc"), // poolMint
  new PublicKey("C8D52rGuZcsBENhWtR9aqJVRU62cL7jyyEhxesKwc1k8"), // fees
);

export const ORCA_APT_USDC_MARKET = new OrcaMarket(
  "APT/USDC",
  TokenID.APT,
  TokenID.USDC,

  new PublicKey("Fg3UabVqnfycMtkiTVoaia9eNafehtT9Y4TicH2iBtvK"), // swap
  new PublicKey("JDEYn1JsacdxoB4v4mbctFSVrSUPttacX3gxWphFHJKZ"), // swapAuthority
  new PublicKey("636crNdZTf46gFUKuedaBCZDBMLahf7KGud2LyTMskU5"), // vaultA
  new PublicKey("DGEYFkEHyiuHWtHeCGiQGn1JbkGHqYrNwaP44miRbgxu"), // vaultB
  new PublicKey("HNrYngS1eoqkjWro9D3Y5Z9sWBDzPNK2tX4rfV2Up177"), // poolMint
  new PublicKey("41H5mWwsZKewJeV4wWiNjQ3U4VYBnwqCpzvAWt86baHd"), // fees
);

export const ORCA_BTC_USDC_MARKET = new OrcaMarket(
  "BTC/USDC",
  TokenID.BTC,
  TokenID.USDC,

  new PublicKey("2dwHmCoAGxCXvTbLTMjqAhvEFAHWUt9kZaroJJJdmoD4"), // swap
  new PublicKey("BwJ1vMtJiBy7dJaVToR1KUwVbBsGUTNN4QdKVSf8EEh1"), // swapAuthority
  new PublicKey("D3Wv78j9STkfJx3vhzoCzpMZ4RqCg8oaTNGzi1rZpdJg"), // vaultA
  new PublicKey("HMFLg2GtbWSSEe92Vuf2LQdUpCacGj2m2PwvMqzwQFNi"), // vaultB
  new PublicKey("J3kvcay3N16FBdawgnqoJ9v9p6XCvyCLE2Z9F5RLvGkj"), // poolMint
  new PublicKey("HR7c67SkeLvCpHrVSu7MiiAERQh6iD1NrCJsj3kWiZnK"), // fees
);

export const ORCA_ETH_USDC_MARKET = new OrcaMarket(
  "ETH/USDC",
  TokenID.ETH,
  TokenID.USDC,

  new PublicKey("FgZut2qVQEyPBibaTJbbX2PxaMZvT1vjDebiVaDp5BWP"), // swap
  new PublicKey("4dfCZR32xXhoTgMRhnViNaTFwiKP9A34TDjHCR3xM5rg"), // swapAuthority
  new PublicKey("H9h5yTBfCHcb4eRP87fXczzXgNaMzKihr7bf1sjw7iuZ"), // vaultA
  new PublicKey("JA98RXv2VdxQD8pRQq4dzJ1Bp4nH8nokCGmxvPWKJ3hx"), // vaultB
  new PublicKey("3e1W6Aqcbuk2DfHUwRiRcyzpyYRRjg6yhZZcyEARydUX"), // poolMint
  new PublicKey("DLWewB12jzGn4wXJmFCddWDeof1Ma4cZYNRv9CP5hTvX"), // fees
);

export const ORCA_SOL_USDT_MARKET = new OrcaMarket(
  "SOL/USDT",
  TokenID.SOL,
  TokenID.USDT,

  new PublicKey("4bS6bkBdJ4B1Bt4ft3oGF8La7eKpCqz8xnu1AMpMxWSP"), // swap
  new PublicKey("EAvLj3zW236pUSSSzwjL18QuPpkTxkWaVSR5GdX7yiNa"), // swapAuthority
  new PublicKey("BBDQmitNga99M9QsBRnyos9uWPumNbWLC1mfbReJi45C"), // vaultA
  new PublicKey("8xepSs1iXsSw8QrCS1rpZk8KY3fMwUZqDT4dmzDa2trX"), // vaultB
  new PublicKey("BmZNYGt7aApGTUUxAQUYsW64cMbb6P7uniokCWaptj4D"), // poolMint
  new PublicKey("HR2rWgcU6SNCWxJDozDu6qCgSSvUoKCynbhQPGRNqpCG"), // fees
);

export const ORCA_mSOL_SOL_MARKET = new OrcaMarket(
  "mSOL/SOL",
  TokenID.mSOL,
  TokenID.SOL,

  new PublicKey("9EQMEzJdE2LDAY1hw1RytpufdwAXzatYfQ3M2UuT9b88"), // swap
  new PublicKey("6cwehd4xhKkJ2s7iGh4CaDb7KhMgqczSBnyNJieUYbHn"), // swapAuthority
  new PublicKey("6xmki5RtGNHrfhTiHFfp9k3RQ9t8qgL1cYP2YCG2h179"), // vaultA
  new PublicKey("Ew2coQtVGLeca31vqB2ssHntjzZgUy1ad9VuuAX8yw7p"), // vaultB
  new PublicKey("29cdoMgu6MS2VXpcMo1sqRdWEzdUR9tjvoh8fcK8Z87R"), // poolMint
  new PublicKey("6j2tt2UVYMQwqG3hRtyydW3odzBFwy3pN33tyB3xCKQ6"), // fees
);

export const ORCA_SRM_SOL_MARKET = new OrcaMarket(
  "SRM/SOL",
  TokenID.SRM,
  TokenID.SOL,

  new PublicKey("EGZ7tiLeH62TPV1gL8WwbXGzEPa9zmcpVnnkPKKnrE2U"), // swap
  new PublicKey("JU8kmKzDHF9sXWsnoznaFDFezLsE5uomX2JkRMbmsQP"), // swapAuthority
  new PublicKey("ANP74VNsHwSrq9uUSjiSNyNWvf6ZPrKTmE4gHoNd13Lg"), // vaultA
  new PublicKey("75HgnSvXbWKZBpZHveX68ZzAhDqMzNDS29X6BGLtxMo1"), // vaultB
  new PublicKey("APDFRM3HMr8CAGXwKHiu2f5ePSpaiEJhaURwhsRrUUt9"), // poolMint
  new PublicKey("8JnSiuvQq3BVuCU3n4DrSTw9chBSPvEMswrhtifVkr1o"), // fees
);

export const ORCA_RAY_USDC_MARKET = new OrcaMarket(
  "RAY/USDC",
  TokenID.RAY,
  TokenID.USDC,

  new PublicKey("2R2VhohRc5WoNHtRdwnjovAQaZRAmr1DE3QFW5jfgb6v"), // swap
  new PublicKey("9B9ZcYT8jDQ6XLe6gRLDCFv1zz3uHVKdbZT9DFhsYSQW"), // swapAuthority
  new PublicKey("9ASj9zDg7cT6wtvn4euSUiZte8yN2U3Tn6cTVZvMHbU7"), // vaultA
  new PublicKey("HGTxSWbb62nxk4oGkLkHUvrEzR5D4GKYRb8ZDcA2dpki"), // vaultB
  new PublicKey("4cXw2MYj94TFBXLL73fEpMCr8DPrW68JvrV8mzWgktbD"), // poolMint
  new PublicKey("HURhvCRsrwwR5TiG75Hn274WwL76kaKgjgC6n9h4FEHj"), // fees
);

export const ORCA_pSOL_USDC_MARKET = new OrcaMarket(
  "pSOL/USDC",
  TokenID.pSOL,
  TokenID.USDC,

  new PublicKey("GW1Xt9HHtvcnky8X7aBA3BoTgiirJKP5XwC5REFcZSsc"), // swap
  new PublicKey("GXueH9K1MzRncoTYbpLiXXC3WrKkmHUFxV5JEu8oADbw"), // swapAuthority
  new PublicKey("F7XioZaGe99nosYJQCahx25TKgdUGufYf6sudm1JSgu"), // vaultA
  new PublicKey("BT14DfFyNS7qcBGc8TY4HAzDev4vvqsoFBJgjtQpdM2Z"), // vaultB
  new PublicKey("C2YzN6MymD5HM2kPaH7bzcbqciyjfmpqyVaR3KA5V6z1"), // poolMint
  new PublicKey("BhHd49JYH3Hk6TV5kCjmUgf7fQSQKDjaWTokMmBhTx9o"), // fees
);

export const ORCA_SOL_USDC_MARKET = new OrcaMarket(
  "SOL/USDC",
  TokenID.SOL,
  TokenID.USDC,

  new PublicKey("EGZ7tiLeH62TPV1gL8WwbXGzEPa9zmcpVnnkPKKnrE2U"), // swap
  new PublicKey("JU8kmKzDHF9sXWsnoznaFDFezLsE5uomX2JkRMbmsQP"), // swapAuthority
  new PublicKey("ANP74VNsHwSrq9uUSjiSNyNWvf6ZPrKTmE4gHoNd13Lg"), // vaultA
  new PublicKey("75HgnSvXbWKZBpZHveX68ZzAhDqMzNDS29X6BGLtxMo1"), // vaultB
  new PublicKey("APDFRM3HMr8CAGXwKHiu2f5ePSpaiEJhaURwhsRrUUt9"), // poolMint
  new PublicKey("8JnSiuvQq3BVuCU3n4DrSTw9chBSPvEMswrhtifVkr1o"), // fees
);

export const ORCA_mSOL_USDC_MARKET = new OrcaMarket(
  "mSOL/USDC",
  TokenID.mSOL,
  TokenID.USDC,

  new PublicKey("Hme4Jnqhdz2jAPUMnS7jGE5zv6Y1ynqrUEhmUAWkXmzn"), // swap
  new PublicKey("9Z7E42k46kxnBjAh8YGXDw3rRGwwxQUBYM7Ccrmwg6ZP"), // swapAuthority
  new PublicKey("GBa7G5f1FqAXEgByuHXsqsEdpyMjRgT9SNxZwmmnEJAY"), // vaultA
  new PublicKey("7hFgNawzzmpDM8TTVCKm8jykBrym8C3TQdb8TDAfAVkD"), // vaultB
  new PublicKey("8PSfyiTVwPb6Rr2iZ8F3kNpbg65BCfJM9v8LfB916r44"), // poolMint
  new PublicKey("3W3Skj2vQsNEMhGRQprFXQy3Q8ZbM6ojdgiDCokVPWno"), // fees
);

export const ORCA_PORT_USDC_MARKET = new OrcaMarket(
  "PORT/USDC",
  TokenID.PORT,
  TokenID.USDC,

  new PublicKey("4if9Gy7dvjU7XwunKxdnCcPsaT3yAHPXdz2XS1eo19LG"), // swap
  new PublicKey("BshtCZRCHj2RZYC7u5sW3ioRJo9ZiYA4T5p8muFwrKnb"), // swapAuthority
  new PublicKey("2wuSqR5z2Guft2yt57Hx7K6i1AYNoUi8fjxHUeAgaKXo"), // vaultA
  new PublicKey("AvP1Db3SyUxLGMSc4nSXjJkjm1kAjiLjog7cup19eWa3"), // vaultB
  new PublicKey("F8gPSpwVHj8FdAJAYULDuZBxFEJut87hUbARYYx3471w"), // poolMint
  new PublicKey("5JZXUbCfaSo3y9PYq47Hj5Yc6hVFa4j7MkDzBJfMSRSN"), // fees
);

export const ORCA_weWETH_USDC_MARKET = new OrcaMarket(
  "weWETH/USDC",
  TokenID.weWETH,
  TokenID.USDC,

  new PublicKey("4reGGLbesqpAeAZdAJv9hhgA2tgj45oGcyRuEvhATdMm"), // swap
  new PublicKey("8uLtzZ1iTLTCPsm3b4QttRmDXcFjhVHRuMS9VTVEwo7E"), // swapAuthority
  new PublicKey("9KpjcpKwhoFPbixvKDfcAhBQcVXk1CSBTGsJdzojDPRv"), // vaultA
  new PublicKey("5HaG31FQS4McBVcHxVfwaKaWXE3VCGqvJ1ZDkTxs94cQ"), // vaultB
  new PublicKey("7NPtjjAP7vhp4t5NCLyY4DY5rurvyc8cgZ2a2rYabRia"), // poolMint
  new PublicKey("AVw52spXtzFh4bb5ghhpJaDbLx3XWuY85eQNDEo3X1yN"), // fees
);

export const ORCA_SLND_USDC_MARKET = new OrcaMarket(
  "SLND/USDC",
  TokenID.SLND,
  TokenID.USDC,

  new PublicKey("GhosXH9yZPxqSyTHqJtXQt6w65YfiGjKXcEXciX1P3z8"), // swap
  new PublicKey("ChmSHndtXRsYnFjYA2F7yRRsnyZ8kCpxSogTsCUgCEsh"), // swapAuthority
  new PublicKey("9RcdfprKxbTzp3erTJMwXKznNCLmbCUaKhibaTMXhToi"), // vaultA
  new PublicKey("6wEh8r3Czc3nKkN6JXobShnLG7ZqA5Y5DREGzkirYR36"), // vaultB
  new PublicKey("F59gkD7NnsdJbFKrRZsiBC8PAooN4c56T8QmahfW1iXN"), // poolMint
  new PublicKey("GMipxN5pu6F6wwUrq6RhpqgcMjcKLTsnDTeNFCuUm5n7"), // fees
);

export const ORCA_stSOL_USDC_MARKET = new OrcaMarket(
  "stSOL/USDC",
  TokenID.stSOL,
  TokenID.USDC,

  new PublicKey("EfK84vYEKT1PoTJr6fBVKFbyA7ZoftfPo2LQPAJG1exL"), // swap
  new PublicKey("8PSN1CQxfyZ7T4sM3HM3RAgF2Y6VCf4tKSc8xY73Tnq5"), // swapAuthority
  new PublicKey("9SEBxqhP8sTAzmfiQfCPim1MqQXuDPb6fkGzJF7Z339i"), // vaultA
  new PublicKey("G45yhM5mZ5RXZpLxGWLk3PVzdAp33z8aH6F9mLW8fQj3"), // vaultB
  new PublicKey("GtQ1NT7R5aaTiST7K6ZWdMhwDdFxsSFvVFhBo8vyHGAq"), // poolMint
  new PublicKey("CJhL3UGesECFt6fvLB3csrGMuHf3M3G78pUzTopUiV8T"), // fees
);

export const ORCA_scnSOL_USDC_MARKET = new OrcaMarket(
  "scnSOL/USDC",
  TokenID.scnSOL,
  TokenID.USDC,

  new PublicKey("6Gh36sNXrGWYiWr999d9iZtqgnipJbWuBohyHBN1cJpS"), // swap
  new PublicKey("GXWEpRURaQZ9E62Q23EreTUfBy4hfemXgWFUWcg7YFgv"), // swapAuthority
  new PublicKey("7xs9QsrxQDVoWQ8LQ8VsVjfPKBrPGjvg8ZhaLnU1i2VR"), // vaultA
  new PublicKey("FZFJK64Fk1t619zmVPqCx8Uy29zJ3WuvjWitCQuxXRo3"), // vaultB
  new PublicKey("Dkr8B675PGnNwEr9vTKXznjjHke5454EQdz3iaSbparB"), // poolMint
  new PublicKey("HsC1Jo38jK3EpoNAkxfoUJhQVPa28anewZpLfeouUNk7"), // fees
);