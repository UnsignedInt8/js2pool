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
import { Js2Pool } from "./pool/Js2Pool";
import { DefaultWorkerManager } from "./pool/DefaultWorkerManager";
import * as cluster from 'cluster';
import { StratumOptions, StratumServer } from "./pool/StratumServer";

export type AppOptions = {
    coin: { name: string, algorithm: string, },
    daemons: DaemonOptions[],
    peer: PeerOptions,
    stratum: { port: number },
    bootstrapPeers: { host: string, port: number }[],
    address: string,
}

const Cmds = {
    updateTask: 'UpdateTask',
    sendResult: 'SendResult',
}

export async function App(opts: AppOptions) {
    let coins = new Map([['bitcoin', Bitcoin]]);

    let coiname = opts.coin.name.toLowerCase();
    let coin = coins.get(coiname);
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

    process.on('uncaughtException', (err) => logger.error(err));
    process.on('error', (err) => logger.error(err));

    if (cluster.isWorker) {
        let server = new StratumServer({ port: opts.stratum.port, algorithm: coin.ALGORITHM, daemons: opts.daemons }, DefaultWorkerManager.Instance);
        server.onSubmit((sender, result) => process.send({ cmd: Cmds.sendResult, result }));

        process.on('message', msg => {
            if (!msg || !msg.cmd) return;
            console.log('worker', msg.task);
            server.updateTask(msg.task.params, msg.task.template);
        });
        return;
    }

    logger.info('|-------------------- JS2POOL ---------------------|');
    logger.info('|                                                  |');
    logger.info('|----- https://github.com/unsignedint8/js2pool ----|')
    logger.info('|                                                  |');
    logger.info('|-- Donation: 1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9 --|');
    logger.info('|                                                  |');
    logger.info('|---------- A DECENTRALIZED MINING POOL -----------|');
    
    SharechainHelper.init(coiname);
    let chain = Sharechain.Instance;
    let shares = await SharechainHelper.loadSharesAsync();
    chain.add(shares);
    chain.fix();

    let js2pool = new Js2Pool({
        daemons: opts.daemons,
        address: opts.address,
        algorithm: coin.ALGORITHM,
        peer: opts.peer,
        bootstrapPeers: opts.bootstrapPeers,
    }, DefaultWorkerManager.Instance);

    js2pool.onTaskUpdated((sender, task) => {
        for (const id in cluster.workers) {
            cluster.workers[id].send({ cmd: Cmds.updateTask, task });
        }
    });

    for (const id in cluster.workers) {
        cluster.workers[id].on('message', msg => {
            if (!msg || msg.cmd) return;
            if (msg.cmd === Cmds.sendResult) {
                js2pool.notifySubmission(msg.result);
            }
        });
    }

    cluster.fork();
}
