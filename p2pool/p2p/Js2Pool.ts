
import { DaemonWatcher, DaemonOptions, GetBlockTemplate } from "../../core/DaemonWatcher";
import { Peer, PeerOptions } from "./Peer";
import Bitcoin from './coins/Bitcoin';
import { BaseShare } from "./shares/index";
import { Algos } from "../../core/Algos";

export type Js2PoolOptions = {
    daemon: DaemonOptions,
    server: PeerOptions,
    coin: {
        name: string,
        algo: string,
    }

    bootstrapPeers: { host: string, port: number }[],
}

export class Js2Pool {

    private daemonWatcher: DaemonWatcher;
    private peer: Peer;
    private readonly blocks = new Array<string>();

    constructor(opts: Js2PoolOptions) {
        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onMiningTemplateUpdated.bind(this));
        this.daemonWatcher.onBlockNotified(this.onBlockNotified.bind(this));
        this.daemonWatcher.beginWatching();

        this.peer = new Peer(opts.server);
        this.peer.initPeersAsync(opts.bootstrapPeers);

        let coins = new Map([['bitcoin', Bitcoin]]);
        let targetCoin = coins.get(opts.coin.name);
        if (!targetCoin) throw Error('unknown coin name');
        BaseShare.MAX_TARGET = targetCoin.MAX_TARGET;
        BaseShare.IDENTIFIER = targetCoin.IDENTIFIER;
        BaseShare.SEGWIT_ACTIVATION_VERSION = targetCoin.SEGWIT_ACTIVATION_VERSION;
        BaseShare.PowFunc =  targetCoin.POWFUNC;
    }

    private onMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        console.log('template update');
        this.peer.updateGbt(template);
    }

    private async onBlockNotified(sender: DaemonWatcher, hash: string) {
        if (this.blocks.includes(hash)) return;

        this.blocks.push(hash);
        if (this.blocks.length < 4) return;

        let oldest = this.blocks.shift();
        let block = await this.daemonWatcher.getBlockAsync(oldest);
        if (!block) return;

        this.peer.removeDeprecatedTxs(block.tx);
        console.log('clean txs: ', block.tx.length);
    }
}