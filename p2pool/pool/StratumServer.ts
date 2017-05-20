
import { Event } from "../../nodejs/Event";
import { IWorkerManager } from "./IWorkerManager";
import * as net from 'net';
import logger from '../../misc/Logger';
import StratumClient, { StratumSubmission } from "../../core/StratumClient";
import * as crypto from 'crypto';
import { Socket } from "net";
import { DaemonOptions, DaemonWatcher, GetBlockTemplate } from "../../core/DaemonWatcher";
import { SharechainBuilder } from "../chain/SharechainBuilder";
import SharesManager from "../../core/SharesManager";

export type StratumOptions = {
    port: number;
    daemons: DaemonOptions[],
    algorithm: string;
}

export type ShareResult = {
    shareTarget: string,
    extraNonce: string,
    header: { version: number, previousBlockHash: string, merkleRoot: string, nonce: number, bits: number, timestamp: number }
}

export class StratumServer extends Event {
    static Events = {
        submit: 'Submit',
    }

    private readonly workerManager: IWorkerManager;
    private readonly clients = new Map<string, StratumClient>();
    private daemonWatchers: Array<DaemonWatcher>;
    private sharesManager: SharesManager;
    private task: {
        id: string,
        coinbaseTx: { part1: Buffer, part2: Buffer },
        stratumParams: (string | string[] | boolean)[],
        merkleLink: Buffer[],
    };

    constructor(opts: StratumOptions, manager: IWorkerManager) {
        super();
        this.daemonWatchers = opts.daemons.map(opts => new DaemonWatcher(opts));
        this.sharesManager = new SharesManager(opts.algorithm);

        this.workerManager = manager;
        let stratumServer = net.createServer(this.handleStratumClientConnected.bind(this));
        stratumServer.on('error', (error) => logger.error(error.message));
        stratumServer.listen(opts.port);
    }

    private handleStratumClientConnected(socket: Socket) {
        let me = this;
        let client = new StratumClient(socket, 0);
        client.tag = crypto.randomBytes(8).toString('hex');
        me.clients.set(client.tag, client);

        client.onSubscribe((sender, msg) => sender.sendSubscription(msg.id, SharechainBuilder.COINBASE_NONCE_LENGTH));
        client.onEnd(sender => me.clients.delete(sender.tag));
        client.onKeepingAliveTimeout(sender => sender.sendPing());
        client.onTaskTimeout(sender => { });

        client.onAuthorize(async (sender, username, password, raw) => {
            let { authorized, initDifficulty } = await me.workerManager.authorizeAsync(username, password);
            sender.sendAuthorization(raw.id, authorized);
            if (!authorized) return;
            sender.sendDifficulty(initDifficulty);
            if (me.task) sender.sendTask(me.task.stratumParams);
        });

        client.onSubmit((worker, result, message) => {
            if (!result || !message || !me.task) {
                worker.sendSubmissionResult(message ? message.id : 0, false, null);
                return;
            }

            // first, checking whether it satisfies the bitcoin network or not
            let task = me.task;
            let { part1: tx1, part2: tx2 } = task.coinbaseTx;
            let { shareTarget, shareHex, header, shareHash } = me.sharesManager.buildShare(tx1, tx2, task.merkleLink, result.nonce, '', result.extraNonce2, result.nTime); // building the classic share info

            if (!shareTarget) {
                let msg = { miner: result.miner, taskId: result.taskId, };
                worker.sendSubmissionResult(message.id, false, null);
                return;
            }

            if (shareHex) {
                me.daemonWatchers.forEach(watcher => watcher.submitBlockAsync(shareHex));
            }

            me.trigger(StratumServer.Events.submit, me, <ShareResult>{ extraNonce: result.extraNonce2, shareTarget: shareTarget.toString(16), header });

            // dead on arrival
            if (result.taskId != me.task.id) {
                let msg = { miner: result.miner, taskId: result.taskId };
                worker.sendSubmissionResult(message.id, false, null);
                logger.warn(`dead on arrival: ${worker.miner}, ${shareHash}`);
                return;
            }

            console.log('header', shareHash, shareTarget, result.extraNonce2);

            worker.sendSubmissionResult(message.id, shareTarget.le(worker.target), null);
        });

    }

    onSubmit(callback: (sender: StratumServer, result: ShareResult) => void) {
        super.register(StratumServer.Events.submit, callback);
    }

    updateTask(params: (string | string[] | boolean)[], template: GetBlockTemplate) {
        Array.from(this.clients.values()).forEach(c => c.sendTask(params));
        this.sharesManager.updateGbt(template);

        this.task = {
            id: <string>params[0],
            stratumParams: params,
            merkleLink: (<string[]>params[4]).map(s => Buffer.from(s, 'hex')),
            coinbaseTx: {
                part1: Buffer.from(<string>params[2], 'hex'),
                part2: Buffer.from(<string>params[3], 'hex'),
            },
        }
    }
}