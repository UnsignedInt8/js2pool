/*
 * Created on Sat Apr 08 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";

export type TypePing = {

}

export class Ping extends Payload {
    toBuffer() {
        return Buffer.from([]);
    }

    static fromObject(obj: TypePing) {
        return new Ping();
    }

    static fromBuffer(data: Buffer) {
        return new Ping();
    }
}

/**
 * New message for js2pool
 */
export class Pong extends Ping {

}