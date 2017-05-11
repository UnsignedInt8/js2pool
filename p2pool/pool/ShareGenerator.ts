/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Sharechain from "../p2p/shares/Sharechain";
import * as Utils from '../../misc/Utils';
import * as kinq from 'kinq';
import * as Bignum from 'bignum';
import * as MathEx from '../../misc/MathEx';
import { BaseShare } from "../p2p/shares/index";
import { POW2_256, POW2_256_SUB_1, targetToBits, } from "../../core/Algos";

export class ShareGenerator {

    static MAX_TARGET: Bignum;
    static MIN_TARGET: Bignum;
    static TARGET_LOOKBEHIND = 0;
    static PERIOD = 0;

    readonly sharechain = Sharechain.Instance;

    constructor(nodeAddress: string) {

    }

    generateTx(lastHash: string, desiredTarget: Bignum) {
        let preTarget, preTarget2, preTarget3: Bignum;
        let lastShare = this.sharechain.get(lastHash);

        if (!lastShare || lastShare.info.absheight < ShareGenerator.TARGET_LOOKBEHIND) {
            preTarget3 = ShareGenerator.MAX_TARGET;
        } else {
            let attemptsPerSecond = this.calcGlobalAttemptsPerSecond(lastHash, ShareGenerator.TARGET_LOOKBEHIND, true, true);
            preTarget = attemptsPerSecond.gt(0) ? POW2_256.div(attemptsPerSecond.mul(ShareGenerator.PERIOD)).sub(1) : POW2_256_SUB_1;
            preTarget2 = MathEx.clip(preTarget, lastShare.maxTarget.mul(9).div(10), lastShare.maxTarget.mul(11).div(10));
            preTarget3 = MathEx.clip(preTarget2, ShareGenerator.MIN_TARGET, ShareGenerator.MAX_TARGET);
        }

        let maxBits = targetToBits(preTarget3);
        console.log('maxbits', maxBits.toString(16));
        let bits = targetToBits(MathEx.clip(desiredTarget, preTarget3.div(30), preTarget3));
        console.log('bits', bits.toString(16));
    }

    calcGlobalAttemptsPerSecond(hash: string, length: number, minWork = false, interger = false) {

        let shares = Array.from(kinq.toLinqable(this.sharechain.subchain(hash, length, 'backward')));
        if (shares.length === 1) return minWork ? shares[0].minWork : shares[0].work;
        if (shares.length === 0) return new Bignum(0);

        let near = this.sharechain.get(hash);
        let far = shares[shares.length - 1];

        let attepmts = shares.aggregate<BaseShare, Bignum>((c, n) => c instanceof BaseShare ? (minWork ? c.minWork.add(n.minWork) : c.work.add(n.work)) : c.add(minWork ? n.minWork : n.work)).sub(minWork ? far.minWork : far.work);

        let elapsedTime = near.info.timestamp - far.info.timestamp;
        elapsedTime = elapsedTime <= 0 ? 1 : elapsedTime;

        return attepmts.div(elapsedTime);
    }
}
