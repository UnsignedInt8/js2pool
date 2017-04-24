
import { Event } from "../nodejs/Event";
import { Client, Consumer, Producer, HighLevelProducer } from 'kafka-node';
import { ZookeeperOptions, Topics, TaskSerialization } from "./TaskPusher";
import * as crypto from 'crypto';
import { Server, Socket } from "net";
import * as net from 'net';
import StratumClient from "../core/StratumClient";
import SharesManager from "../core/SharesManager";

type StratumServerOptions = {
    zookeeper: ZookeeperOptions,
    groupId: string,
    port: number, // stratum server port

    coin: {
        algorithm: string,
        normalHash?: boolean,
    }
}

export class StratumServer extends Event {

    private zookeeper: Client;
    private taskConsumer: Consumer;
    private shareProducer: HighLevelProducer;
    private server: Server;
    private port: number;
    private clients = new Map<string, StratumClient>();
    private sharesManager: SharesManager;

    private static Events = {
        Ready: 'Ready',
    };

    constructor(opts: StratumServerOptions) {
        super();

        this.zookeeper = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString('hex'));
        this.shareProducer = new HighLevelProducer(this.zookeeper);
        this.shareProducer.on('ready', this.onProducerReady.bind(this));
        this.shareProducer.on('error', this.onError.bind(this));

        this.taskConsumer = new Consumer(this.zookeeper, [{ topic: Topics.Task }], { autoCommit: true, groupId: opts.groupId, encoding: 'utf8' });
        this.taskConsumer.on('message', this.onMessage.bind(this));
        this.taskConsumer.on('error', this.onError.bind(this));
        this.taskConsumer.on('offsetOutOfRange', this.onOffsetOutOfRange.bind(this));

        this.port = opts.port;
        this.sharesManager = new SharesManager(opts.coin.algorithm, opts.coin);
    }

    private onMessage(msg: string) {
        let taskMessage = JSON.parse(msg) as TaskSerialization;
        let task = {
            taskId: taskMessage.taskId,
            merkleLink: taskMessage.merkleLink.map(s => Buffer.from(s, 'hex')),
            previousBlockHash: taskMessage.previousBlockHash,
            stratumParams: taskMessage.stratumParams,
            height: taskMessage.height,
            template: taskMessage.template,
            coinbaseTx: {
                part1: Buffer.from(taskMessage.coinbaseTx[0], 'hex'),
                part2: Buffer.from(taskMessage.coinbaseTx[1], 'hex'),
            },
        };

        this.sharesManager.updateTemplate(taskMessage.template);
    }

    private onError(error) {
        console.error(error);
    }

    private onOffsetOutOfRange(error) {
        console.error(error);
    }

    private onProducerReady() {
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
        let client = new StratumClient(socket, 4);
        while (this.clients.has(client.extraNonce1)) {
            client.changeExtraNonce1();
        }

        client.onSubscribe((sender, msg) => sender.sendSubscription(msg.id, 4));
        client.onAuthorize((sender, username, password, raw) => sender.sendAuthorization(raw.id, true));
        client.onEnd(sender => me.clients.delete(sender.extraNonce1));
        client.onKeepingAliveTimeout(sender => sender.sendPing());
        client.onTaskTimeout(sender => { });
        client.onSubmit((sender, result, message) => {

        });
        me.clients.set(client.extraNonce1, client);
    }
}