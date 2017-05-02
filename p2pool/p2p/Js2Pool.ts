
import { DaemonWatcher, DaemonOptions, GetBlockTemplate } from "../../core/DaemonWatcher";

export type Js2PoolOptions = {
    daemon: DaemonOptions;

    blocknotifylistener?: {
        enabled: boolean,
        port: number,
        host: string,
    },
}

export class Js2Pool {

    private daemonWatcher: DaemonWatcher;

    constructor(opts: Js2PoolOptions) {
        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onMiningTemplateUpdated.bind(this));

        if (opts.blocknotifylistener && opts.blocknotifylistener.enabled) {
            
            return;
        }

        this.daemonWatcher.beginWatching();
    }

    private onMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {

    }
}