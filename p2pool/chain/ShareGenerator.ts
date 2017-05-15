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
import { PaymentCalculator } from "./PaymentCalculator";
import { SharechainHelper } from "./SharechainHelper";
import ShareInfo, { ShareData } from "../p2p/shares/ShareInfo";
import * as crypto from 'crypto';

export class ShareGenerator {

    static MAX_TARGET: Bignum;
    static MIN_TARGET: Bignum;
    static TARGET_LOOKBEHIND = 0;
    static PERIOD = 0;
    static BLOCKSPREAD = 1;

    readonly sharechain = Sharechain.Instance;
    paymentCalculator: PaymentCalculator;

    constructor(nodeAddress: string) {
        this.paymentCalculator = new PaymentCalculator(nodeAddress);
    }

    generateBits(fromShare: BaseShare, desiredTarget: Bignum) {
        let preTarget: Bignum, preTarget2: Bignum, preTarget3: Bignum;

        if (!fromShare || fromShare.info.absheight < ShareGenerator.TARGET_LOOKBEHIND) {
            preTarget3 = ShareGenerator.MAX_TARGET;
        } else {
            let attemptsPerSecond = SharechainHelper.calcGlobalAttemptsPerSecond(fromShare.hash, ShareGenerator.TARGET_LOOKBEHIND, true);
            preTarget = attemptsPerSecond.gt(0) ? Algos.POW2_256.div(attemptsPerSecond.mul(ShareGenerator.PERIOD)).sub(1) : Algos.POW2_256_SUB_1;
            preTarget2 = MathEx.clip(preTarget, fromShare.maxTarget.mul(9).div(10), fromShare.maxTarget.mul(11).div(10));
            preTarget3 = MathEx.clip(preTarget2, ShareGenerator.MIN_TARGET, ShareGenerator.MAX_TARGET);
        }

        let maxBits = Algos.targetToBits(preTarget3);
        console.log('maxbits', maxBits.toString(16));
        let bits = Algos.targetToBits(MathEx.clip(desiredTarget, preTarget3.div(30), preTarget3));

        return { maxBits, bits };
    }

    generateTx(template: GetBlockTemplate, shareHash: string, desiredTarget: Bignum, desiredTxHashes: string[], knownTxs: Map<string, TransactionTemplate> = null) {
        let lastShare = this.sharechain.get(shareHash);
        let { maxBits, bits } = this.generateBits(lastShare, desiredTarget);

        let recentShares = Array.from(this.sharechain.subchain(shareHash, 100, 'backward'));
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
        // let desiredWeight = new Bignum(65535).mul(ShareGenerator.BLOCKSPREAD).mul(Algos.targetToAverageAttempts(new Bignum(template.target, 16)));
        // let payableShares = kinq.toLinqable(this.sharechain.subchain(previousHash, ShareGenerator.CALC_SHARES_LENGTH)).skip(1);
        // let totalWeight = new Bignum(0);
        // let donationWeight = new Bignum(0);
        // let weights = new Map<string, Bignum>();

        // for (let share of payableShares) {
        //     let lastTotalWeight = totalWeight;
        //     totalWeight = totalWeight.add(share.totalWeight);
        //     donationWeight = donationWeight.add(share.donationWeight);

        //     let shareWeight = weights.get(share.info.data.pubkeyHash);

        //     if (shareWeight) {
        //         weights.set(share.info.data.pubkeyHash, shareWeight.add(share.weight));
        //         continue;
        //     }

        //     shareWeight = share.weight;

        //     if (totalWeight.gt(desiredWeight)) {
        //         totalWeight = desiredWeight;
        //         shareWeight = desiredWeight.sub(lastTotalWeight).div(65535).mul(share.weight).div(share.totalWeight.div(65535));
        //     }

        //     weights.set(share.info.data.pubkeyHash, shareWeight);
        // }

        let payments = this.paymentCalculator.calc(shareHash, template.coinbasevalue, template.target);
        if (payments.length === 0) { }
        console.log('elapse', Date.now() - begin);


        let coinbaseScriptSig1 = Buffer.concat([
            Utils.serializeScriptSigNumber(template.height),
            Buffer.from(template.coinbaseaux.flags, 'hex'),
        ]);







        let shareinfo = new ShareInfo();
        shareinfo.farShareHash = lastShare.info.absheight > 99 ? this.sharechain.get(lastShare.info.absheight - 99).hash : '0000000000000000000000000000000000000000000000000000000000000000';
        shareinfo.maxBits = maxBits;
        shareinfo.bits = bits;
        shareinfo.timestamp = lastShare ? MathEx.clip(Date.now() / 1000 | 0, lastShare.info.timestamp + 1, lastShare.info.timestamp + 2 * ShareGenerator.PERIOD - 1) : Date.now() / 1000 | 0;
        shareinfo.newTransactionHashes = newTxHashes;
        shareinfo.transactionHashRefs = txHashRefs;
        shareinfo.absheight = lastShare ? (lastShare.info.absheight + 1) % 4294967296 : 0
        shareinfo.abswork = (lastShare ? lastShare.info.abswork : new Bignum(0)).add(Algos.targetToAverageAttempts(Algos.bitsToTarget(bits))).mod(Algos.POW2_128);
        shareinfo.data = <ShareData>{
            previousShareHash: shareHash,
            coinbase: coinbaseScriptSig1.toString('hex'),
            nonce: Bignum.fromBuffer(crypto.randomBytes(4)).toNumber(),
            pubkeyHash: this.paymentCalculator.nodePubkey,
            subsidy: new Bignum(template.coinbasevalue),
            donation: 0,
            staleInfo: 0,
            desiredVersion: lastShare.SUCCESSOR ? (lastShare.SUCCESSOR.VOTING_VERSION || lastShare.VOTING_VERSION) : lastShare.VOTING_VERSION,
        }


    }


}
