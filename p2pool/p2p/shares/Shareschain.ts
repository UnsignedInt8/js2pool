/*
 * Created on Sun Apr 16 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { BaseShare } from "./index";

export default class Shareschain {
    private shares = new Map<string, BaseShare>();

    hashes() {
        return this.shares.keys();
    }

    contains(hash: string) {
        return this.shares.has(hash);
    }

    add(share: BaseShare) {
        this.shares.set(share.hash, share);
    }
}