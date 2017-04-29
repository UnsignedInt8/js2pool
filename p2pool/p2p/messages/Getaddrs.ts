/*
 * Created on Sun Apr 09 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";

export type TypeGetaddrs = {
    count: number;
}

export default class Getaddrs extends Payload {

    count: number; // 4 bytes

    toBuffer(): Buffer {
        let buf = Buffer.alloc(4);
        buf.writeUInt32LE(this.count, 0);
        return buf;
    }

    static fromBuffer(data: Buffer): Getaddrs {
        let count = data.readUInt32LE(0);
        let getaddrs = new Getaddrs();
        getaddrs.count = count;
        return getaddrs;
    }

    static fromObject(obj: TypeGetaddrs): Getaddrs {
        let getaddrs = new Getaddrs();
        getaddrs.count = obj.count;
        return getaddrs;
    }
}