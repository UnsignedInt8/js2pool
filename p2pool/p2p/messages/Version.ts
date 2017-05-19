/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 */

import { Payload } from './Payload';
import * as crypto from 'crypto';
import * as utils from '../../../misc/Utils';
import * as Bignum from 'bignum';
import Addrs from "./Addrs";

const PROTOCOL_VERSION = 1700;
const APP_VERSION: string = require('../../../../package.json').version;

type Address = {
    services: Bignum, // 8 bytes all zero
    ip: string, // 16 bytes
    port: number, // 2 bytes
}

export type TypeVersion = {
    version?: number;
    networkServices?: Buffer;
    addressTo: Address;
    addressFrom: Address;
    nonce?: number;
    subVersion?: string;
    mode?: number;
    bestShareHash?: string;
}

export class Version extends Payload {

    version = PROTOCOL_VERSION; // 4 bytes
    networkServices = Buffer.from('0000000000000000', 'hex'); // 8 bytes

    addressTo: Address; // 26 bytes: 8bytes services(0), 16 bytes ipv6, 2 bytes port
    addressFrom: Address; // 26 bytes
    nonce: number; // 8 bytes
    subVersion: string;  // variant string 
    mode = 1; // always 1, 4 bytes
    bestShareHash: string; // 32 bytes

    toBuffer(): Buffer {
        let verBuf = Buffer.alloc(4);
        verBuf.writeUInt32LE(this.version, 0);

        let addrTo = Addrs.convertAddressToBuffer(this.addressTo);
        let addrFrom = Addrs.convertAddressToBuffer(this.addressFrom);

        let nonce = utils.packInt64LE(this.nonce);
        let subVer = utils.varStringBuffer(this.subVersion);
        let mode = utils.packUInt32LE(this.mode);

        let shareHash = utils.uint256BufferFromHash(this.bestShareHash);

        return Buffer.concat([verBuf, this.networkServices, addrTo, addrFrom, nonce, subVer, mode, shareHash]);
    }

    static fromObject(obj: TypeVersion) {
        let ver = new Version();

        ver.addressTo = obj.addressTo;
        ver.addressFrom = obj.addressFrom;
        ver.nonce = obj.nonce || parseInt((Math.random() * 10000000000000000).toFixed(0));
        ver.subVersion = obj.subVersion || `js2pool-${APP_VERSION}`;
        ver.bestShareHash = obj.bestShareHash || '00000000000000000000000000000000';

        return ver;
    }

    static fromBuffer(data: Buffer) {
        let version = new Version();
        version.version = data.readUInt32LE(0);
        version.networkServices = data.slice(4, 12);

        version.addressTo = Addrs.convertBufferToAddress(data.slice(12, 38));
        version.addressFrom = Addrs.convertBufferToAddress(data.slice(38, 64));
        version.nonce = Bignum.fromBuffer(data.slice(64, 72), { endian: 'little', size: 8 }).toNumber();
        version.subVersion = utils.varBufferString(data.slice(72));

        let { offset, size } = utils.varStringLength(data.slice(72));
        let subverLength = offset + size;
        let modeOffset = 72 + subverLength;

        version.mode = data.readUInt32LE(modeOffset);
        version.bestShareHash = utils.hexFromReversedBuffer(data.slice(modeOffset + 4, modeOffset + 36));

        return version;
    }
}