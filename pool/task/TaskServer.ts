
require('../../nodejs/AsyncSocket');

import { DaemonWatcher, GetBlockTemplate } from '../../core/DaemonWatcher';
import { TaskConstructor } from '../../core/TaskConstructor';
import { default as TaskPusher } from './TaskPusher';
import MerkleTree from '../../core/MerkleTree';
import { ExtraNonceSize } from '../Constant';
import { Server, Socket } from 'net';
import * as net from 'net';
import { ZookeeperOptions, TaskServerOptions } from "./index";

export class TaskServer {
    private daemonWatchers: DaemonWatcher[] = [];
    private taskConstructor: TaskConstructor;
    private taskPusher: TaskPusher;
    private blockNotificationServer: Server;
    private lastNotifiedHash: string;

    constructor(opts: TaskServerOptions) {
        this.taskConstructor = new TaskConstructor(opts.address, opts.fees)
        this.taskConstructor.extraNonceSize = ExtraNonceSize;
        this.taskPusher = new TaskPusher(opts.zookeeper);
        this.taskPusher.onReady(this.onPusherReady.bind(this));

        for (let daemonOpts of opts.daemons) {
            let daemonWatcher = new DaemonWatcher(daemonOpts);
            daemonWatcher.onBlockTemplateUpdated(this.onTemplateUpdated.bind(this));
            this.daemonWatchers.push(daemonWatcher);
        }

        if (!opts.blocknotifylistener || !opts.blocknotifylistener.enabled) {
            this.daemonWatchers.first().beginWatching();
            return;
        }

        if (opts.blocknotifylistener && opts.blocknotifylistener.enabled) {
            this.blockNotificationServer = net.createServer(this.onBlockNotifyingSocketConnected.bind(this)).listen(opts.blocknotifylistener.port, opts.blocknotifylistener.host);
        }
    }

    private async onPusherReady() {
        for (let watcher of this.daemonWatchers) {
            if (await watcher.refreshMiningInfoAsync()) return;
        }
    }

    private async onBlockNotifyingSocketConnected(s: Socket) {
        s.once('end', () => s.end());

        let hash = (await s.readAsync()).toString('utf8');
        if (!hash) return;
        if (this.lastNotifiedHash === hash) return;

        for (let watcher of this.daemonWatchers) {
            if (await watcher.refreshMiningInfoAsync()) break;
        }

        console.info('new block notified: ', hash);
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

        this.taskPusher.sendTask(taskMessage);
    }
}