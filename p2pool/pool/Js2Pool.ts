
import { DaemonWatcher, DaemonOptions, GetBlockTemplate } from "../../core/DaemonWatcher";
import { Peer, PeerOptions } from "../p2p/Peer";
import Bitcoin from '../coins/Bitcoin';
import { BaseShare } from "../p2p/shares/index";
import { Algos } from "../../core/Algos";
import logger from '../../misc/Logger';
import * as Bignum from 'bignum';
import * as kinq from 'kinq';
import Sharechain from "../chain/Sharechain";
import { SharechainHelper } from "../chain/SharechainHelper";
import { ShareBuilder } from "../chain/ShareBuilder";
import * as net from 'net';
import { Socket } from "net";
import * as crypto from 'crypto';
import * as Utils from '../../misc/Utils';
import StratumClient from "../../core/StratumClient";
import { IWorkerManager } from "./IWorkerManager";
import ShareInfo from "../p2p/shares/ShareInfo";
import SharesManager from "../../core/SharesManager";

export type Js2PoolOptions = {
    daemon: DaemonOptions,
    peer: PeerOptions,
    stratum: StratumOptions,
    algorithm: string,
    bootstrapPeers: { host: string, port: number }[],
}

export type StratumOptions = {
    port: number;
}

type Task = {
    coinbaseTx: { part1: Buffer, part2: Buffer },
    stratumParams: (string | boolean | string[])[],
    taskId: string,
    previousBlockHash: string,
    merkleLink: Buffer[],
    height: number,
    shareInfo: ShareInfo,
}

export class Js2Pool {

    private daemonWatcher: DaemonWatcher;
    private js2poolShareBuilder = new ShareBuilder('1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9');
    private shareManager: SharesManager;
    private readonly blocks = new Array<string>();
    private readonly clients = new Map<string, StratumClient>();
    private readonly sharechain = Sharechain.Instance;
    private readonly workerManager: IWorkerManager;
    private task: Task;
    peer: Peer;

    constructor(opts: Js2PoolOptions, manager: IWorkerManager) {
        this.shareManager = new SharesManager(opts.algorithm);

        this.sharechain.onNewestChanged(this.onNewestShareChanged.bind(this));
        this.sharechain.onCandidateArrived(this.onNewestShareChanged.bind(this));

        this.daemonWatcher = new DaemonWatcher(opts.daemon);
        this.daemonWatcher.onBlockTemplateUpdated(this.onMiningTemplateUpdated.bind(this));
        this.daemonWatcher.onBlockNotified(this.onBlockNotified.bind(this));
        this.daemonWatcher.beginWatching();

        this.peer = new Peer(opts.peer);
        this.peer.initPeersAsync(opts.bootstrapPeers);

        let stratumServer = net.createServer(this.onStratumClientConnected.bind(this));
        stratumServer.on('error', (error) => logger.error(error.message));
        stratumServer.listen(opts.stratum.port);

        this.workerManager = manager;
    }

    private onNewestShareChanged(sender: Sharechain, share: BaseShare) {
        this.daemonWatcher.refreshBlockTemplateAsync();
        if (sender.size % 5 === 0) {
            sender.checkGaps();
            SharechainHelper.saveShares(kinq.toLinqable(sender.subchain(share.hash, 10, 'backward')).skip(5));
        }
    }

    private onMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        this.peer.updateMiningTemplate(template);

        let newestShare = this.sharechain.newest;
        if (!newestShare.hasValue() || !this.sharechain.calculatable) return;

        let knownTxs = template.transactions.toMap(item => item.txid || item.hash, item => item);
        let { bits, maxBits, merkleLink, shareInfo, tx1, tx2 } = this.js2poolShareBuilder.buildMiningComponents(template, newestShare.value.hash, new Bignum(0), Array.from(knownTxs.keys()), knownTxs);

        let stratumParams = [
            crypto.randomBytes(4).toString('hex'),
            Utils.reverseByteOrder(Buffer.from(template.previousblockhash, 'hex')).toString('hex'),
            tx1.toString('hex'),
            tx2.toString('hex'),
            merkleLink.map(item => item.toString('hex')),
            Utils.packUInt32BE(template.version).toString('hex'),
            template.bits,
            Utils.packUInt32BE(template.curtime).toString('hex'),
            true, // Force to start new task
        ];

        this.task = <Task>{
            coinbaseTx: { part1: tx1, part2: tx2 },
            height: template.height,
            merkleLink,
            previousBlockHash: template.previousblockhash,
            taskId: stratumParams[0],
            stratumParams,
            shareInfo,
        };
    }

    private async onBlockNotified(sender: DaemonWatcher, hash: string) {
        if (this.blocks.includes(hash)) return;
        this.sharechain.checkGaps(); // check gaps when new blocks be found

        this.blocks.push(hash);
        if (this.blocks.length < 4) return;

        let oldest = this.blocks.shift();
        let block = await this.daemonWatcher.getBlockAsync(oldest);
        if (!block) return;

        this.peer.removeDeprecatedTxs(block.tx);
        logger.info('clean deprecated txs: ', block.tx.length);
    }

    private onStratumClientConnected(socket: Socket) {
        let me = this;
        let client = new StratumClient(socket, 0);
        client.tag = crypto.randomBytes(8).toString('hex');
        me.clients.set(client.tag, client);

        client.onSubscribe((sender, msg) => sender.sendSubscription(msg.id, ShareBuilder.COINBASE_NONCE_LENGTH));
        client.onEnd(sender => me.clients.delete(sender.tag));
        client.onKeepingAliveTimeout(sender => sender.sendPing());
        client.onTaskTimeout(sender => { });

        client.onAuthorize(async (sender, username, password, raw) => {
            let { authorized, initDifficulty } = await me.workerManager.authorizeAsync(username, password);
            sender.sendAuthorization(raw.id, authorized);
            if (!authorized) return;
            sender.sendDifficulty(initDifficulty);
            if (me.task) sender.sendTask(me.task.stratumParams);
        });

        client.onSubmit((sender, result, message) => {
            if (result.taskId != me.task.taskId) {
                let msg = { miner: result.miner, taskId: result.taskId };
                client.sendSubmissionResult(message.id, false, null);
                return;
            }


            // let share = me.sharesManager.buildShare(me.currentTask, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime);
            // if (!share || share.shareDiff < sender.difficulty) {
            //     let msg = { miner: result.miner, taskId: result.taskId, };
            //     me.broadcastInvalidShare(msg);
            //     client.sendSubmissionResult(message.id, false, null);
            //     client.touchBad();
            //     return;
            // }

            // let shareMessage = { miner: result.miner, hash: share.shareHash, diff: share.shareDiff, expectedDiff: sender.difficulty, timestamp: share.timestamp };

            // if (share.shareHex) {
            //     me.fastSubmitter.submitBlockAsync(share.shareHex);
            //     me.broadcastBlock(shareMessage);
            // }

            // client.sendSubmissionResult(message.id, true, null);
            // me.broadcastShare(shareMessage);
        });

    }
}