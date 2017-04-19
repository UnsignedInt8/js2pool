
import BlockchainWatcher, { GetBlockTemplate } from "./BlockchainWatcher";
import * as merkle from 'merkle-lib';
import { Algos } from '../misc/Algos';
import * as Utils from '../misc/Utils';
import MerkleTree from "./MerkleTree";
import TaskConstructor from "./TaskConstructor";
import { Server } from "net";
import * as net from 'net';
import StratumClient from "./StratumClient";
import * as kinq from 'kinq';
import TaskManager from "./TaskManager";

kinq.enable();

export default class Pool {
    watcher: BlockchainWatcher;
    taskConstructor: TaskConstructor;
    taskManager = new TaskManager();
    stratumServer: Server;

    clients = new Set<StratumClient>();

    constructor() {
        this.watcher = new BlockchainWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        this.taskConstructor = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');

        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    currentTaskTemplate: (string | boolean | string[])[];

    handleBlockTemplateUpdated(sender: BlockchainWatcher, template: GetBlockTemplate) {
        console.log(template.height);
        this.taskManager.cleanTasks();

        let auxTree = MerkleTree.buildMerkleTree(template.auxes || []);
        let taskTemplate = this.taskConstructor.buildTaskParamsTemplate(template, auxTree.root, auxTree.data.length);
        this.currentTaskTemplate = taskTemplate;

        for (let item of this.clients) {
            item.sendTask(taskTemplate);
        }

    }

    startStratumServer() {
        let me = this;
        this.stratumServer = net.createServer(s => {
            let client = new StratumClient(s, 4);
            console.log('new client: ', s.remoteAddress);
            me.clients.add(client);

            client.onSubscribe((sender, msg) => { sender.sendSubscription(msg.id, 4); });
            client.onAuthorize((sender, name, pass, msg) => {
                sender.sendAuthorization(msg.id, true);
                sender.sendDifficulty(0.01);
                if (!me.currentTaskTemplate) return;

                let task = me.taskManager.createTask(me.currentTaskTemplate);
                sender.sendTask(task.stratumParams);
            });
            client.onEnd((sender) => {
                console.log('End: ', sender.miner);
                me.clients.delete(sender);
            });
            client.onSubmit((sender, result, msg) => {
                console.log(result);
                result.taskId
                client.sendSubmissionResult(msg.id, true, null);
            });
        }).listen(3333);


    }
}

new Pool().startStratumServer();