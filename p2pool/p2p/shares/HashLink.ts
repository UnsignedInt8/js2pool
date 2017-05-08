/*
 * Created on Mon Apr 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import BufferReader from "../../../misc/BufferReader";
import BufferWriter from "../../../misc/BufferWriter";
import SHA256 from "../../../core/SHA256";
import * as crypto from 'crypto';

export class HashLink {
    state: Buffer; // fixed string, 256 bytes, 32 characters
    extra: Buffer; // same as below, but 0 byte
    length: number; // var int

    toBuffer() {
        return Buffer.concat([
            this.state,
            BufferWriter.writeVarNumber(this.length),
        ]);
    }

    check(data: Buffer, constEnding: Buffer = Buffer.alloc(0)) {
        let extraLength = this.length % (512 / 8);
        let extra = Buffer.concat([this.extra, constEnding]).slice(this.extra.length + constEnding.length - extraLength);
        return crypto.createHash('sha256').update(new SHA256(data, this.state, extra, 8 * this.length).digest()).digest();
    }

    static fromObject(obj: any){
        let hashlink = new HashLink();
        hashlink = Object.assign(hashlink, obj);
        return hashlink as HashLink;
    }

    static fromBufferReader(reader: BufferReader) {
        let link = new HashLink();
        link.state = reader.read(32);
        link.length = reader.readVarNumber();
        link.extra = Buffer.alloc(0);
        return link;
    }

    static fromPrefix(prefix: Buffer, constEnding: Buffer = Buffer.alloc(0)) {
        let x = new SHA256(prefix);
        let hl = new HashLink();
        hl.state = x.state;
        hl.extra = x.buf.slice(0, Math.max(0, x.buf.length - constEnding.length));
        hl.length = x.length / 8;
        return hl;
    }

}