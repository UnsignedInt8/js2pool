import { Client, HighLevelProducer } from 'kafka-node';
import { Event } from "../nodejs/Event";
import * as crypto from 'crypto';
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, } from "../core/DaemonWatcher";
import { TaskConstructor, Task } from "../core/TaskConstructor";
import MerkleTree from "../core/MerkleTree";
import { ExtraNonceSize, Topics } from "./Constant";

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

export type TaskSerialization = {
    taskId: string,
    coinbaseTx: string[],
    stratumParams: (string | boolean | string[])[],
    previousBlockHash: string,
    merkleLink: string[],
    height: number,
    template: GetBlockTemplate,
}

export default class TaskPusher extends Event {

    private zookeeper: Client;
    private taskProducer: HighLevelProducer;
    private daemonWatcher: DaemonWatcher;
    private taskConstructor: TaskConstructor;

    private static Events = {
        Error: 'Error',
        TemplatePushed: 'TemplatePushed',
    };

    constructor(opts: TaskPusherOptions) {
        super();
        this.taskConstructor = new TaskConstructor(opts.address, opts.recipients)
        this.taskConstructor.extraNonceSize = ExtraNonceSize;

        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onTemplateUpdated.bind(this));

        this.zookeeper = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString('hex'));
        this.taskProducer = new HighLevelProducer(this.zookeeper);
        this.taskProducer.on('ready', this.onProducerReady.bind(this));
        this.taskProducer.on('error', this.onProducerError.bind(this));
    }

    private onProducerReady() {
        this.taskProducer.createTopics([Topics.Task], true, error => { if (error) console.error(error); });
        this.daemonWatcher.beginWatching();
    }

    private onProducerError(error) {
        this.trigger(TaskPusher.Events.Error, this, error);
    }

    private onTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        let me = this;
        let auxTree = MerkleTree.buildMerkleTree(template.auxes || []);
        let task = this.taskConstructor.buildTask(template, auxTree.root, auxTree.data.length);
        let taskMessage = {
            taskId: task.taskId,
            coinbaseTx: [task.coinbaseTx.part1, task.coinbaseTx.part2].map(tx => tx.toString('hex')),
            stratumParams: task.stratumParams,
            previousBlockHash: task.previousBlockHash,
            height: task.height,
            merkleLink: task.merkleLink.map(n => n.toString('hex')),
            template
        };

        this.taskProducer.send([{
            topic: Topics.Task,
            messages: JSON.stringify(taskMessage),
            attributes: 0, // no compress
        }], (error, data) => me.trigger(TaskPusher.Events.TemplatePushed, this, error));
    }

    onTemplatePushed(callback: (sender: TaskPusher, error) => void) {
        super.register(TaskPusher.Events.TemplatePushed, callback);
    }

    onError(callback: (sender: TaskPusher, error: string) => void) {
        super.register(TaskPusher.Events.Error, callback);
    }
}

Object.freeze(Topics);