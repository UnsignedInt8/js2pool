
import BlocksWatcher, { GetBlockTemplate } from "./BlocksWatcher";

export default class Pool {
    watcher: BlocksWatcher;

    constructor() {
        this.watcher = new BlocksWatcher({ host: 'localhost', port: 8332, username: 'testuser', password: 'testpass' });
        this.watcher.beginWatching();
        this.watcher.onBlockTemplateUpdated(this.handleBlockTemplateUpdated.bind(this));
    }

    handleBlockTemplateUpdated(sender: BlocksWatcher, template: GetBlockTemplate) {

    }
}

new Pool();
process.stdin.resume();