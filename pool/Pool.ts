
import DaemonWatcher, { GetBlockTemplate } from "./DaemonWatcher";
import * as merkle from 'merkle-lib';
import { Algos } from '../misc/Algos';
import * as Utils from '../misc/Utils';
import MerkleTree from "./MerkleTree";
import TaskConstructor, { Task } from "./TaskConstructor";
import { Server } from "net";
import * as net from 'net';
import StratumClient from "./StratumClient";
import * as kinq from 'kinq';
import * as assert from 'assert';
import SharesManager from "./SharesManager";

kinq.enable();

export default class Pool {
    watcher: DaemonWatcher;
    taskConstructor: TaskConstructor;
    sharesManager: SharesManager;
    stratumServer: Server;

    clients = new Set<StratumClient>();

    constructor() {
        this.watcher = new DaemonWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        this.taskConstructor = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');
        this.sharesManager = new SharesManager('sha256d');
        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    currentTask: Task;

    handleBlockTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        console.log(template.height);
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
            let client = new StratumClient(s, 4);
            me.clients.add(client);
            
            client.onSubscribe((sender, msg) => { sender.sendSubscription(msg.id, 4); });
            client.onAuthorize((sender, name, pass, msg) => {
                sender.sendAuthorization(msg.id, true);
                sender.sendDifficulty(0.002);
                if (!me.currentTask) return;
                sender.sendTask(me.currentTask.stratumParams);
            });
            client.onEnd((sender) => {
                console.log('End: ', sender.miner);
                me.clients.delete(sender);
            });
            client.onSubmit((sender, result, msg) => {
                let share = me.sharesManager.buildShare(me.currentTask, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime);
                if (share.shareHex) this.watcher.submitBlockAsync(share.shareHex);

                client.sendSubmissionResult(msg.id, share != null, null);
                console.log(msg.id, result.nonce, result.nTime, result.taskId, me.currentTask.taskId);
            });
        }).listen(3333);


    }
}

new Pool().startStratumServer();