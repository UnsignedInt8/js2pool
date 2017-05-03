
import { Server, Socket } from "net";
import * as net from 'net';
import Node from "./Node";
import { Transaction } from "bitcoinjs-lib";
import { BaseShare } from "./shares";
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import Property from "../../nodejs/Property";
import { Version } from "./Messages/Version";

export type PeerOptions = {
    maxConn?: number,
    port: number,
}

export class Peer {

    private readonly server: Server;
    private readonly peers = new Map<string, Node>(); // ip:port -> Node
    private readonly knownTxs = Property.init(new Map<string, TransactionTemplate>());
    private readonly knownTxsCaches = new Array<Map<string, TransactionTemplate>>();
    private readonly miningTxs = Property.init(new Map<string, TransactionTemplate>());

    bestShare: BaseShare;
    desired: any[];

    constructor(opts: PeerOptions) {
        this.knownTxs.onPropertyChanged(this.onKnownTxsChanged.bind(this));
        this.miningTxs.onPropertyChanged(this.onMiningTxsChanged.bind(this));
        this.server = net.createServer(this.onSocketConnected.bind(this)).listen(opts.port);

    }

    private onSocketConnected(s: Socket) {
        let node = new Node();
        node.initSocket(s);
        node.sendVersionAsync();

        this.initNode(node);
    }

    private initNode(node: Node) {
        node.onVersionVerified(this.handleNodeVersion.bind(this));
        node.onRemember_tx(this.handleRemember_tx.bind(this));
        node.onEnd(function (sender: Node) { this.peers.delete(sender.tag) }.bind(this));

        this.peers.set(node.tag, node);
    }

    // ----------------- Node events -------------------

    private async handleNodeVersion(sender: Node, version: Version) {
        await sender.sendHave_txAsync(Array.from(this.knownTxs.value.keys()));
        await sender.sendRemember_txAsync({ hashes: [], txs: Array.from(this.miningTxs.value.values()) });
    }

    private handleRemember_tx(sender: Node, txHashes: string[], txs: Transaction[]) {
        for (let hash of txHashes) {
            if (sender.rememberedTxs.has(hash)) {
                console.error('Peer referenced transaction hash twice');
                sender.close(false);
                return;
            }

            let knownTx = this.knownTxs.value.get(hash) || this.knownTxsCaches.where(cache => cache.has(hash)).select(cache => cache.get(hash)).firstOrDefault();
            if (!knownTx) {
                console.info('Peer referenced unknown transaction %s, disconnecting', hash);
                sender.close(false);
                return;
            }

            sender.rememberedTxs.set(hash, /*Transaction.fromHex(knownTx.data)*/null);
        }

        let knownTxs = new Map(this.knownTxs.value);
        for (let tx of txs) {
            let txHash = tx.getHash();
            if (sender.rememberedTxs.has(txHash)) {
                console.info('Peer referenced transaction twice, disconnecting');
                sender.close(false);
                return;
            }

            sender.rememberedTxs.set(txHash, tx);
            knownTxs.set(txHash, { txid: txHash, hash: txHash, data: /*tx.toHex()*/null });
        }

        this.knownTxs.set(knownTxs);
    }

    // ----------------- Peer work ---------------------

    private onKnownTxsChanged(oldValue: Map<string, TransactionTemplate>, newValue: Map<string, TransactionTemplate>) {
        // update_remote_view_of_my_known_txs

        let added = newValue.except(oldValue).select(item => item[0]).toArray();
        let removed = oldValue.except(newValue).select(item => item[0]).toArray();;

        if (added.any()) {
            this.peers.forEach(p => p.sendHave_txAsync(added));
        }

        if (removed.any()) {
            this.peers.forEach(p => p.sendLosing_txAsync(removed));
        }

        this.knownTxsCaches.push(removed.select(hash => { return [hash, oldValue.get(hash)]; }).toMap<string, TransactionTemplate>())
        if (this.knownTxsCaches.length > 10) this.knownTxsCaches.shift();

        console.log('known txs changed, added: %d, removed: %d', added.length, removed.length)

    }

    private onMiningTxsChanged(oldValue: Map<string, TransactionTemplate>, newValue: Map<string, TransactionTemplate>) {
        // update_remote_view_of_my_mining_txs

        let added = newValue.except(oldValue).select(item => item[1]).toArray();
        let removed = oldValue.except(newValue).select(item => item[1]).toArray();

        if (added.any()) {
            this.peers.forEach(p => p.sendRemember_txAsync({ hashes: added.where(tx => p.remoteTxHashs.has(tx.txid || tx.hash)).select(tx => tx.txid || tx.hash).toArray(), txs: added.where(tx => !p.remoteTxHashs.has(tx.txid || tx.hash)).toArray() }));
        }

        if (removed.any()) {
            let totalSize = removed.sum(item => item.data.length / 2);
            this.peers.forEach(p => p.sendForget_txAsync(removed.map(tx => tx.txid || tx.hash), totalSize));
        }

        console.log('mining txs changed, added: %d, removed: %d, %dms', added.length, removed.length);
    }

    async initPeersAsync(peers: { host: string, port: number }[]) {
        for (let peer of peers) {
            let node = new Node();
            if (!await node.connectAsync(peer.host, peer.port)) continue;
            node.sendVersionAsync();
            this.initNode(node);
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

    removeDeprecatedTxs(txs: string[]) {
        let knownTxs = new Map(this.knownTxs.value);

        for (let tx of txs) {
            if (this.miningTxs.value.has(tx)) continue;
            knownTxs.delete(tx);
        }

        this.knownTxs.set(knownTxs);
    }
}