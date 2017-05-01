
import Node from "./Node";
import { Transaction } from "bitcoinjs-lib";
import { BaseShare } from "./shares";
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import Property from "../../nodejs/Property";

export type PeerOptions = {

}

export class Peer {

    readonly peers = new Array<Node>();
    readonly knownTxs = Property.init(new Map<string, TransactionTemplate>());
    readonly miningTxs = Property.init(new Map<string, TransactionTemplate>());
    bestShare: BaseShare;
    desired: any[];


    constructor(opts: PeerOptions) {

        this.knownTxs.onPropertyChanged(this.onKnownTxsChanged.bind(this));
    }

    private onKnownTxsChanged(oldValue: Map<string, TransactionTemplate>, newValue: Map<string, TransactionTemplate>) {
        // update_remote_view_of_my_known_txs

        let added = newValue.except(oldValue, ([k1, v1], [k2, v2]) => k1 === k2).select(item => item[0]).toArray();
        let removed = oldValue.except(newValue, ([k1, v1], [k2, v2]) => k1 === k2).select(item => item[0]).toArray();

        if (added.any()) {
            this.peers.forEach(p => p.sendHave_txAsync(added));
        }

        if (removed.any()) {
            this.peers.forEach(p => p.sendLosing_txAsync(removed));
        }

        // # cache forgotten txs here for a little while so latency of "losing_tx" packets doesn't cause problems
        // key = max(self.known_txs_cache) + 1 if self.known_txs_cache else 0
        // self.known_txs_cache[key] = dict((h, before[h]) for h in removed)
        // reactor.callLater(20, self.known_txs_cache.pop, key)
    }

    updateGbt(template: GetBlockTemplate) {
        let miningTxs = new Map<string, TransactionTemplate>();
        let knownTxs = new Map(this.knownTxs.value);

        template.transactions.forEach(tx => {
            miningTxs.set(tx.txid || tx.hash, tx);
            knownTxs.set(tx.txid || tx.hash, tx);
        });

        this.miningTxs.set(miningTxs);
        this.knownTxs.set(knownTxs);
    }
}