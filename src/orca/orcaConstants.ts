import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Market, PairMarket, Swapper, TokenID } from "../types";
import { Parser } from "../utils/Parser";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const ORCA_SWAP_PROGRAM = new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP");

export class OrcaMarket extends Market implements Swapper, PairMarket {
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
    super(name, [tokenIdA, tokenIdB]);
  }

  getSwapper() : Swapper {
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
  ) : Promise<TransactionInstruction[]> {

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
        {pubkey: this.swap,             isSigner: false, isWritable: false},
        {pubkey: this.swapAuthority,    isSigner: false, isWritable: false},
        {pubkey: tradeOwner,            isSigner: true,  isWritable: false},
        {pubkey: fromTokenAccount,      isSigner: false, isWritable: true},
        {pubkey: poolSource,            isSigner: false, isWritable: true},
        {pubkey: poolDest,              isSigner: false, isWritable: true},
        {pubkey: toTokenAccount,        isSigner: false, isWritable: true},
        {pubkey: this.poolMint,         isSigner: false, isWritable: true},
        {pubkey: this.fees,             isSigner: false, isWritable: true},
        {pubkey: TOKEN_PROGRAM_ID,      isSigner: false, isWritable: false},
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