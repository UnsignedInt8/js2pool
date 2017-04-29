/*
 * Created on Mon Apr 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as utils from '../../../misc/Utils';
import BufferReader from "../../../misc/BufferReader";
import { bitsToTarget } from "../../../core/Algos";
import { Algos } from "../../../core/Algos";

export default class SmallBlockHeader {
    version: number; // var int
    previousBlockHash: string; // 256 bits
    timestamp: number; // 4 bytes in seconds
    bits: number; // 4 bytes
    nonce: number; // 4 bytes

    target() {
        return bitsToTarget(this.bits);
    }

    toBuffer() {
        let verBuf = utils.varIntBuffer(this.version);
        let hashBuf = utils.uint256BufferFromHash(this.previousBlockHash);
        let timeBuf = Buffer.alloc(4);
        timeBuf.writeUInt32LE(this.timestamp, 0);
        let bitsBuf = Buffer.alloc(4);
        bitsBuf.writeUInt32LE(this.bits, 0);
        let nonceBuf = Buffer.alloc(4);
        nonceBuf.writeUInt32LE(this.nonce, 0);
        return Buffer.concat([verBuf, hashBuf, timeBuf, bitsBuf, nonceBuf]);
    }

    static fromBuffer(data: Buffer) {
        return SmallBlockHeader.fromBufferReader(new BufferReader(data));
    }

    static fromBufferReader(reader: BufferReader) {
        let header = new SmallBlockHeader();
        header.version = reader.readVarNumber();
        header.previousBlockHash = reader.readReversedFixedString(32);
        header.timestamp = reader.readUInt32LE();
        header.bits = reader.readUInt32LE();
        header.nonce = reader.readUInt32LE();
        return header;
    }
}