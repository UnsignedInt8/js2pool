import * as net from 'net';
import Client from 'bitcoin-core';
import { Event } from "../nodejs/Event";
import { Socket, Server } from "net";
const BitcoinClient = require('bitcoin-core');
import logger from '../misc/Logger';

export type DaemonOptions = {
    host: string,
    port: number,
    username: string,
    password: string,
    blocknotifylistener?: BlockNotifyOptions,
}

export type BlockNotifyOptions = {
    enabled: boolean,
    port: number,
    host: string,
}

export class DaemonWatcher extends Event {
    private client: Client;
    private blockHeight = 0;
    private timerId: NodeJS.Timer;
    private lastNotifiedHash: string;
    private blockNotifyServer: Server;

    static Events = {
        blockTemplateUpdate: 'BlockTemplateUpdated',
        error: 'Error',
        blockNotified: 'BlockNotified',
    };

    constructor(opts: DaemonOptions) {
        super();
        this.client = new BitcoinClient(opts) as Client;

        if (opts.blocknotifylistener && opts.blocknotifylistener.enabled) {
            this.blockNotifyServer = net.createServer(this.onBlockNotifyingSocketConnected.bind(this)).listen(opts.blocknotifylistener.port, opts.blocknotifylistener.host);
        }
    }

    private async onBlockNotifyingSocketConnected(s: Socket) {
        s.once('end', () => s.end());

        let hash = (await s.readAsync()).toString('utf8');
        if (!hash) return;
        if (this.lastNotifiedHash === hash) return;

        await this.refreshBlockTemplateAsync();
        super.trigger(DaemonWatcher.Events.blockNotified, this, hash);
        logger.info(`new block notified: ${hash}`);
    }

    beginWatching() {
        try {
            if (this.blockNotifyServer) return;

            let me = this;
            if (me.timerId) clearTimeout(me.timerId);
            me.timerId = setInterval(async () => await me.refreshMiningInfoAsync(), 250);
        } finally {
            this.refreshMiningInfoAsync();
        }
    }

    async refreshMiningInfoAsync() {
        try {
            let value: GetMiningInfo = await this.client.command('getmininginfo');
            if (value.blocks <= this.blockHeight) return true;
            await this.refreshBlockTemplateAsync();
            return true;
        } catch (error) {
            logger.error(error);
            this.trigger(DaemonWatcher.Events.error, this, error);
            return false;
        }
    }

    async submitBlockAsync(blockHex: string) {
        try {
            let results: any[] = await this.client.command([{ method: 'submitblock', parameters: [blockHex] }]);
            logger.info(results);
            let result = results.first();
            if (result == null) return true;
            if (typeof (result) === 'string') return false;
            if (result.error || result.result === 'reject') return false;
            return true;
        } catch (error) {
            logger.error(`submit block error: ${error}`, );
            return false;
        }
    }

    async refreshBlockTemplateAsync() {
        try {
            let values: GetBlockTemplate[] = await this.client.command([{ method: 'getblocktemplate', parameters: [{ rules: ['segwit'] }] }]);
            let template = values.first();
            this.blockHeight = template.height - 1;
            super.trigger(DaemonWatcher.Events.blockTemplateUpdate, this, template);
        } catch (error) {
            logger.error(error);
            this.trigger(DaemonWatcher.Events.error, this, error);
        }
    }

    async getBlockAsync(hash: string) {
        try {
            let blocks: BlockTemplate[] = await this.client.command([{ method: 'getblock', parameters: [hash] }]);
            return blocks.first();
        } catch (error) {

        }
    }

    onBlockTemplateUpdated(callback: (sender: DaemonWatcher, template: GetBlockTemplate) => void) {
        super.register(DaemonWatcher.Events.blockTemplateUpdate, callback);
    }

    onError(callback: (sender: DaemonWatcher, error) => void) {
        super.register(DaemonWatcher.Events.error, callback);
    }

    onBlockNotified(callback: (sender: DaemonWatcher, hash: string) => void) {
        super.register(DaemonWatcher.Events.blockNotified, callback);
    }
}

export type TransactionTemplate = {
    data: string,
    txid: string,
    hash: string,
    depends?: any[],
    fee?: number,
    sigops?: number,
    weight?: number,
}

export type GetBlockTemplate = {
    // BTC
    capabilities: string[],
    version: number,
    rules: string[],
    vbavailable?: { segwit: number },
    vbrequired?: number,
    previousblockhash: string,
    transactions: TransactionTemplate[],
    coinbaseaux?: {
        flags: string
    },
    coinbasevalue: number,
    longpollid: string,
    target: string, // hex string
    mintime: number,
    mutable?: string[], // time, transactions, prevblock
    noncerange: string, // hex string
    sigoplimit?: number,
    sizelimit: number,
    curtime: number,
    bits: string,
    height: number,
    default_witness_commitment?: string,

    // Dashcoin
    superblock?: any,
    masternode?: any,
    masternode_payments?: any,

    // Others
    payee?: any,
    payee_amount?: number,
    votes?: any[],

    // Custom aera
    auxes?: any,
}

export type GetMiningInfo = {
    blocks: number,
    currentblocksize: number,
    currentblockweight: number,
    currentblocktx: number,
    difficulty: number,
    errors: string,
    networkhashps: number,
    pooledtx: number,
    chain: string
}

export type BlockTemplate = {
    hash: string,
    confirmations: number,
    strippedsize: number,
    size: number,
    weight: number,
    height: number,
    version: number,
    versionHex: string,
    merkleroot: string,
    tx: string[],
    time: number,
    mediantime: number,
    nonce: number,
    bits: string,
    difficulty: number,
    chainwork: string,
    previousblockhash: string,
    nextblockhash?: string
}
