import { u64 } from "@solana/spl-token";

export const ZERO = new u64(0);
export const ONE = new u64(1);
export const TWO = new u64(2);

export class U64Utils {
    // Note: divisor input variable modified in place
    // https://github.com/solana-labs/solana-program-library/blob/master/libraries/math/src/checked_ceil_div.rs#L5-L22
    public static ceilingDivision(dividend: u64, divisor: u64): [u64, u64] {
        let quotient = dividend.div(divisor);
        if (quotient.eq(ZERO)) {
            return [ZERO, divisor];
        }

        let remainder = dividend.mod(divisor);
        if (remainder.gt(ZERO)) {
            quotient = quotient.add(ONE);
            divisor = dividend.div(quotient);
            remainder = dividend.mod(quotient);
            if (remainder.gt(ZERO)) {
                divisor = divisor.add(ONE);
            }
        }

        return [quotient, divisor];
    }

    public static sqrt(value: u64) {
        const x = value;
        let z = x.add(ONE).div(TWO);
        let y = x;
        while (z.sub(y).isNeg()) {
            y = z;
            z = x.div(z).add(z).div(TWO);
        }
        return y;
    }
}