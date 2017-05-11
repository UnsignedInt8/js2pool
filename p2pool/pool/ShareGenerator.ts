/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Sharechain from "../p2p/shares/Sharechain";
import * as Utils from '../../misc/Utils';
import * as Bignum from 'bignum';
import { BaseShare } from "../p2p/shares/index";
import { POW2_256, POW2_256_SUB_1 } from "../../core/Algos";

export class ShareGenerator {

    static MAX_TARGET: Bignum;
    static TARGET_LOOKBEHIND = 0;
    static PERIOD = 0;

    readonly sharechain = Sharechain.Instance;

    constructor(nodeAddress: string) {

    }

    generateTx() {
        let preTarget, preTarget2, preTarget3: Bignum;
        let lastShare = this.sharechain.newest.hasValue() ? /*this.sharechain.get(this.sharechain.newest.value.hash)*/ this.sharechain.newest.value : null;

        if (!lastShare || lastShare.info.absheight < ShareGenerator.TARGET_LOOKBEHIND) {
            preTarget3 = ShareGenerator.MAX_TARGET;
        } else {
            let attemptsPerSecond = this.calcGlobalAttemptsPerSecond(lastShare.hash, ShareGenerator.TARGET_LOOKBEHIND, true, true);
            preTarget = attemptsPerSecond.gt(0) ? POW2_256.div(attemptsPerSecond.mul(ShareGenerator.PERIOD)).sub(1) : POW2_256_SUB_1;
            
        }
    }

    calcGlobalAttemptsPerSecond(hash: string, length: number, minWork = false, interger = false) {
        let near = this.sharechain.get(hash);
        let far = this.sharechain.get(near.info.absheight - length);

        let attepmts = Array.from(this.sharechain.subchain(hash, length, 'backward')).aggregate<BaseShare, Bignum>((c, n) => minWork ? c.minWork.add(n.minWork) : c.work.add(n.work));
        let elapsedTime = Math.max(near.info.timestamp - far.info.timestamp, 1);

        return attepmts.div(elapsedTime);
    }
}
