/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Sharechain from "../p2p/shares/Sharechain";
import * as Utils from '../../misc/Utils';

export class ShareGenerator {

    static MAX_TARGET = 0;
    static TARGET_LOOKBEHIND = 0;

    readonly sharechain = Sharechain.Instance;

    constructor(nodeAddress: string) {

    }

    generateTx() {
        let preTarget, preTarget2, preTarget3 = 0;
        let previousShare = this.sharechain.newest.hasValue() ? this.sharechain.get(this.sharechain.newest.value.info.data.previousShareHash) : null;

        if (previousShare.info.absheight < ShareGenerator.TARGET_LOOKBEHIND) {
            preTarget3 = ShareGenerator.MAX_TARGET;
        } else {

        }
    }

    getPoolAttemptsPerSecond(hash: string, length: number, minWork = false, interger = false) {
        let near = this.sharechain.get(hash);
        let far = this.sharechain.get(near.info.absheight - length - 1);

        
    }
}
