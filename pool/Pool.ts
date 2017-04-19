
import BlocksWatcher, { GetBlockTemplate } from "./BlocksWatcher";
import * as merkle from 'merkle-lib';
import { Algos } from '../misc/Algos';
import * as Utils from '../misc/Utils';
import MerkleTree from "./MerkleTree";
import TaskConstructor from "./TaskConstructor";
import { Server } from "net";
import * as net from 'net';
import StratumClient from "./StratumClient";
import * as kinq from 'kinq';

kinq.enable();

export default class Pool {
    watcher: BlocksWatcher;
    taskConstructor: TaskConstructor;
    stratumServer: Server;

    clients = new Set<StratumClient>();

    constructor() {
        this.watcher = new BlocksWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        this.taskConstructor = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');

        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }
    currentTask: any[];

    handleBlockTemplateUpdated(sender: BlocksWatcher, template: GetBlockTemplate) {
        console.log(template.height);
        let auxTree = MerkleTree.buildMerkleTree(template.auxes || []);
        let task = this.taskConstructor.buildTask(template, auxTree.root, auxTree.data.length);
        this.currentTask = task;
        for (let item of this.clients) {
            item.sendTask(task);
        }
    }

    startStratumServer() {
        let me = this;
        this.stratumServer = net.createServer(s => {
            let client = new StratumClient(s);
            console.log('new client: ', s.remoteAddress);
            me.clients.add(client);

            client.onSubscribe((sender, msg) => { sender.sendSubscription(msg.id, '08000002', 4); });
            client.onAuthorize((sender, name, pass, msg) => {
                sender.sendAuthorization(msg.id, true);
                sender.sendDifficulty(1);
                if (me.currentTask) sender.sendTask(me.currentTask);
            });
            client.onEnd((sender) => me.clients.delete(sender));
            client.onSubmit((sender, result, msg) => {
                console.log(result);
            });
        }).listen(3333);


    }
}

new Pool().startStratumServer();