/*
 * Created on Wed Apr 12 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";
import BufferWriter from "../../../misc/BufferWriter";
import * as utils from '../../../misc/Utils';
import BufferReader from "../../../misc/BufferReader";
import * as BigNum from 'bignum';

export type TypeSharereq = {
    id: number,
    hashes: string[],
    parents?: number, // If it's 0, it means no other shares needed.
    stops?: string[],
}

export default class Sharereq extends Payload {
    id: BigNum; // 256 bits
    hashes: string[]; // list 256bits
    parents: number; // var int
    stops: string[]; // hash list

    toBuffer() {
        return Buffer.concat([
            this.id.toBuffer({ size: 32, endian: 'little' }),
            BufferWriter.writeList(this.hashes.map(h => utils.uint256BufferFromHash(h))),
            BufferWriter.writeVarNumber(this.parents),
            BufferWriter.writeList(this.stops.map(h => utils.uint256BufferFromHash(h)))
        ]);
    }

    static fromObject(obj: TypeSharereq) {
        let req = new Sharereq();
        req.id = new BigNum(obj.id);
        req.hashes = obj.hashes;
        req.parents = obj.parents || 0;
        req.stops = obj.stops || [];
        return req;
    }

    static fromBuffer(data: Buffer) {
        let reader = new BufferReader(data);
        let req = new Sharereq();
        req.id = reader.readNumber(32);
        req.hashes = reader.readList(32).map(b => utils.hexFromReversedBuffer(b));
        req.parents = reader.readVarNumber();
        req.stops = reader.readList(32).map(b => utils.hexFromReversedBuffer(b));
        return req;
    }
}