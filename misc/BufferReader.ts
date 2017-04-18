/*
 * Created on Wed Apr 12 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as BigNum from 'bignum';
import * as utils from './Utils';

export default class BufferReader {
    offset: number = 0;
    private data: Buffer;

    constructor(data: Buffer) {
        this.data = data;
    }

    readVarString(encoding = 'hex') {
        let { value: str, offset, size } = utils.varBufferStringLength(this.data.slice(this.offset), encoding);
        this.offset += offset + size;
        return str;
    }

    readFixedString(size: number, encoding = 'hex') {
        let str = this.data.slice(this.offset, this.offset + size).toString(encoding);
        this.offset += size;
        return str;
    }

    readReversedFixedString(size: number, encoding = 'hex') {
        let dat = this.data.slice(this.offset, this.offset + size);
        this.offset += size;
        return utils.reverseBuffer(dat).toString(encoding);
    }

    readVarNumber() {
        let { value: num, offset, size } = utils.varBufferIntLength(this.data.slice(this.offset));
        this.offset += offset + size;
        return num;
    }

    readNumber(size: number, endian = 'little') {
        let num = BigNum.fromBuffer(this.data.slice(this.offset, this.offset + size), { endian, size }).toNumber();
        this.offset += size;
        return num;
    }

    readUInt8() {
        let num = this.data.readUInt8(this.offset);
        this.offset += 1;
        return num;
    }

    readUInt16LE() {
        let num = this.data.readUInt16LE(this.offset);
        this.offset += 2;
        return num;
    }

    readUInt16BE() {
        let num = this.data.readUInt16BE(this.offset);
        this.offset += 2;
        return num;
    }

    readUInt32LE() {
        let num = this.data.readUInt32LE(this.offset);
        this.offset += 4;
        return num;
    }

    readUInt32BE() {
        let num = this.data.readUInt32BE(this.offset);
        this.offset += 4;
        return num;
    }

    readList(itemSize: number, strictMode = false) {
        let { value: count, offset: cntOffset, size: cntSize } = utils.varBufferIntLength(this.data.slice(this.offset));
        this.offset += cntOffset + cntSize;

        let items = new Array<Buffer>();
        while (items.length < count) {
            items.push(this.data.slice(this.offset, this.offset + itemSize));
            this.offset += itemSize;
        }

        if (strictMode && (items.length != count)) throw new Error('Unexpected items count');

        return items;
    }

    readVarIntList(mul = 1) {
        let { value: count, offset: cntOffset, size: cntSize } = utils.varBufferIntLength(this.data.slice(this.offset));
        this.offset += cntOffset + cntSize;

        let items = new Array<number>();
        for (let i = 0; i < count * mul; i++) {
            let { value: item, offset: itemOffset, size: itemSize } = utils.varBufferIntLength(this.data.slice(this.offset));
            this.offset += itemOffset + itemSize;
            items.push(item);
        }

        return items;
    }

    readFloatLE() {
        let num = this.data.readFloatLE(this.offset);
        this.offset += 4;
        return num;
    }

    readFloatBE() {
        let num = this.data.readFloatBE(this.offset);
        this.offset += 4;
        return num;
    }

    readDoubleLE() {
        let num = this.data.readDoubleLE(this.offset);
        this.offset += 8;
        return num;
    }

    readDoubleBE() {
        let num = this.data.readDoubleBE(this.offset);
        this.offset += 8;
        return num;
    }

    read(size: number) {
        let buf = this.data.slice(this.offset, this.offset + size);
        this.offset += size;
        return buf;
    }

    seek(delta: number) {
        this.offset += delta;
    }
}