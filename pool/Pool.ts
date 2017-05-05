
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
import { ExtraNonceSize, ExtraNonce1Size, ExtraNonce2Size } from "./Constant";
require('../nodejs/AsyncSocket');
require('../nodejs/Number');

kinq.enable();

process.on('error', (error) => {
    console.error('unhandled error', error);
});

process.on('uncaughtException', (error) => {
    console.error('unhandled exception', error);
});

export default class Pool {
    watcher: DaemonWatcher;
    taskConstructor: TaskConstructor;
    sharesManager: SharesManager;
    stratumServer: Server;

    clients = new Set<StratumClient>();

    constructor() {
        // this.watcher = new DaemonWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        // this.taskConstructor = new TaskConstructor('mpBjJJtJK5mFuuvFxdPHFp1wgdVMiXsaHW', [{ address: 'n2wQ1Ge7zJVZTzGCyxGjdg1CVmmXYREcUC', percent: 10 }]);
        // this.sharesManager = new SharesManager('sha256d');
        this.watcher = new DaemonWatcher({ host: 'localhost', port: 19334, username: 'testuser', password: 'testpass' });
        this.taskConstructor = new TaskConstructor('mpyAvAewJDJZfDYSRNaegoPZ2BTcTPe3Cc', [{ address: 'myQ7AV6LfpJwGLrzPBHy7WLFdDJ1Lp81Lc', percent: 50 }]);
        this.sharesManager = new SharesManager('scrypt');
        this.taskConstructor.extraNonceSize = ExtraNonceSize;
        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    currentTask: Task;

    handleBlockTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        console.info('new block height: ', template.height);
        this.sharesManager.updateGbt(template);

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
                sender.sendDifficulty(0.02502);
                if (!me.currentTask) return;
                sender.sendTask(me.currentTask.stratumParams);
            });
            client.onEnd((sender) => {
                console.log('End: ', sender.miner);
                me.clients.delete(sender);
            });
            client.onKeepingAliveTimeout(sender => {
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
                    client.touchBad();
                    return;
                }

                if (share.shareHex) {
                    this.watcher.submitBlockAsync(share.shareHex);
                    console.info('new block found!!!!!!');
                    console.info('hash: ', share.shareHash);
                    console.info('new block found!!!!!!');
                }
                let validity = share.shareDiff > sender.difficulty;
                client.sendSubmissionResult(msg.id, validity, null);

                if (!validity) client.touchBad();

                // console.log(msg.id, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime, result.taskId, me.currentTask.taskId);
                // console.log('share diff', share ? share.shareDiff : 0);
            });
        }).listen(3333);

        this.stratumServer.on('error', (err) => console.log('stratum server error: ', err));
    }
}

new Pool().startStratumServer();


// net.createServer(async s => {
//     let data = await s.readAsync();
//     console.log(data.toString('utf8'));
//     s.once('end', () => s.end());
// }).listen(9999);