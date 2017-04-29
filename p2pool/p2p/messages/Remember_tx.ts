/*
 * Created on Mon Apr 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";
import * as utils from '../../../misc/Utils';
import * as bitcoinjs from 'bitcoinjs-lib';
import { Transaction } from "bitcoinjs-lib";

type TypeRemember_tx = {
    hashes: string[],
    txs: Transaction[],
}

export default class Remember_tx extends Payload {
    txHashes: string[];
    txs: Transaction[];

    toBuffer(): Buffer {
        let hashCountBuf = [utils.varIntBuffer(this.txHashes.length)];
        let hashes = this.txHashes.map(h => utils.uint256BufferFromHash(h));
        let txsCountBuf = [utils.varIntBuffer(this.txs.length)];
        let txsBuf = this.txs.map(tx => tx.toBuffer());

        return Buffer.concat(hashCountBuf.concat(hashes).concat(txsCountBuf).concat(txsBuf));
    }

    static fromObject(obj: TypeRemember_tx) {
        let rtx = new Remember_tx();
        rtx.txHashes = obj.hashes;
        rtx.txs = obj.txs;
        return rtx;
    }

    static fromBuffer(data: Buffer) {
        let { value: hashCount, offset: hashCountOffset, size: hashCountSize } = utils.varBufferIntLength(data);
        let offset = hashCountOffset + hashCountSize;

        let hashes = new Array<string>();
        while (offset < hashCount * 32 + 1) {
            hashes.push(utils.hexFromReversedBuffer(data.slice(offset, offset + 32)));
            offset += 32;
        }

        let { value: txCount, offset: txCountOffset, size: txCountSize } = utils.varBufferIntLength(data.slice(offset));
        offset += txCountOffset + txCountSize;

        let txs = new Array<Transaction>();

        while (txs.length < txCount) {
            let tx = Transaction.fromBuffer(data.slice(offset), true);
            offset += tx.byteLength();
            txs.push(tx);
        }

        let obj = new Remember_tx();
        obj.txHashes = hashes;
        obj.txs = txs;
        return obj;
    }
}