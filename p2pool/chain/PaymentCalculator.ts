/*
 * Created on Sat May 13 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { BaseShare } from "../p2p/shares";
import Sharechain from "./Sharechain";
import * as Bignum from 'bignum';
import * as kinq from 'kinq';

export class PaymentCalculator {
    static CALC_SHARES_LENGTH = 24 * 60 * 6;
    static readonly DELAY_LENGTH = 6;


    sharechain = Sharechain.Instance;
    recentTotalWeight: Bignum;
    recentDonationWeight: Bignum;
    recentWeightList = new Map<string, Bignum>();
    
    // calc(previousHash: string) {

    //     if (!this.cachedShares) {
    //         this.cachedShares = kinq.toLinqable(this.sharechain.subchain(previousHash, PaymentCalculator.CALC_SHARES_LENGTH)).skip(PaymentCalculator.DELAY_LENGTH).toArray();

    //         let first = this.cachedShares[0];
    //         this.cachedTotalWeight = first.totalWeight;
    //         this.cachedDonationWeight = first.donationWeight;
    //         this.cachedWeightList.set(first.info.data.pubkeyHash, first.weight);

    //         this.calcWeights(this.cachedShares.skip(1));
    //     }

    //     let recentShares = Array.from(this.sharechain.subchain(previousHash, PaymentCalculator.DELAY_LENGTH));
    //     this.calcWeights(recentShares);

    //     let recentLastShare = recentShares[recentShares.length - 1];
    //     if (this.cachedShares.length >= PaymentCalculator.CALC_SHARES_LENGTH - PaymentCalculator.DELAY_LENGTH) {
    //         let oldest = this.cachedShares.pop();
    //         this.cachedDonationWeight = this.cachedDonationWeight.sub(oldest.donationWeight);
    //         this.
    //     }
    //     this.cachedShares.pop()
    //     let weightList = new Map<string, Bignum>();
    // }

    // private calcWeights(shares: Iterable<BaseShare>) {
    //     for (let share of shares) {
    //         this.cachedTotalWeight = this.cachedTotalWeight.add(share.totalWeight);
    //         this.cachedDonationWeight = this.cachedDonationWeight.add(share.donationWeight);

    //         let weight = this.cachedWeightList.get(share.info.data.pubkeyHash);
    //         if (weight) {
    //             this.cachedWeightList.set(share.info.data.pubkeyHash, weight.add(share.weight));
    //             continue;
    //         }

    //         this.cachedWeightList.set(share.info.data.pubkeyHash, share.weight);
    //     }
    // }
}