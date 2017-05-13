/*
 * Created on Sat May 13 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { BaseShare } from "../p2p/shares";
import Sharechain from "./Sharechain";
import * as Bignum from 'bignum';
import * as kinq from 'kinq';
import * as Algos from "../../core/Algos";
import * as Utils from '../../misc/Utils';
import { GetBlockTemplate } from "../../core/DaemonWatcher";

export class PaymentCalculator {
    static CALC_SHARES_LENGTH = 24 * 60 * 6;
    static BLOCKSPREAD = 3;
    static readonly DELAY_LENGTH = 6;

    sharechain = Sharechain.Instance;
    recentTotalWeight: Bignum;
    recentDonationWeight: Bignum;
    recentWeightList = new Map<string, Bignum>();

    nodePubkey: Buffer;

    constructor(nodeAddress: string = '1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9') {
        this.nodePubkey = Utils.addressToPubkey(nodeAddress);
    }

    calc(previousShareHash: string, template: GetBlockTemplate, ) {

        let desiredWeight = new Bignum(65535).mul(PaymentCalculator.BLOCKSPREAD).mul(Algos.targetToAverageAttempts(new Bignum(template.target, 16)));
        let payableShares = kinq.toLinqable(this.sharechain.subchain(previousShareHash, PaymentCalculator.CALC_SHARES_LENGTH)).skip(1);
        let totalWeight = new Bignum(0);
        let donationWeight = new Bignum(0);
        let weights = new Map<string, Bignum>();

        for (let share of payableShares) {
            let lastTotalWeight = totalWeight;
            totalWeight = totalWeight.add(share.totalWeight);
            donationWeight = donationWeight.add(share.donationWeight);

            let shareWeight = weights.get(share.info.data.pubkeyHash);

            if (shareWeight) {
                weights.set(share.info.data.pubkeyHash, shareWeight.add(share.weight));
                continue;
            }

            shareWeight = share.weight;

            if (totalWeight.gt(desiredWeight)) {
                totalWeight = desiredWeight;
                shareWeight = desiredWeight.sub(lastTotalWeight).div(65535).mul(share.weight).div(share.totalWeight.div(65535));
            }

            weights.set(share.info.data.pubkeyHash, shareWeight);
        }

        let nodeWeight = weights.get(this.nodePubkey.toString()) || new Bignum(0);


        for (let [pubkeyHash, weight] of weights) {

        }

        console.log('total', totalWeight);
        console.log('donation', donationWeight, donationWeight.toNumber() / totalWeight.toNumber());
        console.log('count:', weights.size, /*Array.from(weightList.values()).reduce((p, c) => p.add(c))*/);
        console.log('desired', desiredWeight);
    }
}