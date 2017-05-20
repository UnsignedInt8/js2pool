
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
import StratumClient, { StratumSubmission } from "../../core/StratumClient";
import { IWorkerManager } from "./IWorkerManager";
import ShareInfo from "../p2p/shares/ShareInfo";
import SharesManager from "../../core/SharesManager";
import { SmallBlockHeader } from "../p2p/shares/SmallBlockHeader";
import { Event } from "../../nodejs/Event";
import { ShareResult } from "./StratumServer";

export type Js2PoolOptions = {
    daemons: DaemonOptions[],
    peer: PeerOptions,
    algorithm: string,
    bootstrapPeers: { host: string, port: number }[],
    address: string,
}

type Task = {
    coinbaseTx: { part1: Buffer, part2: Buffer },
    stratumParams: (string | boolean | string[])[],
    taskId: string,
    merkleLink: Buffer[],
    height: number,

    // Js2Pool parameters
    shareInfo: ShareInfo,
    p2poolTarget: Bignum,
    p2poolDiff: Bignum,
    shareVersion: number,
    genTx: Buffer,
}

export class Js2Pool extends Event {

    static readonly Events = {
        taskUpdated: 'TaskUpdated',
    }

    private daemonWatchers = new Array<DaemonWatcher>();
    private sharechainBuilder: SharechainBuilder;

    private readonly blocks = new Array<string>();
    private readonly sharechain = Sharechain.Instance;
    private readonly workerManager: IWorkerManager;
    private task: Task;
    private sharesCount = 0;
    peer: Peer;

    constructor(opts: Js2PoolOptions, manager: IWorkerManager) {
        super();


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

        let newestShare = this.sharechain.newest;
        if (!newestShare.hasValue() || !this.sharechain.calculatable) {
            this.sharechain.verify();
            return;
        }

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
            p2poolTarget: Algos.bitsToTarget(bits),
            p2poolDiff: Algos.bitsToDifficulty(bits),
            shareVersion: version,
            genTx
        };

        super.trigger(Js2Pool.Events.taskUpdated, this, { params: stratumParams, template });
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

    onTaskUpdated(callback: (sender: Js2Pool, task: { params: (string | boolean | string[])[], template: GetBlockTemplate }) => void) {
        super.register(Js2Pool.Events.taskUpdated, callback);
    }

    notifySubmission(result: ShareResult) {
        if (!this.task) return;

        let shareTarget = new Bignum(result.shareTarget, 16);
        let task = this.task;

        if (shareTarget.le(task.p2poolTarget)) {
            let share = this.sharechainBuilder.buildShare(task.shareVersion, SmallBlockHeader.fromObject(result.header), task.shareInfo, task.genTx, task.merkleLink, result.extraNonce); // building the p2pool specified share
            if (!share) return;

            share.init();

            console.log('master', share.hash);
            if (!share.validity) {
                logger.error(`invalid share building`);
                return;
            }

            logger.info(`found a share!!! ${share.hash}`);
            this.peer.broadcastShare(share);
        }
    }
}