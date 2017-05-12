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
import { GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import * as assert from 'assert';

export class ShareGenerator {

    static MAX_TARGET: Bignum;
    static MIN_TARGET: Bignum;
    static TARGET_LOOKBEHIND = 0;
    static PERIOD = 0;
    static BLOCKSPREAD = 1;
    static CALC_SHARES_LENGTH = 24 * 60 * 6;

    readonly sharechain = Sharechain.Instance;

    constructor(nodeAddress: string) {

    }

    generateTx(template: GetBlockTemplate, previousHash: string, desiredTarget: Bignum, desiredTxHashes: string[], knownTxs: Map<string, TransactionTemplate> = null) {
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
        console.log('maxbits', maxBits.toString(16));
        let bits = Algos.targetToBits(MathEx.clip(desiredTarget, preTarget3.div(30), preTarget3));


        let recentShares = Array.from(this.sharechain.subchain(previousHash, 100, 'backward'));

        let newTxHashes = new Array<string>();
        let newTxSize = 0;
        let txHashRefs = new Array<number>();
        let otherTxHashes = new Array<string>();

        let txHashesToThis = new Map<string, number[]>();

        for (let i = 0; i < recentShares.length; i++) {
            let txHashes = recentShares[i].info.newTransactionHashes;

            for (let j = 0; j < txHashes.length; j++) {
                let txHash = txHashes[j];
                if (txHashesToThis.has(txHash)) continue;

                txHashesToThis.set(txHash, [i + 1, j]); // shareCount, txCount
            }
        }

        for (let hash of desiredTxHashes) {
            let tuple = txHashesToThis.get(hash);

            if (!tuple && knownTxs) {
                let size = knownTxs.get(hash).data.length / 2;
                if (size + newTxSize > 50000) break;
                newTxSize += size;
                newTxHashes.push(hash);
                tuple = [0, newTxHashes.length - 1];
            }

            otherTxHashes.push(hash);
            if (!tuple) continue;

            for (let item of tuple) txHashRefs.push(item);// transaction_hash_refs.extend(this)
        }

        let payableShares = Array.from(this.sharechain.subchain(previousHash, Math.max(0, Math.min(this.sharechain.length, ShareGenerator.CALC_SHARES_LENGTH))));
        payableShares.select(s => {
            return {
                pubkey: s.info.data.pubkeyHash,
                weight: new Bignum(65535).sub(s.info.data.donation).mul(s.work),
                total: new Bignum(65535).mul(s.work),
                donation: s.work.mul(s.info.data.donation)
            }
        }).groupBy(item => item.pubkey).toArray();
        // payableShares.reduce<Bignum>((p, c) => p.add(c.work), new Bignum(0));

        // let coinbaseScriptSig1 = Buffer.concat([
        //     Utils.serializeScriptSigNumber(template.height),
        //     Buffer.from(template.coinbaseaux.flags, 'hex'),
        // ]);
    }

    calcGlobalAttemptsPerSecond(hash: string, lookBehind: number, minWork = false) {

        let shares = Array.from(kinq.toLinqable(this.sharechain.subchain(hash, lookBehind, 'backward')));
        if (shares.length === 1) return minWork ? shares[0].minWork : shares[0].work;
        if (shares.length === 0) return new Bignum(0);

        let near = this.sharechain.get(hash);
        let far = shares[shares.length - 1];

        let attepmts = shares.reduce<Bignum>((p, c) => p.add(minWork ? c.minWork : c.work), new Bignum(0)).sub(minWork ? far.minWork : far.work);

        let elapsedTime = near.info.timestamp - far.info.timestamp;
        elapsedTime = elapsedTime <= 0 ? 1 : elapsedTime;

        return attepmts.div(elapsedTime);
    }
}
