/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 */

import { Payloads } from './messages';
import { TypePing } from "./messages/Ping";
import { Version, TypeVersion } from "./messages/Version";
import * as utils from '../../misc/Utils';
import { Payload } from "./messages/Payload";
import { TypeAddrme } from "./messages/Addrme";
import { TypeGetaddrs } from "./messages/Getaddrs";
import { TypeAddrs } from "./messages/Addrs";
import { TypeSharereq } from "./messages/Sharereq";
import { TypeSharereply } from "./messages/Sharereply";
import { TypeHave_tx } from "./messages/Have_tx";
import { TypeRemember_tx } from "./messages/Remember_tx";
import { TypeShares } from "./messages/Shares";

type TypeMessage = {
    command: 'version' | 'ping' | 'pong' | 'addrme' | 'getaddrs' | 'addrs' | 'sharereq' | 'sharereply' | 'have_tx' | 'losing_tx' | 'remember_tx' | 'forget_tx' | 'shares',
    payload: TypeVersion | TypePing | TypeAddrme | TypeGetaddrs | TypeAddrs[] | TypeSharereq | TypeSharereply | TypeHave_tx | TypeRemember_tx | TypeShares,
}

export const PROTOCOL_HEAD_LENGTH = 28; // magic(8), command(12), length(4), checksum(4)

export class Message {

    static MAGIC = Buffer.from('2472ef181efcd37b', 'hex');  // 8 bytes, P2Pool protocol

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

        return Buffer.concat([Message.MAGIC, headBuf, payBuf]);
    }

    static fromObject(obj: TypeMessage) {
        return new Message(obj);
    }
}