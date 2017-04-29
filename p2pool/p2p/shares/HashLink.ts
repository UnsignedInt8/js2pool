/*
 * Created on Mon Apr 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import BufferReader from "../../../misc/BufferReader";
import BufferWriter from "../../../misc/BufferWriter";

export class HashLink {
    state: string; // fixed string, 256 bytes, 32 characters
    extra: number; // same as below, but 0 byte
    length: number; // var int

    toBuffer() {
        return Buffer.concat([
            BufferWriter.writeFixedString(this.state, 'hex'),
            BufferWriter.writeVarNumber(this.length),
        ]);
    }

    static fromBufferReader(reader: BufferReader) {
        let link = new HashLink();
        link.state = reader.readFixedString(32);
        link.length = reader.readVarNumber();
        return link;
    }
}