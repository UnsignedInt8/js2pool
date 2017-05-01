
import { Server, Socket } from "net";
import * as net from 'net';
import Node from "./Node";
import { Transaction } from "bitcoinjs-lib";
import { BaseShare } from "./shares";
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import Property from "../../nodejs/Property";
import { Version } from "./Messages/Version";

export type PeerOptions = {
    maxConn?: number;
}

export class Peer {

    private readonly server: Server;
    private readonly peers = new Map<string, Node>(); // ip:port -> Node
    private readonly knownTxs = Property.init(new Map<string, TransactionTemplate>());
    private readonly miningTxs = Property.init(new Map<string, TransactionTemplate>());

    bestShare: BaseShare;
    desired: any[];

    constructor(opts: PeerOptions) {
        this.knownTxs.onPropertyChanged(this.onKnownTxsChanged.bind(this));
        this.miningTxs.onPropertyChanged(this.onMiningTxsChanged.bind(this));
        this.server = net.createServer(this.onSocketConnected.bind(this));
    }

    listen(port: number) {
        this.server.listen(port);
    }

    private onSocketConnected(s: Socket) {
        let node = new Node();
        node.initSocket(s);
        node.sendVersionAsync();

        node.onVersionVerified(this.handleNodeVersion.bind(this));


        this.peers.set(node.tag, node);
    }

    // ----------------- Node events -------------------

    private async handleNodeVersion(sender: Node, version: Version) {
        await sender.sendHave_txAsync(this.knownTxs.value.keys().toArray());
        await sender.sendRemember_txAsync({ hashes: [], txs: this.miningTxs.value.values().toArray() }, this.miningTxs.value.values().sum(tx => tx.data.length / 2));
    }

    // ----------------- Peer work ---------------------

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

    private onMiningTxsChanged(oldValue: Map<string, TransactionTemplate>, newValue: Map<string, TransactionTemplate>) {
        // update_remote_view_of_my_mining_txs

        let added = newValue.except(oldValue, ([k1, v1], [k2, v2]) => k1 === k2).select(item => item[1]).toArray();
        let removed = oldValue.except(newValue, ([k1, v1], [k2, v2]) => k1 === k2).select(item => item[1]).toArray();

        if (added.any()) {
            let totalSize = added.sum(item => item.data.length / 2); // hex string to bytes
            this.peers.forEach(p => p.sendRemember_txAsync({ hashes: added.where(tx => p.remoteTxHashs.has(tx.txid || tx.hash)).select(tx => tx.txid || tx.hash).toArray(), txs: added.where(tx => !p.remoteTxHashs.has(tx.txid || tx.hash)).toArray() }, totalSize));
        }

        if (removed.any()) {
            let totalSize = removed.sum(item => item.data.length / 2);
            this.peers.forEach(p => p.sendForget_txAsync(removed.select(tx => tx.txid || tx.hash).toArray(), totalSize));
        }
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