/*
 * Created on Wed May 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import Bitcoin from "./coins/Bitcoin";
import { DaemonOptions } from "../core/DaemonWatcher";
import { PeerOptions } from "./p2p/Peer";
import { BaseShare } from "./p2p/shares";
import { Message } from "./p2p/Message";
import { SharechainHelper } from "./chain/SharechainHelper";
import Sharechain from "./chain/Sharechain";
import logger from '../misc/Logger';
import { SharechainBuilder } from "./chain/SharechainBuilder";
import { StratumOptions, Js2Pool } from "./pool/Js2Pool";
import { DefaultWorkerManager } from "./pool/DefaultWorkerManager";

export type AppOptions = {
    coin: { name: string, algorithm: string, },
    daemons: DaemonOptions[],
    peer: PeerOptions,
    stratum: StratumOptions,
    bootstrapPeers: { host: string, port: number }[],
    address: string,
}

export class App {
    readonly coins = new Map([['bitcoin', Bitcoin]]);

    constructor(opts: AppOptions) {
        let coiname = opts.coin.name.toLowerCase();
        let coin = this.coins.get(coiname);
        if (!coin) throw Error(`${opts.coin.name} is not supported`);

        BaseShare.MAX_TARGET = coin.MAX_TARGET;
        BaseShare.IDENTIFIER = coin.IDENTIFIER;
        BaseShare.SEGWIT_ACTIVATION_VERSION = coin.SEGWIT_ACTIVATION_VERSION;
        BaseShare.POWFUNC = coin.POWFUNC;
        Message.MAGIC = coin.MSGPREFIX;
        SharechainBuilder.MIN_TARGET = Bitcoin.MIN_TARGET;
        SharechainBuilder.MAX_TARGET = Bitcoin.MAX_TARGET;
        SharechainBuilder.TARGET_LOOKBEHIND = Bitcoin.TARGET_LOOKBEHIND;
        SharechainBuilder.PERIOD = Bitcoin.SHARE_PERIOD;

        logger.info('|-------------------- JS2POOL ---------------------|');
        logger.info('|                                                  |');
        logger.info('|----- https://github.com/unsignedint8/js2pool ----|')
        logger.info('|                                                  |');
        logger.info('|-- Donation: 1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9 --|');
        logger.info('|                                                  |');
        logger.info('|---------- A DECENTRALIZED MINING POOL -----------|');
        logger.info('');
        logger.info('');
        logger.info('');

        let chain = Sharechain.Instance;
        SharechainHelper.init(coiname);
        SharechainHelper.loadSharesAsync().then(shares => {
            chain.add(shares);
            chain.fix();

            new Js2Pool({
                daemons: opts.daemons,
                address: opts.address,
                algorithm: coin.ALGORITHM,
                peer: opts.peer,
                stratum: opts.stratum,
                bootstrapPeers: opts.bootstrapPeers,
            }, DefaultWorkerManager.Instance);
        });

        process.on('uncaughtException', (err) => logger.error(err));
        process.on('error', (err) => logger.error(err));
    }
}