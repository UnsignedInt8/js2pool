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
        let preHashBuf = utils.uint256BufferFromHash(this.previousBlockHash);
        let timeBuf = Buffer.alloc(4);
        timeBuf.writeUInt32LE(this.timestamp, 0);
        let bitsBuf = Buffer.alloc(4);
        bitsBuf.writeUInt32LE(this.bits, 0);
        let nonceBuf = Buffer.alloc(4);
        nonceBuf.writeUInt32LE(this.nonce, 0);
        return Buffer.concat([verBuf, preHashBuf, timeBuf, bitsBuf, nonceBuf]);
    }

    calculateHash(merkleRoot: Buffer) {
        return utils.sha256d(this.buildHeader(merkleRoot));
    }

    buildHeader(merkleRoot: Buffer) {
        let header = Buffer.alloc(80);
        let position = 0;
        header.writeUInt32LE(this.version, position);
        utils.uint256BufferFromHash(this.previousBlockHash).copy(header, position += 4);
        merkleRoot.copy(header, position += 32);
        header.writeUInt32LE(this.timestamp, position += 32);
        header.writeUInt32LE(this.bits, position += 4);
        header.writeUInt32LE(this.nonce, position += 4);
        return header;
    }

    static fromObject(obj: any) {
        let header = new SmallBlockHeader();
        header = Object.assign(header, obj);
        return header;
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