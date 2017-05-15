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
import { DONATION_SCRIPT } from "../p2p/shares/BaseShare";


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
    calc(previousShareHash: string, template: GetBlockTemplate, ): Array<{ script: Buffer, amount: Bignum }> {

        let desiredWeight = new Bignum(65535).mul(PaymentCalculator.BLOCKSPREAD).mul(Algos.targetToAverageAttempts(new Bignum(template.target, 16)));
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
        // Array.from(weights.orderBy(w => w[1])).forEach(w => console.log(w[0], w[1]));

        let coinbaseValue = new Bignum(template.coinbasevalue);
        let totalProportion = totalWeight.mul(200);
        let totalPayouts = new Bignum(0);
        let amounts = new Map<string, Bignum>();
        for (let [pubkeyScript, weight] of weights) {
            let payout = weight.mul(coinbaseValue).mul(199).div(totalProportion);
            amounts.set(pubkeyScript, payout);
            totalPayouts = totalPayouts.add(payout);
        }

        let nodeScript = this.nodePubkeyScript.toString('hex');
        let nodeReward = amounts.get(nodeScript) || new Bignum(0);
        nodeReward = nodeReward.add(coinbaseValue.div(200));
        amounts.set(nodeScript, nodeReward);
        totalPayouts = totalPayouts.add(nodeReward);

        let donationReward = amounts.get(DONATION_SCRIPT) || new Bignum(0);
        let donationAmount = coinbaseValue.sub(totalPayouts);
        donationReward = donationReward.add(donationAmount);
        amounts.set(DONATION_SCRIPT, donationReward);
        totalPayouts = totalPayouts.add(donationAmount);

        if (!totalPayouts.eq(coinbaseValue)) return [];

        console.log(totalPayouts, coinbaseValue);
        console.log(DONATION_SCRIPT, amounts.get(DONATION_SCRIPT));

        console.log('total', totalWeight, 'donation', donationWeight, donationWeight.toNumber() / totalWeight.toNumber());
        console.log('weights:', weights.size, 'amounts:', amounts.size);
        return new Array();
    }
}