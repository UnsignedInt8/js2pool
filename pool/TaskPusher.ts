import { Producer, Client } from 'kafka-node';
import { Event } from "../nodejs/Event";
import * as crypto from 'crypto';
import { DaemonWatcher, DaemonOptions, } from "../core/DaemonWatcher";
import { TaskConstructor, Task } from "../core/TaskConstructor";

export type ZookeeperOptions = {
    address: string,
    port: number,
}

export type TaskPusherOptions = {
    zookeeper: ZookeeperOptions,
    daemon: DaemonOptions,

    address: string, // coinbase reward address
    recipients?: [{ address: string, percent: number }],
}

export default class TaskPusher extends Event {

    private zkClient: Client;
    private kaProducer: Producer;
    private daemonWatcher: DaemonWatcher;
    private taskConstructor: TaskConstructor;

    constructor(opts: TaskPusherOptions) {
        super();
        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.taskConstructor = new TaskConstructor(opts.address, opts.recipients)
        this.zkClient = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString());
        this.kaProducer = new Producer(this.zkClient);
        this.kaProducer.on('ready', this.onProducerReady);
        this.kaProducer.on('error', this.onProducerError);
    }

    private onProducerReady() {

    }

    private onProducerError(error) {

    }
}