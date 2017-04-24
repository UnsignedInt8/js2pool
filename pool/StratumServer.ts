
import { Event } from "../nodejs/Event";
import { Client, Consumer, Producer, HighLevelProducer } from 'kafka-node';
import { ZookeeperOptions, Topics, TaskSerialization } from "./TaskPusher";
import * as crypto from 'crypto';
import { Server } from "net";
import * as net from 'net';
import StratumClient from "../core/StratumClient";

type StratumServerOptions = {
    zookeeper: ZookeeperOptions,
    groupId: string,
    port: number, // stratum server port
}

export class StratumServer extends Event {

    private zookeeper: Client;
    private taskConsumer: Consumer;
    private shareProducer: HighLevelProducer;
    private server: Server;
    private port: number;
    private clients = new Map<string, StratumClient>();

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
    }

    private onMessage(msg: string) {
        let taskMessage = JSON.parse(msg) as TaskSerialization;

    }

    private onError(error) {

    }

    private onOffsetOutOfRange(error) {

    }

    private onProducerReady() {
        super.trigger(StratumServer.Events.Ready, this);
    }

    onReady(callback: (sender: StratumServer) => void) {
        super.register(StratumServer.Events.Ready, callback);
    }

    start() {
        let me = this;

        try {
            this.server = net.createServer(s => {
                let client = new StratumClient(s, 4);
            }).listen(this.port);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    
}