/*
 * Created on Mon Apr 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import BufferReader from '../../../misc/BufferReader';
import * as Bignum from 'bignum';
import * as utils from '../../../misc/Utils';
import BufferWriter from "../../../misc/BufferWriter";
import { bitsToTarget } from "../../../core/Algos";
import { BaseShare } from "./BaseShare";
import { TransactionTemplate } from "../../../core/DaemonWatcher";

type Segwit = {
    txidMerkleLink: {
        branch: Buffer[], // hash list
        index?: number, // 0 bit, always 0
    },
    wtxidMerkleRoot: Buffer,// 'ffffffffffffffffffffffffffffffff', // 256 bytes
};

type ShareData = {
    previousShareHash: string, // 256 bits
    coinbase: string, // var string
    nonce: number, // 32 bits
    pubkeyHash: string, // 160 bits
    subsidy: Bignum, // 64 bits
    donation: number, // 16 bits
    staleInfo: number, // 8 bits {0: None, 253: 'orphan', 254: 'doa'}
    desiredVersion: number, // var int
};

export default class ShareInfo {
    data: ShareData;
    segwit?: Segwit;

    newTransactionHashes: string[];
    transactionHashRefs: number[];//{ shareCount: number, txCount: number }[];  //pairs of share_count, tx_count
    farShareHash: string; // 256 bits
    maxBits: number; // 32 bits
    bits: number; // 32 bits
    timestamp: number; // 32 bits
    absheight: number; // 32 bits
    abswork: string; // 128 bits

    toBuffer() {
        let dataBuf = Buffer.concat([
            BufferWriter.writeReversedFixedString(this.data.previousShareHash),
            BufferWriter.writeVarString(this.data.coinbase, 'hex'),
            BufferWriter.writeUInt32LE(this.data.nonce),
            BufferWriter.writeFixedString(this.data.pubkeyHash),
            this.data.subsidy.toBuffer({ size: 8, endian: 'little' }),
            BufferWriter.writeUInt16LE(this.data.donation),
            BufferWriter.writeUInt8(this.data.staleInfo),
            BufferWriter.writeVarNumber(this.data.desiredVersion),
        ]);

        let segBuf = Buffer.alloc(0);
        if (this.segwit) {
            let txidMerkleLink = BufferWriter.writeList(this.segwit.txidMerkleLink.branch);
            segBuf = Buffer.concat([txidMerkleLink, this.segwit.wtxidMerkleRoot]);
        }

        return Buffer.concat([
            dataBuf,
            segBuf,
            BufferWriter.writeList(this.newTransactionHashes.map(h => utils.uint256BufferFromHash(h))),
            BufferWriter.writeVarIntList(this.transactionHashRefs, 2),
            BufferWriter.writeReversedFixedString(this.farShareHash),
            BufferWriter.writeUInt32LE(this.maxBits),
            BufferWriter.writeUInt32LE(this.bits),
            BufferWriter.writeUInt32LE(this.timestamp),
            BufferWriter.writeUInt32LE(this.absheight),
            BufferWriter.writeReversedFixedString(this.abswork),
        ]);
    }

    extractTxHashRefs() {
        let tuples = new Array<{ shareCount: number, txCount: number }>();
        for (let i = 0; i < this.transactionHashRefs.length; i += 2) {
            tuples.push({ shareCount: this.transactionHashRefs[i], txCount: this.transactionHashRefs[i + 1] });
        }
        return tuples;
    }

    static fromObject(obj: any) {
        let info = new ShareInfo();
        info = Object.assign(info, obj);
        return info as ShareInfo;
    }

    static fromBufferReader(reader: BufferReader, segwitActivated: boolean) {
        let info = new ShareInfo();
        info.data = {
            previousShareHash: reader.readReversedFixedString(32),
            coinbase: reader.readVarString(),
            nonce: reader.readUInt32LE(),
            pubkeyHash: reader.readFixedString(20).toLowerCase(),
            subsidy: reader.readNumber(8),
            donation: reader.readUInt16LE(),
            staleInfo: reader.readUInt8(),
            desiredVersion: reader.readVarNumber(),
        };

        if (segwitActivated) {
            info.segwit = {
                txidMerkleLink: {
                    branch: reader.readList(32),
                    index: 0
                },
                wtxidMerkleRoot: reader.read(32),
            };
        }

        info.newTransactionHashes = reader.readList(32).map(utils.hexFromReversedBuffer);
        info.transactionHashRefs = reader.readVarIntList(2);
        info.farShareHash = reader.readReversedFixedString(32);
        info.maxBits = reader.readUInt32LE();
        info.bits = reader.readUInt32LE();
        info.timestamp = reader.readUInt32LE();
        info.absheight = reader.readUInt32LE();
        info.abswork = reader.readReversedFixedString(16); // reader.read(16).toString('hex');
        return info;
    }
}