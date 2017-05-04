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

    toBufferParts() {
        let verBuf = utils.varIntBuffer(this.version);
        let preHashBuf = utils.uint256BufferFromHash(this.previousBlockHash);
        let timeBuf = Buffer.alloc(4);
        timeBuf.writeUInt32LE(this.timestamp, 0);
        let bitsBuf = Buffer.alloc(4);
        bitsBuf.writeUInt32LE(this.bits, 0);
        let nonceBuf = Buffer.alloc(4);
        nonceBuf.writeUInt32LE(this.nonce, 0);
        return [verBuf, preHashBuf, timeBuf, bitsBuf, nonceBuf];
    }

    toBuffer() {
        return Buffer.concat(this.toBufferParts());
    }

    calculateHash(merkleRoot: Buffer) {
        // let parts = this.toBufferParts();
        // parts.splice(2, 0, merkleRoot);
        // return utils.sha256d(Buffer.concat(parts));
        return utils.sha256d(this.buildHeader(merkleRoot));
    }

    buildHeader(merkleRoot: Buffer) {
        let header = Buffer.alloc(80);
        let position = 0;
        header.writeUInt32BE(this.nonce, position);
        header.writeUInt32BE(this.bits, position += 4);
        header.writeUInt32BE(this.timestamp, position += 4);
        // header.write(merkleRoot, position += 4, 32, 'hex');
        merkleRoot.copy(header, position + 4);
        header.write(this.previousBlockHash, position += 32, 32, 'hex');
        header.writeUInt32BE(this.version, position + 32);
        header = utils.reverseBuffer(header);
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