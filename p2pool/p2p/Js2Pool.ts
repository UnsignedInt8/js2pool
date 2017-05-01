
import { DaemonWatcher, DaemonOptions, GetBlockTemplate } from "../../core/DaemonWatcher";

export type Js2PoolOptions = {
    daemon: DaemonOptions;
}

export class Js2Pool {

    private daemonWatcher: DaemonWatcher;

    constructor(opts: Js2PoolOptions) {
        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onMiningTemplateUpdated.bind(this));
    }

    private onMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {

    }
}