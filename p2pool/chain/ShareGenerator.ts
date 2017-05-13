/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Sharechain from "./Sharechain";
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

    readonly sharechain = Sharechain.Instance;
    nodeAddress: string;

    constructor(nodeAddress: string = '1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9') {
        this.nodeAddress = nodeAddress;
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

        let begin = Date.now();
        let desiredWeight = new Bignum(65535).mul(ShareGenerator.BLOCKSPREAD).mul(Algos.targetToAverageAttempts(new Bignum(template.target, 16)));
        // let payableShares = kinq
        //     .toLinqable(this.sharechain.subchain(previousHash, Math.max(0, Math.min(this.sharechain.length, ShareGenerator.CALC_SHARES_LENGTH))))
        //     .groupBy(i => i.info.data.pubkeyHash)
        //     .toArray();
        let payableShares = Array.from(this.sharechain.subchain(previousHash, Math.max(0, Math.min(this.sharechain.length, 24 * 60 * 6))));
        let totalWeight = payableShares[0].totalWeight;
        let donationWeight = payableShares[0].donationWeight;// new Bignum(0);
        let weightList = new Map<string, Bignum>();
        weightList.set(payableShares[0].info.data.pubkeyHash, payableShares[0].weight);

        for (let share of payableShares.skip(1)) {
            totalWeight = totalWeight.add(share.totalWeight);
            donationWeight = donationWeight.add(share.donationWeight);

            let weight = weightList.get(share.info.data.pubkeyHash);
            if (weight) {
                weightList.set(share.info.data.pubkeyHash, weight.add(share.weight));
                continue;
            }

            weightList.set(share.info.data.pubkeyHash, share.weight);
        }

        // let nodeWeight = weightList.get()

        for (let [pubkeyHash, weight] of weightList) {

        }

        console.log('elapse', Date.now() - begin);
        console.log('total', totalWeight);
        console.log('donation', donationWeight, donationWeight.toNumber() / totalWeight.toNumber());
        console.log('count:', weightList.size, /*Array.from(weightList.values()).reduce((p, c) => p.add(c))*/);
        console.log('desired', desiredWeight);
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
