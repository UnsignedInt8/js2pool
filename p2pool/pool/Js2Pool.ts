
import { DaemonWatcher, DaemonOptions, GetBlockTemplate } from "../../core/DaemonWatcher";
import { Peer, PeerOptions } from "../p2p/Peer";
import Bitcoin from '../coins/Bitcoin';
import { BaseShare } from "../p2p/shares/index";
import { Algos } from "../../core/Algos";
import logger from '../../misc/Logger';
import * as Bignum from 'bignum';
import * as kinq from 'kinq';
import Sharechain from "../chain/Sharechain";
import { SharechainHelper } from "../chain/SharechainHelper";
import { ShareGenerator } from "../chain/ShareGenerator";

export type Js2PoolOptions = {
    daemon: DaemonOptions,
    server: PeerOptions,

    bootstrapPeers: { host: string, port: number }[],
}

export class Js2Pool {

    private daemonWatcher: DaemonWatcher;
    private generator = new ShareGenerator('');
    private readonly blocks = new Array<string>();
    private sharechain = Sharechain.Instance;
    peer: Peer;

    constructor(opts: Js2PoolOptions) {
        this.sharechain.onNewestChanged(this.onNewestShareChanged.bind(this));
        this.sharechain.onCandidateArrived(this.onNewestShareChanged.bind(this));

        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onMiningTemplateUpdated.bind(this));
        this.daemonWatcher.onBlockNotified(this.onBlockNotified.bind(this));
        this.daemonWatcher.beginWatching();

        this.peer = new Peer(opts.server);
        this.peer.initPeersAsync(opts.bootstrapPeers);
    }

    private onNewestShareChanged(sender: Sharechain, share: BaseShare) {
        this.daemonWatcher.refreshBlockTemplateAsync();
        if (sender.size % 5 === 0)
            SharechainHelper.saveShares(kinq.toLinqable(sender.subchain(share.hash, 10, 'backward')).skip(5));
    }

    private onMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        this.peer.updateMiningTemplate(template);

        let newestShare = this.sharechain.newest;
        if (!newestShare.hasValue() || !this.sharechain.calculatable) return;
        this.generator.generateTx(template, newestShare.value.info.data.previousShareHash, new Bignum(0), []);
    }

    private async onBlockNotified(sender: DaemonWatcher, hash: string) {
        if (this.blocks.includes(hash)) return;
        this.sharechain.checkGaps(); // check gaps when new blocks be found

        this.blocks.push(hash);
        if (this.blocks.length < 4) return;

        let oldest = this.blocks.shift();
        let block = await this.daemonWatcher.getBlockAsync(oldest);
        if (!block) return;

        this.peer.removeDeprecatedTxs(block.tx);
        logger.info('clean deprecated txs: ', block.tx.length);
    }
}