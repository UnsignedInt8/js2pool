
import { Server, Socket } from "net";
import * as net from 'net';
import Node from "./Node";
import { Transaction } from "bitcoinjs-lib";
import { BaseShare } from "./shares";
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, TransactionTemplate } from "../../core/DaemonWatcher";
import Property from "../../nodejs/Property";
import { Version } from "./Messages/Version";
import { TypeShares } from "./Messages/Shares";

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
        this.server.on('error', error => { console.error(error.message); throw error; });
    }

    private onSocketConnected(s: Socket) {
        let node = new Node();
        node.initSocket(s);
        node.sendVersionAsync();

        this.registerNode(node);
    }


    // ----------------- Node message events -------------------

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

    private handleShares(sender: Node, shares: TypeShares[]) {
        if (shares.length == 0) return;

        let result = new Array<{ share: BaseShare, txs: TransactionTemplate[] }>();

        for (let share of shares.where(s => s.contents && s.contents.validity).select(s => s.contents)) {

            let txs = new Array<TransactionTemplate>();

            for (let txHash of share.newTxHashes) {
                if (this.knownTxs.value.has(txHash)) {
                    txs.push(this.knownTxs.value.get(txHash));
                    continue;
                }

                let cache = this.knownTxsCaches.firstOrDefault(c => c.has(txHash), null);
                if (!cache) {
                    sender.close(true, 'Peer referenced unknown transaction, disconnecting');
                    return;
                }

                txs.push(cache.get(txHash));
            }

            result.push({ share, txs });
        }


    }

    // ----------------- Peer work ---------------------

    private registerNode(node: Node) {
        node.onVersionVerified(this.handleNodeVersion.bind(this));
        node.onRemember_tx(this.handleRemember_tx.bind(this));
        node.onShares(this.handleShares.bind(this));
        node.onEnd(function (sender: Node) { this.peers.delete(sender.tag) }.bind(this));
        this.peers.set(node.tag, node);
    }

    /**
     * update_remote_view_of_my_known_txs
     */
    private onKnownTxsChanged(oldValue: Map<string, TransactionTemplate>, newValue: Map<string, TransactionTemplate>) {

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

    /**
     * update_remote_view_of_my_mining_txs
     */
    private onMiningTxsChanged(oldValue: Map<string, TransactionTemplate>, newValue: Map<string, TransactionTemplate>) {

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
            this.registerNode(node);
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