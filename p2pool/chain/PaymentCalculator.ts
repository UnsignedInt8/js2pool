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

    constructor(nodeAddress: string) {
        this.nodePubkeyScript = Utils.addressToScript(nodeAddress);
    }

    calc(previousShareHash: string, template: GetBlockTemplate, ) {

        let desiredWeight = new Bignum(65535).mul(PaymentCalculator.BLOCKSPREAD).mul(Algos.targetToAverageAttempts(new Bignum(template.target, 16)));
        let payableShares = kinq.toLinqable(this.sharechain.subchain(previousShareHash, PaymentCalculator.CALC_SHARES_LENGTH)).skip(1);
        let totalWeight = new Bignum(0);
        let donationWeight = new Bignum(0);
        let weights = new Map<string, Bignum>(); // pubkey hash -> bignum
        // console.log('payableshares:', payableShares.count())
        for (let share of payableShares) {
            let lastTotalWeight = totalWeight;

            totalWeight = totalWeight.add(share.totalWeight);
            donationWeight = donationWeight.add(share.donationWeight);

            let pubkeyScript = share.pubkeyScript.toString();

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

        let totalReward = template.coinbasevalue;
        let totalProportion = totalWeight.mul(200);
        let amount = new Map<string, Bignum>();
        for (let [pubkeyHash, weight] of weights) {
            amount.set(Utils.hash160ToScript(pubkeyHash).toString('hex'), weight.mul(totalReward).mul(199).div(totalProportion))
        }

        let nodeScript = this.nodePubkeyScript.toString('hex');
        let nodeReward = amount.get(nodeScript) || new Bignum(0);
        nodeReward = nodeReward.add(totalReward / 200);
        amount.set(nodeScript, nodeReward);

        if (amount.has(DONATION_SCRIPT)) {
            console.log(DONATION_SCRIPT, amount.get(DONATION_SCRIPT));
        }

        console.log(amount, nodeReward);

        console.log('total', totalWeight, 'donation', donationWeight, donationWeight.toNumber() / totalWeight.toNumber());
        console.log('weights:', weights.size, 'amounts:', amount.size);
        
    }
}