
import BlockchainWatcher, { GetBlockTemplate } from "./BlockchainWatcher";
import * as merkle from 'merkle-lib';
import { Algos } from '../misc/Algos';
import * as Utils from '../misc/Utils';
import MerkleTree from "./MerkleTree";
import TaskConstructor, { Task } from "./TaskConstructor";
import { Server } from "net";
import * as net from 'net';
import StratumClient from "./StratumClient";
import * as kinq from 'kinq';
// import TaskManager from "./TaskManager";
import * as assert from 'assert';

kinq.enable();

export default class Pool {
    watcher: BlockchainWatcher;
    taskConstructor: TaskConstructor;
    // taskManager = new TaskManager();
    stratumServer: Server;

    clients = new Set<StratumClient>();

    constructor() {
        this.watcher = new BlockchainWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        this.taskConstructor = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');

        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    currentTask: Task;

    handleBlockTemplateUpdated(sender: BlockchainWatcher, template: GetBlockTemplate) {
        console.log(template.height);
        // this.taskManager.cleanTasks();

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
                sender.sendDifficulty(0.02);
                if (!me.currentTask) return;

                // let task = me.taskManager.createTask(me.currentTaskTemplate);
                sender.sendTask(me.currentTask.stratumParams);
            });
            client.onEnd((sender) => {
                console.log('End: ', sender.miner);
                me.clients.delete(sender);
            });
            client.onSubmit((sender, result, msg) => {

                // let solved = me.taskManager.hasTask(result.taskId);
                // assert.equal(solved, true);
                // me.taskManager.deleteTask(result.taskId);
                client.sendSubmissionResult(msg.id, result.taskId == me.currentTask.taskId, null);
                // client.sendTask(me.taskManager.createTask(me.currentTaskTemplate).stratumParams);
                console.log(msg.id, result.nonce, result.nTime, result.taskId, me.currentTask.taskId);
            });
        }).listen(3333);


    }
}

new Pool().startStratumServer();