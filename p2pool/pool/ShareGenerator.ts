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
import * as Algos from "../../core/Algos";
import { GetBlockTemplate } from "../../core/DaemonWatcher";

export class ShareGenerator {

    static MAX_TARGET: Bignum;
    static MIN_TARGET: Bignum;
    static TARGET_LOOKBEHIND = 0;
    static PERIOD = 0;

    readonly sharechain = Sharechain.Instance;

    constructor(nodeAddress: string) {

    }

    generateTx(template: GetBlockTemplate, previousHash: string, desiredTarget: Bignum) {
        let preTarget: Bignum, preTarget2: Bignum, preTarget3: Bignum;
        let lastShare = this.sharechain.get(previousHash);

        if (!lastShare || lastShare.info.absheight < ShareGenerator.TARGET_LOOKBEHIND) {
            preTarget3 = ShareGenerator.MAX_TARGET;
        } else {
            let attemptsPerSecond = this.calcGlobalAttemptsPerSecond(previousHash, ShareGenerator.TARGET_LOOKBEHIND, true);
            preTarget = attemptsPerSecond.gt(0) ? Algos.POW2_256.div(attemptsPerSecond.mul(ShareGenerator.PERIOD)).sub(1) : Algos.POW2_256_SUB_1;
            preTarget2 = MathEx.clip(preTarget, lastShare.maxTarget.mul(9).div(10), lastShare.maxTarget.mul(11).div(10));
            preTarget3 = MathEx.clip(preTarget2, ShareGenerator.MIN_TARGET, ShareGenerator.MAX_TARGET);
        }

        let maxBits = Algos.targetToBits(preTarget3);
        let bits = Algos.targetToBits(MathEx.clip(desiredTarget, preTarget3.div(30), preTarget3));
        console.log('bits', bits.toString(16));

        let recentShares = this.sharechain.subchain(previousHash, 100);

        let coinbaseScriptSig1 = Buffer.concat([
            Utils.serializeScriptSigNumber(template.height),
            Buffer.from(template.coinbaseaux.flags, 'hex'),
        ]);
    }

    calcGlobalAttemptsPerSecond(hash: string, lookBehind: number, minWork = false) {

        let shares = Array.from(kinq.toLinqable(this.sharechain.subchain(hash, lookBehind, 'backward')));
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
