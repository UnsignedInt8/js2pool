/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Sharechain from "./Sharechain";
import * as Utils from '../../misc/Utils';
import * as kinq from 'kinq';
import * as Bignum from 'bignum';
import * as MathEx from '../../misc/MathEx';
import { BaseShare, NewShare, Share } from "../p2p/shares/index";
import * as Algos from "../../core/Algos";
import { GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import * as assert from 'assert';
import { PaymentCalculator } from "./PaymentCalculator";
import { SharechainHelper } from "./SharechainHelper";
import ShareInfo, { ShareData } from "../p2p/shares/ShareInfo";
import * as crypto from 'crypto';
import BufferWriter from "../../misc/BufferWriter";

export class ShareGenerator {

    static MAX_TARGET: Bignum;
    static MIN_TARGET: Bignum;
    static TARGET_LOOKBEHIND = 0;
    static PERIOD = 0;
    static BLOCKSPREAD = 1;
    static readonly COINBASE_NONCE_LENGTH = 8

    readonly sharechain = Sharechain.Instance;
    readonly paymentCalculator: PaymentCalculator;

    constructor(nodeAddress: string) {
        this.paymentCalculator = new PaymentCalculator(nodeAddress);
    }

    generateBits(fromShare: BaseShare | Share | NewShare, desiredTarget: Bignum) {
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
        let bits = Algos.targetToBits(MathEx.clip(desiredTarget, preTarget3.div(30), preTarget3));

        return { maxBits, bits };
    }

    generateNextShare(template: GetBlockTemplate, shareHash: string, desiredTarget: Bignum, desiredTxHashes: string[], knownTxs: Map<string, TransactionTemplate> = null) {
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
                let size = knownTxs.get(hash).data.length / 2; // convert hex string length to bytes length
                if (size + newTxSize > 50000) break;
                newTxSize += size;
                newTxHashes.push(hash);
                tuple = [0, newTxHashes.length - 1];
            }

            otherTxHashes.push(hash);

            if (!tuple) continue;
            for (let item of tuple) txHashRefs.push(item); // p2pool/data.py#177: transaction_hash_refs.extend(this)
        }

        let begin = Date.now();

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
        let segwitActivated = BaseShare.isSegwitActivated(shareinfo.data.desiredVersion);

        console.log('shareinfo ok');
        let { tx1, tx2 } = this.generateCoinbaseTx(template, coinbaseScriptSig1, payments, BaseShare.getRefHash(shareinfo, []));


        console.log('maxbits', maxBits.toString(16));
        console.log('far share hash', new Bignum(shareinfo.farShareHash, 16), );
    }

    generateCoinbaseTx(template: GetBlockTemplate, coinbaseScriptSig1: Buffer, payouts: Array<(Buffer | Bignum)[]>, shareInfo: Buffer) {

        let outputs = new Array<Buffer>();
        for (let [script, value] of payouts) {
            outputs.push(Buffer.concat([
                (<Bignum>value).toBuffer({ endian: 'little', size: 8 }),
                Utils.varIntBuffer((<Buffer>script).length),
                (<Buffer>script)
            ]));
        }

        let shareFingerprint = Buffer.concat([Buffer.from('6a28', 'hex'), shareInfo, Buffer.alloc(8, 0)]); // P2Pool last tx fingerprint
        outputs.push(Buffer.concat([
            Utils.packInt64LE(0),
            Utils.varIntBuffer(shareFingerprint.length),
            shareFingerprint,
        ]));
console.log('fingerprint ok');
        let txOutput = BufferWriter.writeList(outputs);

        let tx1 = Buffer.concat([
            Utils.packUInt32LE(1),

            // Tx Inputs
            Utils.varIntBuffer(1), // input count
            Utils.uint256BufferFromHash('00'), // previous tx hash
            Utils.packUInt32LE(Math.pow(2, 32) - 1), // previous tx output index 
            Utils.varIntBuffer(coinbaseScriptSig1.length + ShareGenerator.COINBASE_NONCE_LENGTH), // P2Pool always uses 8 bytes nonce
            coinbaseScriptSig1,
        ]);

        //
        // extra nonce here
        //

        let tx2 = Buffer.concat([
            Utils.packUInt32LE(0),  // Tx input sequence
            // Tx inputs end

            // Tx outputs
            txOutput,
            // Tx outputs end

            Utils.packUInt32LE(0), // Tx lock time
        ]);


        return { tx1, tx2 }
    }
}
