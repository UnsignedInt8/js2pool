import { Client, HighLevelProducer } from 'kafka-node';
import { Event } from "../nodejs/Event";
import * as crypto from 'crypto';
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, } from "../core/DaemonWatcher";
import { TaskConstructor, Task } from "../core/TaskConstructor";
import MerkleTree from "../core/MerkleTree";

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

    private zookeeper: Client;
    private taskProducer: HighLevelProducer;
    private daemonWatcher: DaemonWatcher;
    private taskConstructor: TaskConstructor;

    constructor(opts: TaskPusherOptions) {
        super();
        this.taskConstructor = new TaskConstructor(opts.address, opts.recipients)

        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onTemplateUpdated);

        this.zookeeper = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString());
        this.taskProducer = new HighLevelProducer(this.zookeeper);
        this.taskProducer.on('ready', this.onProducerReady);
        this.taskProducer.on('error', this.onProducerError);
    }

    private onProducerReady() {
        this.taskProducer.createTopics(['Task'], true, error => { });
        this.daemonWatcher.beginWatching();
    }

    private onProducerError(error) {

    }

    private onTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        let auxTree = MerkleTree.buildMerkleTree(template.auxes || []);
        let task = this.taskConstructor.buildTask(template, auxTree.root, auxTree.data.length);
    }
}