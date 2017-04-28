import * as net from 'net';
import * as crypto from 'crypto';
import { Server, Socket } from "net";
import { Event } from "../../nodejs/Event";
import StratumClient from "../../core/StratumClient";
import SharesManager from "../../core/SharesManager";
import { ZookeeperOptions, TaskSerialization } from "../task";
import { TaskConstructor, Task } from "../../core/TaskConstructor";
import { DaemonOptions, DaemonWatcher } from "../../core/DaemonWatcher";
import { ExtraNonce1Size, ExtraNonce2Size, Topics } from "../Constant";
import { Client, Consumer, Producer, HighLevelProducer } from 'kafka-node';
import { StratumServerOptions } from "./index";

export interface IMinerManager {
    authorize(username: string, password: string): { authorized: boolean, initDiff: number };
}

export class StratumServer extends Event {

    private zookeeper: Client;
    private taskConsumer: Consumer;
    private sharesProducer: HighLevelProducer;
    private server: Server;
    private port: number;
    private clients = new Map<string, StratumClient>();
    private sharesManager: SharesManager;
    private fastSubmitter: DaemonWatcher;
    private currentTask: Task;

    private readonly minersManager: IMinerManager;

    private static Events = {
        Ready: 'Ready',
    };

    constructor(opts: StratumServerOptions, minersManager: IMinerManager) {
        super();

        this.zookeeper = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString('hex'));
        this.sharesProducer = new HighLevelProducer(this.zookeeper);
        this.sharesProducer.on('ready', this.onProducerReady.bind(this));
        this.sharesProducer.on('error', this.onError.bind(this));

        this.taskConsumer = new Consumer(this.zookeeper, [{ topic: Topics.Task }], { autoCommit: true, groupId: opts.groupId, encoding: 'utf8' });
        this.taskConsumer.on('message', this.onMessage.bind(this));
        this.taskConsumer.on('error', this.onError.bind(this));
        this.taskConsumer.on('offsetOutOfRange', this.onOffsetOutOfRange.bind(this));

        this.port = opts.port;
        this.sharesManager = new SharesManager(opts.coin.algorithm, opts.coin);
        this.fastSubmitter = new DaemonWatcher(opts.daemon);
        this.minersManager = minersManager;
    }

    private onMessage(msg: { topic: string, value: any, offset: number, partition: number }) {
        let taskMessage = JSON.parse(msg.value) as TaskSerialization;
        console.info('new template received: ', taskMessage.height);

        let task = {
            taskId: taskMessage.taskId,
            merkleLink: taskMessage.merkleLink.map(s => Buffer.from(s, 'hex')),
            previousBlockHash: taskMessage.previousBlockHash,
            stratumParams: taskMessage.stratumParams,
            height: taskMessage.height,
            coinbaseTx: {
                part1: Buffer.from(taskMessage.coinbaseTx[0], 'hex'),
                part2: Buffer.from(taskMessage.coinbaseTx[1], 'hex'),
            },
        };

        this.currentTask = task;

        if (!taskMessage.template) return;
        this.sharesManager.updateGbt(taskMessage.template);

        this.clients.forEach(c => c.sendTask(task.stratumParams));
    }

    private onError(error) {
        console.error(error);
    }

    private onOffsetOutOfRange(error) {
        console.error(error);
    }

    private onProducerReady() {
        this.sharesProducer.createTopics([Topics.Shares, Topics.InvalidShares, Topics.Blocks], true, (err, data) => { });
        super.trigger(StratumServer.Events.Ready, this);
    }

    onReady(callback: (sender: StratumServer) => void) {
        super.register(StratumServer.Events.Ready, callback);
    }

    // -------------- Stratum Server ------------------

    start() {
        if (this.server) return;
        this.server = net.createServer(this.onSocketConnected.bind(this)).listen(this.port);
    }

    private onSocketConnected(socket: Socket) {
        let me = this;
        let client = new StratumClient(socket, ExtraNonce1Size);
        while (this.clients.has(client.extraNonce1)) {
            client.changeExtraNonce1();
        }

        client.onSubscribe((sender, msg) => sender.sendSubscription(msg.id, ExtraNonce2Size));
        client.onEnd(sender => me.clients.delete(sender.extraNonce1));
        client.onKeepingAliveTimeout(sender => sender.sendPing());
        client.onTaskTimeout(sender => { });

        client.onAuthorize((sender, username, password, raw) => {
            let { authorized, initDiff } = me.minersManager.authorize(username, password);
            sender.sendAuthorization(raw.id, authorized);
            if (!authorized) return;
            sender.sendDifficulty(initDiff);
            if (me.currentTask) sender.sendTask(me.currentTask.stratumParams);
        });

        client.onSubmit((sender, result, message) => {
            if (result.taskId != me.currentTask.taskId) {
                let msg = { miner: result.miner, taskId: result.taskId };
                me.broadcastInvalidShare(msg);
                client.sendSubmissionResult(message.id, false, null);
                return;
            }

            let share = me.sharesManager.buildShare(me.currentTask, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime);
            if (!share || share.shareDiff < sender.difficulty) {
                let msg = { miner: result.miner, taskId: result.taskId, };
                me.broadcastInvalidShare(msg);
                client.sendSubmissionResult(message.id, false, null);
                client.touchBad();
                return;
            }

            let shareMessage = { miner: result.miner, hash: share.shareHash, diff: share.shareDiff, expectedDiff: sender.difficulty, timestamp: share.timestamp };

            if (share.shareHex) {
                me.fastSubmitter.submitBlockAsync(share.shareHex);
                me.broadcastBlock(shareMessage);
            }

            client.sendSubmissionResult(message.id, true, null);
            me.broadcastShare(shareMessage);
        });

        me.clients.set(client.extraNonce1, client);
    }

    private broadcastInvalidShare(msg: any) {
        this.sharesProducer.send([{ topic: Topics.InvalidShares, messages: JSON.stringify(msg), }], (error, data) => { });
    }

    private broadcastShare(msg: any) {
        this.sharesProducer.send([{ topic: Topics.Shares, messages: JSON.stringify(msg), }], (err, data) => { });
    }

    private broadcastBlock(msg: any) {
        this.sharesProducer.send([{ topic: Topics.Blocks, messages: JSON.stringify(msg) }], (err, data) => { });
    }
}