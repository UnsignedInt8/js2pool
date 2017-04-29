/*
 * Created on Sat Apr 08 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";

export type TypeAddrme = {
    port: number
}

export default class Addrme extends Payload {

    port: number; // 2 bytes

    toBuffer(): Buffer {
        let addrme = Buffer.alloc(2);
        addrme.writeUInt16LE(this.port, 0);
        return addrme;
    }

    static fromObject(obj: TypeAddrme) {
        let addrMe = new Addrme();
        addrMe.port = obj.port;
        return addrMe;
    }

    static fromBuffer(data: Buffer) {
        let addrMe = new Addrme();
        addrMe.port = data.readUInt16LE(0);
        return addrMe;
    }
}