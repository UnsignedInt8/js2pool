import { Client, HighLevelProducer } from 'kafka-node';
import { Event } from '../../nodejs/Event';
import * as crypto from 'crypto';
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, } from '../../core/DaemonWatcher';
import { TaskConstructor, Task } from '../../core/TaskConstructor';
import MerkleTree from '../../core/MerkleTree';
import { Topics } from '../Constant';
import { ZookeeperOptions } from './index';

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

    private static Events = {
        error: 'Error',
        templatePushed: 'TemplatePushed',
        ready: 'Ready',
    };

    constructor(opts: ZookeeperOptions) {
        super();
        this.zookeeper = new Client(`${opts.address}:${opts.port}`, crypto.randomBytes(4).toString('hex'));
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

    sendTask(task: TaskSerialization) {
        let me = this;
        this.taskProducer.send([{
            topic: Topics.Task,
            messages: JSON.stringify(task),
            attributes: 0, // no compress
        }], (error, data) => me.trigger(TaskPusher.Events.templatePushed, this, error));
    }

    onTemplatePushed(callback: (sender: TaskPusher, error?: any) => void) {
        super.register(TaskPusher.Events.templatePushed, callback);
    }

    onError(callback: (sender: TaskPusher, error: string) => void) {
        super.register(TaskPusher.Events.error, callback);
    }

    onReady(callback: (sender: TaskPusher) => void) {
        super.register(TaskPusher.Events.ready, callback);
    }
}
