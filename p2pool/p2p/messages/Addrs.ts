/*
 * Created on Sat Apr 08 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";
import * as Bignum from 'bignum';
import * as utils from '../../../misc/Utils';
import * as assert from 'assert';
import * as ipaddr from 'ipaddr.js';

const PROTOCOL_ADDRESS_LENGTH = 26;
const PAYLOAD_LENGTH = PROTOCOL_ADDRESS_LENGTH + 8; // address length + timestamp

export type TypeAddrs = {
    services?: Bignum, // 8 bytes all zero
    ip: string, // 16 bytes
    port: number, // 2 bytes
    timestamp?: number, // seconds, 8 bytes
}

const ipv4 = /^(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})(.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})){3}$/;
const ipv6 = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;

export class MutliAddrs extends Payload {
    buffers: Buffer[];

    constructor(buffers: Buffer[]) {
        super();
        this.buffers = buffers;
    }

    toBuffer() {
        return Buffer.concat(this.buffers);
    }
}

export default class Addrs extends Payload {
    timestamp: number; // 8 bytes, seconds 
    services: Bignum; // 8 bytes, all zero
    ip: string; // 16 bytes
    port: number; // 2 bytes

    toBuffer(): Buffer {
        let timeBuf = (new Bignum(this.timestamp)).toBuffer({ endian: 'little', size: 8 });
        let addrBuf = Addrs.convertAddressToBuffer(this);

        return Buffer.concat([timeBuf, addrBuf]);
    }

    static convertAddressToBuffer(addr: TypeAddrs) {
        let services = addr.services.toBuffer({ endian: 'little', size: 8 });

        let ip: Buffer;
        if (ipv4.test(addr.ip)) {
            let buffer = Buffer.alloc(16);

            // see dual-stack: https://en.wikipedia.org/wiki/IPv6#IPv4-mapped_IPv6_addresses
            buffer[10] = 255;
            buffer[11] = 255;
            addr.ip.split('.').forEach((byte, index) => buffer[index + 12] = parseInt(byte));
            ip = buffer;
        } else if (ipv6.test(addr.ip)) {
            ip = Buffer.from(ipaddr.parse(addr.ip).toByteArray());
        } else {
            ip = Buffer.alloc(16, 0);
        }

        let buf = Buffer.concat([services, ip], PROTOCOL_ADDRESS_LENGTH);
        buf.writeUInt16BE(addr.port, PROTOCOL_ADDRESS_LENGTH - 2);  // port always uses network bytes order - bigendian
        return buf;
    }

    static parseIP(input: Buffer) {
        let v6 = [];
        let v4 = [];
        for (let a = 0; a < 16; a += 2) {
            var twoBytes = input.slice(a, a + 2);
            v6.push(twoBytes.toString('hex'));
            if (a >= 12) {
                v4.push(twoBytes[0]);
                v4.push(twoBytes[1]);
            }
        }
        let ipv6Addr = v6.join(':');
        let ipv4Addr = v4.join('.');
        return ipv4.test(ipv4Addr) ? ipv4Addr : ipv6Addr; // TODO: check the validity of ip
    }

    static convertBufferToAddress(buf: Buffer) {
        return {
            services: Bignum.fromBuffer(buf.slice(0, 8), { endian: 'little', size: 8 }),
            ip: Addrs.parseIP(buf.slice(8, 24)),
            port: buf.readUInt16BE(24)
        };
    }

    static fromSingleObject(obj: TypeAddrs): Addrs {
        let addrs = new Addrs();
        addrs.timestamp = obj.timestamp || parseInt((Date.now() / 1000).toFixed(0));
        addrs.ip = obj.ip;
        addrs.port = obj.port;
        addrs.services = new Bignum(obj.services || 0) || new Bignum(0);
        return addrs;
    }

    static fromObject(objs: TypeAddrs[]): MutliAddrs {
        if (objs.length >= 0xfe) throw new Error('Arguments exceed the amount of maximum, 255.');
        let buffers = objs.map(o => Addrs.fromSingleObject(o)).map(a => a.toBuffer());

        let countBuf = Buffer.alloc(1);
        countBuf.writeUInt8(buffers.length, 0);
        buffers.unshift(utils.varIntBuffer(buffers.length));
        return new MutliAddrs(buffers);
    }

    static fromObjects(objs: TypeAddrs[]): Buffer {
        return Addrs.fromObject(objs).toBuffer();
    }

    static fromBuffer(data: Buffer): Addrs[] {
        let addrs = new Array<Addrs>();
        let { value: count, offset: start, size } = utils.varBufferIntLength(data);
        let offset = 0;
        let content = data.slice(start + size);

        while (offset < content.length) {
            let slice = content.slice(offset, offset + PAYLOAD_LENGTH);

            let addr = new Addrs();
            addr.timestamp = Bignum.fromBuffer(slice.slice(0, 8), { endian: 'little', size: 8 }).toNumber();

            let { services, ip, port } = Addrs.convertBufferToAddress(slice.slice(8));
            addr.services = services;
            addr.ip = ip;
            addr.port = port;

            addrs.push(addr);
            offset += PAYLOAD_LENGTH;
        }

        assert.equal(addrs.length, count);

        return addrs;
    }
}