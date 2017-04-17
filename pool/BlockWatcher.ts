import Client from 'bitcoin-core';
const BitcoinClient = require('bitcoin-core');

type Options = {
    host: string,
    port: number,
    username: string,
    password: string,
}

export default class BlockWatcher {
    client: Client;

    constructor(opts: Options) {
        this.client = new BitcoinClient(opts) as Client;
    }

    async refreshBlockTemplateAsync() {
        let value: GetBlockTemplate = await this.client.command('getblocktemplate');
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