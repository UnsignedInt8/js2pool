import Client from 'bitcoin-core';
import { Event } from "../nodejs/Event";
const BitcoinClient = require('bitcoin-core');

type Options = {
    host: string,
    port: number,
    username: string,
    password: string,
}

let Events = {
    blockTemplateUpdate: 'BlockTemplateUpdated',
}

export default class BlocksWatcher extends Event {
    private client: Client;
    private blockHeight = 0;
    private timerId: NodeJS.Timer;

    constructor(opts: Options) {
        super();
        this.client = new BitcoinClient(opts) as Client;
    }

    beginWatching() {
        let me = this;
        if (me.timerId) clearTimeout(me.timerId);

        me.timerId = setInterval(async () => {
            try {
                let value: GetMiningInfo = await me.client.command('getmininginfo');
                if (value.blocks <= me.blockHeight) return;
                this.blockHeight = value.blocks;
                await me.refreshBlockTemplateAsync();
            } catch (error) { }
        }, 500);
    }

    private async refreshBlockTemplateAsync() {
        try {
            let value: GetBlockTemplate = await this.client.command('getblocktemplate');
            super.trigger(Events.blockTemplateUpdate, this, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    onBlockTemplateUpdated(callback: (sender: BlocksWatcher, template: GetBlockTemplate) => void) {
        super.register(Events.blockTemplateUpdate, callback);
    }
}

export type GetBlockTemplate = {
    // BTC
    capabilities: string[],
    version: number,
    rules: string[],
    vbavailable?: { segwit: number },
    vbrequired?: number,
    previousblockhash: string,
    transactions: [{
        data: string,
        txid: string,
        hash: string,
        depends?: any[],
        fee: number,
        sigops: number,
        weight: number,
    }],
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
