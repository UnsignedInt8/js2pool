
import { DaemonWatcher, DaemonOptions, GetBlockTemplate } from "../core/DaemonWatcher";
import { Peer, PeerOptions } from "./p2p/Peer";
import Bitcoin from './coins/Bitcoin';
import { BaseShare } from "./p2p/shares/index";
import { Algos } from "../core/Algos";
import logger from '../misc/Logger';
import Sharechain from "./p2p/shares/Sharechain";
import { SharechainHelper } from "./p2p/shares/SharechainHelper";

export type Js2PoolOptions = {
    daemon: DaemonOptions,
    server: PeerOptions,
    coin: {
        name: string,
    }

    bootstrapPeers: { host: string, port: number }[],
}

export class Js2Pool {

    private daemonWatcher: DaemonWatcher;
    private peer: Peer;
    private readonly blocks = new Array<string>();

    constructor(opts: Js2PoolOptions) {
        Sharechain.Instance.onNewestChanged(this.onNewestShareChanged.bind(this));
        Sharechain.Instance.onCandidateArrived(this.onNewestShareChanged.bind(this));

        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onMiningTemplateUpdated.bind(this));
        this.daemonWatcher.onBlockNotified(this.onBlockNotified.bind(this));
        this.daemonWatcher.beginWatching();

        let coins = new Map([['bitcoin', Bitcoin]]);
        let targetCoin = coins.get(opts.coin.name);
        if (!targetCoin) throw Error(`${opts.coin.name} not be supported`);

        BaseShare.MAX_TARGET = targetCoin.MAX_TARGET;
        BaseShare.IDENTIFIER = targetCoin.IDENTIFIER;
        BaseShare.SEGWIT_ACTIVATION_VERSION = targetCoin.SEGWIT_ACTIVATION_VERSION;
        BaseShare.PowFunc = targetCoin.POWFUNC;

        this.peer = new Peer(opts.server);
        this.peer.initPeersAsync(opts.bootstrapPeers);
    }

    private onNewestShareChanged(sender: Sharechain, share: BaseShare) {
        this.daemonWatcher.refreshBlockTemplateAsync();
        if (sender.size % 5 === 0)
            SharechainHelper.saveShares(Array.from(sender.subchain(share.hash, 2, 'backward')));
    }

    private onMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        logger.info('update mining template');
        this.peer.updateMiningTemplate(template);
    }

    private async onBlockNotified(sender: DaemonWatcher, hash: string) {
        if (this.blocks.includes(hash)) return;
        Sharechain.Instance.checkGaps(); // check gaps when new blocks be found

        this.blocks.push(hash);
        if (this.blocks.length < 4) return;

        let oldest = this.blocks.shift();
        let block = await this.daemonWatcher.getBlockAsync(oldest);
        if (!block) return;

        this.peer.removeDeprecatedTxs(block.tx);
        logger.info('clean deprecated txs: ', block.tx.length);
    }
}