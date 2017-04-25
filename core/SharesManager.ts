/*
 * Created on Wed Apr 19 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as Utils from '../misc/Utils';
import { GetBlockTemplate } from "./DaemonWatcher";
import { Task } from "./TaskConstructor";
import { Algos, BaseDiff, bitsToTarget } from "./Algos";
import * as BigNum from 'bignum';

export default class SharesManager {
    private txHasher: (data: Buffer) => Buffer;
    private headerHasher: (data: Buffer) => Buffer;
    private mutliplier = 1;
    private template: GetBlockTemplate;
    private blockTarget: number;
    private shares = new Set<string>(); // share fingerprint -> timestamp

    proof: 'POW' | 'POS' = 'POW';

    constructor(algorithm: string, configs?: { normalHash?: boolean }) {
        this.txHasher = ['keccak', 'blake', 'fugue', 'groestl'].includes(algorithm) && (configs && !configs.normalHash) ? Utils.sha256 : Utils.sha256d;
        this.mutliplier = Algos[algorithm].mutliplier || 1;
        this.headerHasher = Algos[algorithm].hash(configs)
    }

    updateGbt(template: GetBlockTemplate) {
        if (this.template && template.previousblockhash == this.template.previousblockhash) return;
        this.template = template;
        this.blockTarget = template.target ? new BigNum(template.target, 16).toNumber() : bitsToTarget(Number.parseInt(template.bits, 16));
        this.shares.clear();
    }

    buildShare(task: Task, nonce: string, extraNonce1: string, extraNonce2: string, nTime: string) {
        if (task.previousBlockHash !== this.template.previousblockhash) return null;

        let now = Date.now() / 1000 | 0;
        let nTimeValue = Number.parseInt(nTime, 16);
        if (nTimeValue < this.template.curtime || nTimeValue > now + 7200) return null;

        let fingerprint = `${extraNonce1}/${extraNonce2}/${nonce}/${nTime}`;
        if (this.shares.has(fingerprint)) return null;
        this.shares.add(fingerprint);

        let coinbaseTx = Buffer.concat([
            task.coinbaseTx.part1,
            Buffer.from(extraNonce1, 'hex'),
            Buffer.from(extraNonce2, 'hex'),
            task.coinbaseTx.part2,
        ]);

        let coinbaseTxid = this.txHasher(coinbaseTx);
        let merkleRoot = Utils.reverseBuffer(task.merkleLink.aggregate(coinbaseTxid, (prev, curr) => Utils.sha256d(Buffer.concat([prev, curr])))).toString('hex');
        let header = this.buildHeader(nonce, nTime, merkleRoot);
        let headerHashBuf = this.headerHasher(header);
        let shareHash = Utils.reverseBuffer(headerHashBuf).toString('hex');

        let shareTarget = BigNum.fromBuffer(headerHashBuf, { endian: 'little', size: 32 }).toNumber();
        let shareDiff = BaseDiff / shareTarget * this.mutliplier;

        let shareHex: string;
        if (this.blockTarget > shareTarget) {
            shareHex = Buffer.concat([
                header,
                Utils.varIntBuffer(this.template.transactions.length + 1),
                coinbaseTx,
                Buffer.concat(this.template.transactions.map(tx => Buffer.from(tx.data, 'hex'))),
                this.template.masternode_payments ? Buffer.concat([Utils.varIntBuffer(this.template.votes.length)].concat(this.template.votes.map(vt => Buffer.from(vt, 'hex')))) : Buffer.alloc(0),
                Buffer.from(this.proof === 'POS' ? [0] : []) //POS coins require a zero byte appended to block which the daemon replaces with the signature
            ]).toString('hex');
        }

        return { shareDiff, shareHex, shareHash, merkleRoot, timestamp: now };
    }

    private buildHeader(nonce: string, nTime: string, merkleRoot: string) {
        let header = Buffer.alloc(80);
        let position = 0;
        header.write(nonce, position, 4, 'hex');
        header.write(this.template.bits, position += 4, 4, 'hex');
        header.write(nTime, position += 4, 4, 'hex');
        header.write(merkleRoot, position += 4, 32, 'hex');
        header.write(this.template.previousblockhash, position += 32, 32, 'hex');
        header.writeUInt32BE(this.template.version, position + 32);
        header = Utils.reverseBuffer(header);
        return header;
    }
}