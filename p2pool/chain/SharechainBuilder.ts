/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Sharechain from "./Sharechain";
import * as Utils from '../../misc/Utils';
import * as kinq from 'kinq';
import * as Bignum from 'bignum';
import * as MathEx from '../../misc/MathEx';
import { BaseShare, SegwitShare, Share } from "../p2p/shares/index";
import * as Algos from "../../core/Algos";
import { GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import * as assert from 'assert';
import * as fs from 'fs';
import { PaymentCalculator } from "./PaymentCalculator";
import { SharechainHelper } from "./SharechainHelper";
import ShareInfo, { ShareData } from "../p2p/shares/ShareInfo";
import * as crypto from 'crypto';
import BufferWriter from "../../misc/BufferWriter";
import { ShareVersionMapper, DONATION_SCRIPT_BUF, GENTX_BEFORE_REFHASH } from "../p2p/shares/BaseShare";
import { HashLink } from "../p2p/shares/HashLink";
import MerkleTree from "../../core/MerkleTree";
import { SmallBlockHeader } from "../p2p/shares/SmallBlockHeader";

export class SharechainBuilder {

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

    private estimateBits(fromShare: BaseShare, desiredTarget: Bignum) {
        let preTarget: Bignum, preTarget2: Bignum, preTarget3: Bignum;

        if (!fromShare || fromShare.info.absheight < SharechainBuilder.TARGET_LOOKBEHIND) {
            preTarget3 = SharechainBuilder.MAX_TARGET;
        } else {
            let attemptsPerSecond = SharechainHelper.calcGlobalAttemptsPerSecond(fromShare.hash, SharechainBuilder.TARGET_LOOKBEHIND, true);
            preTarget = attemptsPerSecond.gt(0) ? Algos.POW2_256.div(attemptsPerSecond.mul(SharechainBuilder.PERIOD)).sub(1) : Algos.POW2_256_SUB_1;
            preTarget2 = MathEx.clip(preTarget, fromShare.maxTarget.mul(9).div(10), fromShare.maxTarget.mul(11).div(10));
            preTarget3 = MathEx.clip(preTarget2, SharechainBuilder.MIN_TARGET, SharechainBuilder.MAX_TARGET);
        }

        let maxBits = Algos.targetToBits(preTarget3);
        let bits = Algos.targetToBits(MathEx.clip(desiredTarget, preTarget3.div(30), preTarget3));

        return { maxBits, bits };
    }

    buildMiningComponents(template: GetBlockTemplate, shareHash: string, desiredTarget: Bignum, desiredTxHashes: string[], knownTxs: Map<string, TransactionTemplate> = null) {
        let lastShare = this.sharechain.get(shareHash);
        let { maxBits, bits } = this.estimateBits(lastShare, desiredTarget);
        let begin = Date.now();

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

        console.log('newTxHashes', newTxHashes.length, otherTxHashes.length, knownTxs.size);

        let payments = this.paymentCalculator.calc(shareHash, template.coinbasevalue, template.target);
        if (payments.length === 0) { }
        console.log('elapse', Date.now() - begin);


        let coinbaseScriptSig1 = Buffer.concat([
            Utils.serializeScriptSigNumber(template.height),
            Buffer.from(template.coinbaseaux.flags, 'hex'),
        ]);

        let shareInfo = new ShareInfo();
        let farShare = lastShare.info.absheight > 99 ? this.sharechain.get(lastShare.info.absheight - 99) : null;
        shareInfo.farShareHash = farShare ? farShare.hash : '0000000000000000000000000000000000000000000000000000000000000000';
        shareInfo.maxBits = maxBits;
        shareInfo.bits = bits;
        shareInfo.timestamp = lastShare ? MathEx.clip(Date.now() / 1000 | 0, lastShare.info.timestamp + 1, lastShare.info.timestamp + 2 * SharechainBuilder.PERIOD - 1) : Date.now() / 1000 | 0;
        shareInfo.newTransactionHashes = newTxHashes;
        shareInfo.transactionHashRefs = txHashRefs;
        shareInfo.absheight = lastShare ? (lastShare.info.absheight + 1) % 4294967296 : 0
        shareInfo.abswork = (lastShare ? lastShare.info.abswork : new Bignum(0)).add(Algos.targetToAverageAttempts(Algos.bitsToTarget(bits))).mod(Algos.POW2_128);
        shareInfo.data = <ShareData>{
            previousShareHash: shareHash,
            coinbase: coinbaseScriptSig1.toString('hex'),
            nonce: Bignum.fromBuffer(crypto.randomBytes(4)).toNumber(),
            pubkeyHash: this.paymentCalculator.nodePubkey,
            subsidy: new Bignum(template.coinbasevalue),
            donation: 0,
            staleInfo: 0,
            desiredVersion: lastShare.SUCCESSOR ? (lastShare.SUCCESSOR.VOTING_VERSION || lastShare.VOTING_VERSION) : lastShare.VOTING_VERSION,
        }

        let segwitActivated = BaseShare.isSegwitActivated(shareInfo.data.desiredVersion);
        if (segwitActivated) {
            // TODO segwit
        }

        let { tx1, tx2, shareCoinbaseTx } = this.buildCoinbaseTx(template, coinbaseScriptSig1, payments, shareInfo);
        let merkleLink = (new MerkleTree([null].concat(desiredTxHashes.map(hash => Utils.uint256BufferFromHash(hash)))).steps);

        console.log('maxbits', maxBits.toString(16));
        console.log('far share hash', new Bignum(shareInfo.farShareHash, 16), );
        // console.log(fs.writeFile('/tmp/' + shareInfo.absheight, shareCoinbaseTx.toString('hex'), () => { }));
        // console.log('coinbase tx length', shareCoinbaseTx.toString('hex').length);
        console.log('hash link', HashLink.fromPrefix(shareCoinbaseTx.slice(0, -32 - 8 - 4), GENTX_BEFORE_REFHASH));
        return { shareInfo, merkleLink, tx1, tx2, shareCoinbaseTx, maxBits, bits, version: lastShare.VERSION };
    }

    // As SHA256 by js is so slow, delay this function calling
    buildShare(version: number, minHeader: SmallBlockHeader, shareInfo: ShareInfo, shareCoinbaseTx: Buffer, merkleLink: Buffer[], coinbaseNonce: string) {
        let share = new ShareVersionMapper[version]() as BaseShare;
        share.info = shareInfo;
        share.refMerkleLink = [];
        share.hashLink = HashLink.fromPrefix(shareCoinbaseTx.slice(0, -32 - 8 - 4), GENTX_BEFORE_REFHASH);
        share.merkleLink = merkleLink;
        share.minHeader = minHeader;
        share.lastTxoutNonce = new Bignum(coinbaseNonce, 16);

        return share;
    }

    private buildCoinbaseTx(template: GetBlockTemplate, coinbaseScriptSig1: Buffer, payouts: Array<(Buffer | Bignum)[]>, shareInfo: ShareInfo) {

        let outputs = new Array<Buffer>();
        for (let [script, value] of payouts) {
            outputs.push(Buffer.concat([
                (<Bignum>value).toBuffer({ endian: 'little', size: 8 }),
                Utils.varIntBuffer((<Buffer>script).length),
                (<Buffer>script)
            ]));
        }

        let shareFingerprint = Buffer.concat([Buffer.from('6a28', 'hex'), BaseShare.getRefHash(shareInfo, []), Buffer.alloc(8, 0)]); // P2Pool last tx fingerprint: OP_RETURN N/A shareinfo lasttxnonce(64bits, 0)
        outputs.push(Buffer.concat([
            Utils.packInt64LE(0),
            Utils.varIntBuffer(shareFingerprint.length),
            shareFingerprint,
        ]));

        // https://bitcointalk.org/index.php?topic=1676471.0;prev_next=prev
        // if (template.default_witness_commitment !== undefined) {
        //     let witness_commitment = Buffer.from(template.default_witness_commitment, 'hex');
        //     outputs.unshift(Buffer.concat([
        //         Utils.packInt64LE(0),
        //         Utils.varIntBuffer(witness_commitment.length),
        //         witness_commitment
        //     ]));
        // }


        let tx1 = Buffer.concat([
            Utils.packUInt32LE(1), // version

            // Tx Inputs
            Utils.varIntBuffer(1), // input count
            Utils.uint256BufferFromHash('00'), // previous tx hash
            Utils.packUInt32LE(Math.pow(2, 32) - 1), // previous tx output index 
            Utils.varIntBuffer(coinbaseScriptSig1.length + SharechainBuilder.COINBASE_NONCE_LENGTH), // P2Pool always uses 8 bytes nonce
            coinbaseScriptSig1,
        ]);

        //
        // extra nonce here
        //

        let tx2 = Buffer.concat([
            Utils.packUInt32LE(0xFFFFFFFF),  // Tx input sequence
            // Tx inputs end

            // Tx outputs
            BufferWriter.writeList(outputs),
            // Tx outputs end

            Utils.packUInt32LE(0), // Tx lock time
        ]);



        let shareTx1 = Buffer.concat([
            Utils.packUInt32LE(1), // version

            // Tx Inputs
            Utils.varIntBuffer(1), // input count
            Utils.uint256BufferFromHash('00'), // previous tx hash
            Utils.packUInt32LE(Math.pow(2, 32) - 1), // previous tx output index 
            Utils.varIntBuffer(coinbaseScriptSig1.length), // P2Pool always uses 8 bytes nonce
            coinbaseScriptSig1,
        ]);


        return { tx1, tx2, shareCoinbaseTx: Buffer.concat([shareTx1, tx2]) };
    }
}
