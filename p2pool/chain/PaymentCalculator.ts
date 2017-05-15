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
import BufferWriter from '../../misc/BufferWriter';
import { DONATION_SCRIPT, DONATION_SCRIPT_BUF } from "../p2p/shares/BaseShare";


export class PaymentCalculator {
    static CALC_SHARES_LENGTH = 24 * 60 * 6;
    static BLOCKSPREAD = 3;
    static readonly DELAY_LENGTH = 6;

    sharechain = Sharechain.Instance;
    recentTotalWeight: Bignum;
    recentDonationWeight: Bignum;
    recentWeightList = new Map<string, Bignum>();

    nodePubkeyScript: Buffer;
    nodePubkey: Buffer;

    constructor(nodeAddress: string) {
        this.nodePubkey = Utils.addressToPubkey(nodeAddress);
        this.nodePubkeyScript = Utils.addressToScript(nodeAddress);
    }

    /**
     * Return ordered amount list
     */
    calc(previousShareHash: string, gbtCoinbaseValue: number, gbtBlockTarget: string): Array<(Buffer | Bignum)[]> {

        let desiredWeight = new Bignum(65535).mul(PaymentCalculator.BLOCKSPREAD).mul(Algos.targetToAverageAttempts(new Bignum(gbtBlockTarget, 16)));
        let payableShares = kinq.toLinqable(this.sharechain.subchain(previousShareHash, PaymentCalculator.CALC_SHARES_LENGTH)).skip(1);
        let totalWeight = new Bignum(0);
        let donationWeight = new Bignum(0);
        let weights = new Map<string, Bignum>(); // pubkey script -> bignum

        for (let share of payableShares) {
            let lastTotalWeight = totalWeight;

            totalWeight = totalWeight.add(share.totalWeight);
            donationWeight = donationWeight.add(share.donationWeight);

            let pubkeyScript = share.pubkeyScript.toString('hex');

            let shareWeight = weights.get(pubkeyScript);
            if (shareWeight) {
                weights.set(pubkeyScript, shareWeight.add(share.weight));
                continue;
            }

            shareWeight = share.weight;
            if (totalWeight.gt(desiredWeight)) {
                totalWeight = desiredWeight;
                shareWeight = desiredWeight.sub(lastTotalWeight).div(65535).mul(share.weight).div(share.totalWeight.div(65535));
            }
            weights.set(pubkeyScript, shareWeight);
        }

        console.log('totalweight', weights.size, totalWeight, donationWeight);

        let coinbaseValue = new Bignum(gbtCoinbaseValue);
        let totalProportion = totalWeight.mul(200);
        let totalPayouts = new Bignum(0);
        let amounts = new Map<string, Bignum>();
        for (let [pubkeyScript, weight] of weights) {
            let payout = weight.mul(coinbaseValue).mul(199).div(totalProportion); // 99.5% to miners
            amounts.set(pubkeyScript, payout);
            totalPayouts = totalPayouts.add(payout);
        }

        let nodeScript = this.nodePubkeyScript.toString('hex');
        let nodeReward = amounts.get(nodeScript) || new Bignum(0);
        nodeReward = nodeReward.add(coinbaseValue.div(200)); // 0.5% to block finder
        amounts.set(nodeScript, nodeReward);
        totalPayouts = totalPayouts.add(nodeReward);

        let donationReward = amounts.get(DONATION_SCRIPT) || new Bignum(0);
        let donationAmount = coinbaseValue.sub(totalPayouts);
        donationReward = donationReward.add(donationAmount);
        totalPayouts = totalPayouts.add(donationAmount);

        if (!totalPayouts.eq(coinbaseValue)) return [];

        let paymentList = Array.from(amounts.orderBy(i => i[1], (i1, i2) => i1.sub(i2).toNumber()).select(i => [Buffer.from(i[0]), i[1]]).take(4000));
        paymentList.push([DONATION_SCRIPT_BUF, donationReward]);

        Array.from(weights.orderBy(w => w[1], (i1, i2) => i1.sub(i2).toNumber())).forEach(w => console.log(w[0], w[1]));

        console.log('total', totalWeight, 'donation', donationWeight, donationWeight.toNumber() / totalWeight.toNumber());
        console.log('weights:', weights.size, 'amounts:', amounts.size, paymentList.length);
        return paymentList;
    }
}