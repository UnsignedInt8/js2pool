/*
 * Created on Thu Apr 13 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as utils from './Utils';
import * as Bignum from 'bignum';

export default class BufferWriter {

    static writeVarString(str: string, encoding = 'utf8') {
        return utils.varStringBuffer(str, encoding);
    }

    static writeFixedString(str: string, encoding = 'utf8') {
        return Buffer.from(str, encoding);
    }

    static writeReversedFixedString(str: string, encoding = 'hex') {
        let buf = Buffer.from(str, encoding);
        return utils.reverseBuffer(buf);
    }

    static writeVarNumber(num: number) {
        return utils.varIntBuffer(num);
    }

    /**
     * 
     * @param num 
     * @param size the size of num, in bytes 
     */
    static writeNumber(num: number, size: number, endian = 'little') {
        return (new Bignum(num)).toBuffer({ endian, size });
    }

    static writeUInt8(num: number) {
        let buf = Buffer.alloc(1);
        buf.writeUInt8(num, 0);
        return buf;
    }

    static writeUInt16LE(num: number) {
        let buf = Buffer.alloc(2);
        buf.writeUInt16LE(num, 0);
        return buf;
    }

    static writeUInt16BE(num: number) {
        let buf = Buffer.alloc(2);
        buf.writeUInt16BE(num, 0);
        return buf;
    }

    static writeUInt32LE(num: number) {
        let buf = Buffer.alloc(4);
        buf.writeUInt32LE(num, 0);
        return buf;
    }

    static writeUInt32BE(num: number) {
        let buf = Buffer.alloc(4);
        buf.writeUInt32BE(num, 0);
        return buf;
    }

    static writeList(items: Buffer[]) {
        let countBuf = utils.varIntBuffer(items.length);
        return Buffer.concat([countBuf, Buffer.concat(items)]);
    }

    static writeVarIntList(items: number[], mul = 1) {
        let buf = items.map(i => utils.varIntBuffer(i));
        buf.unshift(utils.varIntBuffer(items.length / mul));
        return Buffer.concat(buf);
    }

    static writeFloatLE(num: number) {
        let buf = Buffer.alloc(4);
        buf.writeFloatLE(num, 0);
        return buf;
    }

    static writeFloatBE(num: number) {
        let buf = Buffer.alloc(4);
        buf.writeFloatBE(num, 0);
        return buf;
    }

}