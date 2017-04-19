/*
 * Created on Wed Apr 19 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as Utils from '../misc/Utils';
import { GetBlockTemplate } from "./BlockchainWatcher";
import { Task } from "./TaskConstructor";

export default class SharesManager {
    private txHasher: (data: Buffer) => Buffer;
    private template: GetBlockTemplate;
    private shares = new Map<string, number>(); // share fingerprint -> timestamp

    constructor(txAlgorithm: string = 'sha256d') {
        this.txHasher = txAlgorithm === 'sha256d' ? Utils.sha256d : Utils.sha256;
    }

    updateTemplate(template: GetBlockTemplate) {
        this.template = template;
    }

    buildShare(task: Task, nonce: string, extraNonce1: string, extraNonce2: string, nTime: string) {
        let fingerprint = `${extraNonce1}/${extraNonce2}/${nonce}/${nTime}`;
        let shareTime = Number.parseInt(nTime, 16);

        let coinbaseTx = Buffer.concat([
            task.coinbaseTx.part1,
            Buffer.from(extraNonce1, 'hex'),
            Buffer.from(extraNonce2, 'hex'),
            task.coinbaseTx.part2,
        ]);

        let coinbaseTxHash = this.txHasher(coinbaseTx);
        
    }
}