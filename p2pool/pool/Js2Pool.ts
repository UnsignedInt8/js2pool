
import { DaemonWatcher, DaemonOptions, GetBlockTemplate, BlockTemplate } from "../../core/DaemonWatcher";
import { Peer, PeerOptions } from "../p2p/Peer";
import Bitcoin from '../coins/Bitcoin';
import { BaseShare } from "../p2p/shares/index";
import * as Algos from "../../core/Algos";
import logger from '../../misc/Logger';
import * as Bignum from 'bignum';
import * as kinq from 'kinq';
import Sharechain from "../chain/Sharechain";
import { SharechainHelper } from "../chain/SharechainHelper";
import { SharechainBuilder } from "../chain/SharechainBuilder";
import * as net from 'net';
import { Socket } from "net";
import * as crypto from 'crypto';
import * as Utils from '../../misc/Utils';
import StratumClient from "../../core/StratumClient";
import { IWorkerManager } from "./IWorkerManager";
import ShareInfo from "../p2p/shares/ShareInfo";
import SharesManager from "../../core/SharesManager";
import { SmallBlockHeader } from "../p2p/shares/SmallBlockHeader";

export type Js2PoolOptions = {
    daemons: DaemonOptions[],
    peer: PeerOptions,
    stratum: StratumOptions,
    algorithm: string,
    bootstrapPeers: { host: string, port: number }[],
    address: string,
}

export type StratumOptions = {
    port: number;
}

type Task = {
    coinbaseTx: { part1: Buffer, part2: Buffer },
    stratumParams: (string | boolean | string[])[],
    taskId: string,
    merkleLink: Buffer[],
    height: number,

    // Js2Pool parameters
    shareInfo: ShareInfo,
    target: Bignum,
    shareVersion: number,
    genTx: Buffer,
}

export class Js2Pool {

    private daemonWatchers = new Array<DaemonWatcher>();
    private sharechainBuilder: SharechainBuilder;
    private sharesManager: SharesManager;
    private readonly blocks = new Array<string>();
    private readonly clients = new Map<string, StratumClient>();
    private readonly sharechain = Sharechain.Instance;
    private readonly workerManager: IWorkerManager;
    private task: Task;
    private sharesCount = 0;
    peer: Peer;

    constructor(opts: Js2PoolOptions, manager: IWorkerManager) {
        this.sharesManager = new SharesManager(opts.algorithm);

        this.sharechain.onNewestChanged(this.handleNewestShareChanged.bind(this));
        this.sharechain.onCandidateArrived(this.handleNewestShareChanged.bind(this));

        for (let daemon of opts.daemons) {
            let watcher = new DaemonWatcher(daemon);
            watcher.onBlockTemplateUpdated(this.handleMiningTemplateUpdated.bind(this));
            watcher.onBlockNotified(this.handleBlockNotified.bind(this));
            watcher.beginWatching();

            this.daemonWatchers.push(watcher);
        }

        this.peer = new Peer(opts.peer);
        this.peer.initPeersAsync(opts.bootstrapPeers);

        let stratumServer = net.createServer(this.handleStratumClientConnected.bind(this));
        stratumServer.on('error', (error) => logger.error(error.message));
        stratumServer.listen(opts.stratum.port);

        this.workerManager = manager;
        this.sharechainBuilder = new SharechainBuilder(opts.address);
    }

    private async handleNewestShareChanged(sender: Sharechain, share: BaseShare) {
        for (let watcher of this.daemonWatchers) {
            if (await watcher.refreshBlockTemplateAsync()) break; // just refresh once
        }

        this.sharesCount++;
        if (this.sharesCount % 5 === 0) {
            sender.checkGaps();
            SharechainHelper.saveShares(kinq.toLinqable(sender.subchain(share.hash, 10, 'backward')).skip(5));
            this.sharesCount = 0;
        }
    }

    private handleMiningTemplateUpdated(sender: DaemonWatcher, template: GetBlockTemplate) {
        this.peer.updateMiningTemplate(template);
        this.sharesManager.updateGbt(template);

        let newestShare = this.sharechain.newest;
        if (!newestShare.hasValue() || !this.sharechain.calculatable) return;

        let knownTxs = template.transactions.toMap(item => item.txid || item.hash, item => item);
        let { bits, maxBits, merkleLink, shareInfo, tx1, tx2, genTx, version } = this.sharechainBuilder.buildMiningComponents(template, newestShare.value.hash, new Bignum(0), Array.from(knownTxs.keys()), knownTxs);

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
            taskId: stratumParams[0],
            stratumParams,
            shareInfo,
            target: Algos.bitsToTarget(bits),
            shareVersion: version,
            genTx
        };

        Array.from(this.clients.values()).forEach(c => c.sendTask(stratumParams));
    }

    private async handleBlockNotified(sender: DaemonWatcher, hash: string) {
        if (this.blocks.includes(hash)) return;

        this.blocks.push(hash);
        if (this.blocks.length < 4) return;

        let oldest = this.blocks.shift();
        let block: BlockTemplate;
        for (let watcher of this.daemonWatchers) {
            block = await watcher.getBlockAsync(oldest);
            if (block) break;
        }

        if (!block) return;

        this.peer.removeDeprecatedTxs(block.tx);
        logger.info('clean deprecated txs: ', block.tx.length);
    }

    private handleStratumClientConnected(socket: Socket) {
        let me = this;
        let client = new StratumClient(socket, 0);
        client.tag = crypto.randomBytes(8).toString('hex');
        me.clients.set(client.tag, client);

        client.onSubscribe((sender, msg) => sender.sendSubscription(msg.id, SharechainBuilder.COINBASE_NONCE_LENGTH));
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
            if (!result || !message || !me.task) {
                sender.sendSubmissionResult(message ? message.id : 0, false, null);
                return;
            }

            // first, checking whether it satisfies the bitcoin network or not
            let task = me.task;
            let { part1: tx1, part2: tx2 } = task.coinbaseTx;
            let { shareTarget, shareHex, header, shareHash } = me.sharesManager.buildShare(tx1, tx2, task.merkleLink, result.nonce, '', result.extraNonce2, result.nTime);

            if (!shareTarget) {
                let msg = { miner: result.miner, taskId: result.taskId, };
                sender.sendSubmissionResult(message.id, false, null);
                return;
            }

            if (shareHex) {
                me.daemonWatchers.forEach(watcher => watcher.submitBlockAsync(shareHex));
            }

            // dead on arrival
            if (result.taskId != me.task.taskId) {
                let msg = { miner: result.miner, taskId: result.taskId };
                sender.sendSubmissionResult(message.id, false, null);
                logger.warn(`dead on arrival: ${sender.miner}, ${shareHash}`);
                return;
            }

            if (shareTarget.le(task.target)) {
                this.sharechainBuilder.buildShare(task.shareVersion, SmallBlockHeader.fromObject(header), task.shareInfo, task.genTx, task.merkleLink, result.extraNonce2);
            }

            let share = this.sharechainBuilder.buildShare(task.shareVersion, SmallBlockHeader.fromObject(header), task.shareInfo, task.genTx, task.merkleLink, result.extraNonce2);
            if (!share) {
                sender.sendSubmissionResult(message.id, false, null);
                return;
            }

            share.init();
            console.log(share);
            console.log('header', shareHash, shareTarget, result.extraNonce2);
            sender.sendSubmissionResult(message.id, true, null);

            // me.sharechainBuilder.buildShare()

            // let share = me.sharesManager.buildShare(me.currentTask, result.nonce, sender.extraNonce1, result.extraNonce2, result.nTime);
            // if (!share || share.shareDiff < sender.difficulty) {
            //     let msg = { miner: result.miner, taskId: result.taskId, };
            //     me.broadcastInvalidShare(msg);
            //     client.sendSubmissionResult(message.id, false, null);
            //     client.touchBad();
            //     return;
            // }

            // let shareMessage = { miner: result.miner, hash: share.shareHash, diff: share.shareDiff, expectedDiff: sender.difficulty, timestamp: share.timestamp };

            // client.sendSubmissionResult(message.id, true, null);
            // me.broadcastShare(shareMessage);
        });

    }
}