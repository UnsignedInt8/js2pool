/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Bitcoin from "./coins/Bitcoin";
import { DaemonOptions } from "../core/DaemonWatcher";
import { PeerOptions } from "./p2p/Peer";
import { BaseShare } from "./p2p/shares";
import { Message } from "./p2p/Message";
import { SharechainHelper } from "./p2p/shares/SharechainHelper";
import Sharechain from "./p2p/shares/Sharechain";
import logger from '../misc/Logger';

export type AppOptions = {
    coin: { name: string, },
    daemon: DaemonOptions,
    server: PeerOptions,
    bootstrapPeers: { host: string, port: number }[],
}

export class App {
    readonly coins = new Map([['bitcoin', Bitcoin]]);

    constructor(opts: AppOptions) {
        let coiname = opts.coin.name.toLowerCase();
        let coin = this.coins.get(coiname);
        if (!coin) throw Error(`${opts.coin.name} not be supported`);

        BaseShare.MAX_TARGET = coin.MAX_TARGET;
        BaseShare.IDENTIFIER = coin.IDENTIFIER;
        BaseShare.SEGWIT_ACTIVATION_VERSION = coin.SEGWIT_ACTIVATION_VERSION;
        BaseShare.PowFunc = coin.POWFUNC;
        Message.MAGIC = coin.MSGPREFIX;

        logger.info('|-------------- BOOTING JS2POOL --------------|');
        logger.info('|                                             |');
        logger.info('|-- https://github.com/unsignedint8/js2pool --|')
        logger.info('|                                             |');
        logger.info('|----------- Initializing Sharechain ---------|');

        let chain = Sharechain.Instance;
        SharechainHelper.init(coiname);
        let shares = SharechainHelper.loadShares();
        chain.add(shares);
    }
}