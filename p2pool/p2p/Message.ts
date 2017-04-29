/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 */

import { Payloads } from './Messages';
import { TypePing } from "./Messages/Ping";
import Version, { TypeVersion } from "./Messages/Version";
import * as utils from '../../misc/Utils';
import { Payload } from "./Messages/Payload";
import { TypeAddrme } from "./Messages/Addrme";
import { TypeGetaddrs } from "./Messages/Getaddrs";

type TypeMessage = {
    command: 'version' | 'ping' | 'pong' | 'addrme' | 'getaddrs',
    payload: TypeVersion | TypePing | TypeAddrme | TypeGetaddrs,
}

export const PROTOCOL_HEAD_LENGTH = 28; // magic(8), command(12), length(4), checksum(4)

export class Message {

    static readonly magic = Buffer.from('2472ef181efcd37b', 'hex');  // 8 bytes, P2Pool protocol

    command: string;
    payload: any;

    constructor(obj: TypeMessage) {
        this.command = obj.command;
        this.payload = obj.payload;
    }

    toBuffer() {
        let payBuf = (Payloads[this.command].fromObject(this.payload) as Payload).toBuffer();
        let checksum = utils.sha256d(payBuf).readUInt32LE(0);

        let headBuf = Buffer.alloc(20);
        headBuf.write(this.command, 0, 12);
        headBuf.writeUInt32LE(payBuf.length, 12);
        headBuf.writeUInt32LE(checksum, 16);

        return Buffer.concat([Message.magic, headBuf, payBuf]);
    }

    static fromObject(obj: TypeMessage) {
        return new Message(obj);
    }
}