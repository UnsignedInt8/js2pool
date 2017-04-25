
import * as merkle from 'merkle-lib';
import { Algos } from '../core/Algos';
import * as Utils from '../misc/Utils';
import { Server } from "net";
import * as net from 'net';
import * as kinq from 'kinq';
import * as assert from 'assert';
import { DaemonWatcher, GetBlockTemplate } from "../core/DaemonWatcher";
import { TaskConstructor, Task } from "../core/TaskConstructor";
import SharesManager from "../core/SharesManager";
import StratumClient from "../core/StratumClient";
import MerkleTree from "../core/MerkleTree";
import TaskPusher from "./TaskPusher";
import { ExtraNonceSize, ExtraNonce1Size, ExtraNonce2Size } from "./Constant";

kinq.enable();

export default class Pool {
    watcher: DaemonWatcher;
    taskConstructor: TaskConstructor;
    sharesManager: SharesManager;
    stratumServer: Server;

    clients = new Set<StratumClient>();

    constructor() {
        this.watcher = new DaemonWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        this.taskConstructor = new TaskConstructor('mpBjJJtJK5mFuuvFxdPHFp1wgdVMiXsaHW');
        this.taskConstructor.extraNonceSize = ExtraNonceSize;
        this.sharesManager = new SharesManager('sha256d');
        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    currentTask: Task;

    handleBlockTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        console.info('new block height: ', template.height);
        this.sharesManager.updateTemplate(template);

        let auxTree = MerkleTree.buildMerkleTree(template.auxes || []);
        let taskTemplate = this.taskConstructor.buildTask(template, auxTree.root, auxTree.data.length);
        this.currentTask = taskTemplate;

        for (let item of this.clients) {
            item.sendTask(taskTemplate.stratumParams);
        }

    }

    startStratumServer() {
        let me = this;
        this.stratumServer = net.createServer(s => {
            let client = new StratumClient(s, ExtraNonce1Size);
            me.clients.add(client);

            client.onSubscribe((sender, msg) => { sender.sendSubscription(msg.id, ExtraNonce2Size); });
            client.onAuthorize((sender, name, pass, msg) => {
                sender.sendAuthorization(msg.id, true);
                sender.sendDifficulty(0.0002502);
                if (!me.currentTask) return;
                sender.sendTask(me.currentTask.stratumParams);
            });
            client.onEnd((sender) => {
                console.log('End: ', sender.miner);
                me.clients.delete(sender);
            });
            client.onKeepingAliveTimeout(sender => {
                console.log('send ping as keeping alive')
                sender.sendPing();
            });
            client.onTaskTimeout(sender => {
                console.log('task timeout, resend task');
                // if (!this.currentTask) return;
                // sender.sendTask(this.currentTask.stratumParams);
            });
            client.onSubmit((sender, result, msg) => {
                let share = me.sharesManager.buildShare(me.currentTask, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime);

                if (!share) {
                    client.sendSubmissionResult(msg.id, false, null);
                    console.log(msg.id, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime, result.taskId, me.currentTask.taskId);
                    console.log('share diff', share ? share.shareDiff : 0);
                    return;
                }

                if (share.shareHex) this.watcher.submitBlockAsync(share.shareHex);
                let isExceptionDiff = share.shareDiff < sender.difficulty;
                client.sendSubmissionResult(msg.id, !isExceptionDiff, null);

                console.log(msg.id, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime, result.taskId, me.currentTask.taskId);
                console.log('share diff', share ? share.shareDiff | 0 : 0);
            });
        }).listen(3333);


    }
}

new Pool().startStratumServer();

// let pusher = new TaskPusher({
//     zookeeper: {
//         address: 'localhost',
//         port: 2181,
//     },
//     address: 'mpBjJJtJK5mFuuvFxdPHFp1wgdVMiXsaHW',
//     daemon: {
//         host: 'localhost',
//         port: 19001,
//         password: '123',
//         username: 'admin1',
//     },
// });
