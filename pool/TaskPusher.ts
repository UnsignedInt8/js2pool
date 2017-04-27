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
        error: 'Error',
        templatePushed: 'TemplatePushed',
        ready: 'Ready',
    };

    constructor(opts: TaskPusherOptions, daemonWatcher: DaemonWatcher) {
        super();
        this.taskConstructor = new TaskConstructor(opts.address, opts.recipients)
        this.taskConstructor.extraNonceSize = ExtraNonceSize;

        this.daemonWatcher = daemonWatcher;
        this.daemonWatcher.onBlockTemplateUpdated(this.onTemplateUpdated.bind(this));

        this.zookeeper = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString('hex'));
        this.taskProducer = new HighLevelProducer(this.zookeeper);
        this.taskProducer.on('ready', this.onProducerReady.bind(this));
        this.taskProducer.on('error', this.onProducerError.bind(this));
    }

    private onProducerReady() {
        this.taskProducer.createTopics([Topics.Task], true, error => { if (error) console.error(error); });
        super.trigger(TaskPusher.Events.ready, this);
    }

    private onProducerError(error) {
        this.trigger(TaskPusher.Events.error, this, error);
    }

    private onTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        console.info('blockchain updated, template updating broadcast: ', template.height);

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
        }], (error, data) => me.trigger(TaskPusher.Events.templatePushed, this, error));
    }

    onTemplatePushed(callback: (sender: TaskPusher, error) => void) {
        super.register(TaskPusher.Events.templatePushed, callback);
    }

    onError(callback: (sender: TaskPusher, error: string) => void) {
        super.register(TaskPusher.Events.error, callback);
    }

    onReady(callback: (sender: TaskPusher) => void) {
        super.register(TaskPusher.Events.ready, callback);
    }
}
