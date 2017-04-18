
import BlocksWatcher, { GetBlockTemplate } from "./BlocksWatcher";
import * as merkle from 'merkle-lib';
import { Algos } from '../misc/Algos';
import * as Utils from '../misc/Utils';
import MerkleTree from "./MerkleTree";
import TaskConstructor from "./TaskConstructor";

export default class Pool {
    watcher: BlocksWatcher;
    taskConstructor: TaskConstructor;

    constructor() {
        this.watcher = new BlocksWatcher({ host: 'localhost', port: 19001, username: 'admin1', password: '123' });
        this.taskConstructor = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');

        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    handleBlockTemplateUpdated(sender: BlocksWatcher, template: GetBlockTemplate) {
        console.log(template.height);
        let task = this.taskConstructor.buildTask(template);
        console.log(task);
    }
}

new Pool();
process.stdin.resume();