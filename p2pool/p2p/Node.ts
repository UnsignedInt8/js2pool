/*
 * Created on Sun Apr 09 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Socket } from 'net';
import * as assert from 'assert';
import * as utils from '../../misc/Utils';
import { Event } from "../../nodejs/Event";
import { Message, PROTOCOL_HEAD_LENGTH } from "./Message";
import { Version, TypeVersion } from "./Messages/Version";
import Addrs, { TypeAddrs } from "./Messages/Addrs";
import Addrme from "./Messages/AddrMe";
import Getaddrs from "./Messages/GetAddrs";
import { Have_tx, Losing_tx, Forget_tx } from "./Messages/Have_tx";
import { Remember_tx, TypeRemember_tx } from "./Messages/Remember_tx";
import { Block, Transaction } from "bitcoinjs-lib";
import { Shares, TypeShares } from "./Messages/Shares";
import { Share, NewShare, BaseShare } from "./Shares";
import { TypeSharereq, default as Sharereq } from "./Messages/Sharereq";
import { TypeSharereply, default as Sharereply } from "./Messages/Sharereply";
import { TransactionTemplate } from "../../core/DaemonWatcher";
import logger from '../../misc/Logger';
import * as fs from 'fs';

export default class Node extends Event {

    static readonly MAX_REMEMBERED_TXS = 30000;

    protected static readonly Events = {
        error: 'Error',
        badPeer: 'BadPeer',
        timeout: 'Timeout', // Socket timeout
        unknownCommand: 'UnknownCommand',
        end: 'End', // When peer disconnected or errors occured
        version: 'Version', // Receivied the 'version' message
        addrs: 'Addrs', // Received the 'addrs' message
        addrMe: 'AddrMe', // Received the 'addrme' message
        getAddrs: 'GetAddrs', // Received the 'getAddrs' message
        haveTx: 'HaveTx',
        losingTx: 'LosingTx',
        forgetTx: 'ForgetTx',
        rememberTx: 'RememberTx',
        bestBlock: 'BestBlock',
        shares: 'Shares',
        shareReq: 'ShareReq',
        shareReply: 'ShareReply',
    }

    private static readonly Messages = {
        version: 'version',
        ping: 'ping',
        pong: 'pong',
        addrs: 'addrs',
        addrme: 'addrme',
        getaddrs: 'getaddrs',
        have_tx: 'have_tx',
        losing_tx: 'losing_tx',
        forget_tx: 'forget_tx',
        remember_tx: 'remember_tx',
        bestblock: 'bestblock',
        shares: 'shares',
        sharereq: 'sharereq',
        sharereply: 'sharereply',
    }

    private peerAliveTimer: NodeJS.Timer;
    private keepAliveTimer: NodeJS.Timer;
    protected msgHandlers = new Map<string, (payload: Buffer) => void>();
    protected socket: Socket;

    remoteTxHashs = new Set<string>();
    rememberedTxs = new Map<string, TransactionTemplate>();
    remoteRememberedTxsSize = 0;
    isJs2PoolPeer = false;
    peerAddress: string;
    peerPort: number;
    tag: string;
    externalAddress?: string; // IP address from peer's view
    externalPort?: number; // the port from peer's view
    connectionTime = 300; // ms

    constructor() {
        super();

        this.msgHandlers.set(Node.Messages.version, this.handleVersion.bind(this));
        this.msgHandlers.set(Node.Messages.ping, this.handlePing.bind(this));
        this.msgHandlers.set(Node.Messages.pong, this.handlePong.bind(this));
        this.msgHandlers.set(Node.Messages.addrs, this.handleAddrs.bind(this));
        this.msgHandlers.set(Node.Messages.addrme, this.handleAddrme.bind(this));
        this.msgHandlers.set(Node.Messages.getaddrs, this.handleGetaddrs.bind(this));
        this.msgHandlers.set(Node.Messages.have_tx, this.handleHave_tx.bind(this));
        this.msgHandlers.set(Node.Messages.losing_tx, this.handleLosing_tx.bind(this));
        this.msgHandlers.set(Node.Messages.forget_tx, this.handleForget_tx.bind(this));
        this.msgHandlers.set(Node.Messages.remember_tx, this.handleRemember_tx.bind(this));
        this.msgHandlers.set(Node.Messages.bestblock, this.handleBestBlock.bind(this));
        this.msgHandlers.set(Node.Messages.shares, this.handleShares.bind(this));
        this.msgHandlers.set(Node.Messages.sharereq, this.handleSharereq.bind(this));
        this.msgHandlers.set(Node.Messages.sharereply, this.handleSharereply.bind(this));
    }

    /// ---------------------- sockets ----------------------------

    initSocket(socket: Socket) {
        socket.setKeepAlive(true);

        this.socket = socket;
        this.peerAddress = socket.remoteAddress;
        this.peerPort = socket.remotePort;
        this.tag = `${socket.remoteAddress}:${socket.remotePort}`;

        let me = this;
        socket.setTimeout(10 * 1000, () => me.trigger(Node.Events.timeout, me));
        socket.once('end', () => me.close(false));
        socket.once('error', err => {
            logger.error(`${socket.remoteAddress}, ${err.message}`);
            me.close(true);
        });

        this.beginReceivingMessagesAsync();
    }

    async connectAsync(peerAddress: string, peerPort: number = 9333) {
        if (this.socket) throw Error('Socket has been initialized');
        let socket = new Socket();
        this.socket = socket;
        let timestamp = Date.now();

        try {
            if (!await socket.connectAsync(peerPort, peerAddress)) return false;
            this.initSocket(socket);
            this.connectionTime = Date.now() - timestamp;
            return true;
        } catch (error) {
            logger.error(error);
            socket.removeAllListeners();
            return false;
        }
    }

    close(destroy: boolean, info?: string) {
        try {
            if (info) logger.info(info);
            this.rememberedTxs.clear();
            this.remoteTxHashs.clear();

            if (!this.socket) return;
            destroy ? this.socket.destroy() : this.socket.end();
            this.socket.removeAllListeners();
        } catch (error) {
            logger.error(error);
        } finally {
            if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
            if (this.peerAliveTimer) clearTimeout(this.peerAliveTimer);
            this.trigger(Node.Events.end, this);
            super.removeAllEvents();

            logger.info(`${this.tag} disconnected`);
        }
    }

    private static async readFlowingBytesAsync(stream: Socket, amount: number, preRead: Buffer) {
        return new Promise<{ data: Buffer, lopped: Buffer }>(resolve => {
            let buff = preRead ? preRead : Buffer.alloc(0);

            let readData = (data: Buffer) => {
                buff = Buffer.concat([buff, data]);
                if (buff.length >= amount) {
                    let returnData = buff.slice(0, amount);
                    let lopped = buff.length > amount ? buff.slice(amount) : null;
                    resolve({ data: returnData, lopped });
                }
                else
                    stream.once('data', readData);
            };

            readData(Buffer.alloc(0));
        });
    };

    protected async beginReceivingMessagesAsync(preBuffer: Buffer = null) {
        let { data, lopped } = await Node.readFlowingBytesAsync(this.socket, PROTOCOL_HEAD_LENGTH, preBuffer);

        let magic = data.slice(0, 8);
        if (!magic.equals(Message.magic)) {
            this.trigger(Node.Events.badPeer, this, 'Bad magic number');
            this.close(true, 'Bad magic number');
            return;
        }

        let command = data.slice(8, 20).toString().replace(/\0+$/, '');
        let length = data.readUInt32LE(20);
        let checksum = data.readUInt32LE(24);

        let { data: payload, lopped: remain } = await Node.readFlowingBytesAsync(this.socket, length, lopped);
        if (utils.sha256d(payload).readUInt32LE(0) !== checksum) {
            this.trigger(Node.Events.badPeer, this, 'Bad checksum');
            this.close(true, 'Bad checksum');
            return;
        }

        if (this.msgHandlers.has(command)) {
            if (this.peerAliveTimer) clearTimeout(this.peerAliveTimer);
            this.peerAliveTimer = setTimeout(this.close.bind(this, true, '100 seconds exceeded, timeout. close...'), 100 * 1000);
            this.msgHandlers.get(command)(payload);
        } else {
            logger.warn(`unknown command: ${command}`);
            this.trigger(Node.Events.unknownCommand, this, command);
        }
        
        let me = this;
        process.nextTick(async () => await me.beginReceivingMessagesAsync(remain));
    }

    /// --------------------- handleXXX ---------------------------

    private handleVersion(payload: Buffer) {
        let version = Version.fromBuffer(payload);
        this.isJs2PoolPeer = version.subVersion.startsWith('js2pool');
        this.externalAddress = version.addressTo.ip;
        this.externalPort = version.addressTo.port;

        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = setInterval(this.sendPingAsync.bind(this), 30 * 1000);

        this.trigger(Node.Events.version, this, version);
    }

    private handlePing(payload: Buffer) {
        if (!this.isJs2PoolPeer) return;
        this.sendPongAsync();
    }

    // Nothing to do here
    private handlePong(payload: Buffer) {
        logger.info(`${this.socket.remoteAddress} is alive`);
    }

    private handleAddrs(payload: Buffer) {
        let addrs = Addrs.fromBuffer(payload);
        this.trigger(Node.Events.addrs, this, addrs);
    }

    private handleAddrme(payload: Buffer) {
        let addrme = Addrme.fromBuffer(payload);

        if (addrme.port !== this.peerPort) {
            this.trigger(Node.Events.badPeer, this, 'ports are not equal');
            return;
        }

        this.trigger(Node.Events.addrMe, this, this.peerAddress, addrme.port);
    }

    private handleGetaddrs(payload: Buffer) {
        let getaddrs = Getaddrs.fromBuffer(payload);
        this.trigger(Node.Events.getAddrs, this, getaddrs.count);
    }

    private handleHave_tx(payload: Buffer) {
        let { txHashes } = Have_tx.fromBuffer(payload);

        while (this.remoteTxHashs.size > 10000) {
            let { value } = this.remoteTxHashs.keys().next();
            this.remoteTxHashs.delete(value);
        }

        for (let h of txHashes) {
            this.remoteTxHashs.add(h);
        }

        this.trigger(Node.Events.haveTx, this, txHashes);
    }

    private handleLosing_tx(payload: Buffer) {
        let { txHashes } = Losing_tx.fromBuffer(payload);
        for (let h of txHashes) {
            this.remoteTxHashs.delete(h);
        }

        this.trigger(Node.Events.losingTx, this, txHashes);
    }

    private handleForget_tx(payload: Buffer) {
        let { txHashes } = Forget_tx.fromBuffer(payload);
        for (let hash of txHashes) {
            this.rememberedTxs.delete(hash);
        }
        logger.info(`forget_tx: ${txHashes.length}, remember_tx: ${this.rememberedTxs.size}`);
        this.trigger(Node.Events.forgetTx, this, txHashes);
    }

    private handleRemember_tx(payload: Buffer) {
        let { txHashes, txs } = Remember_tx.fromBuffer(payload);
        this.trigger(Node.Events.rememberTx, this, txHashes, txs);
    }

    private handleBestBlock(payload: Buffer) {
        let header = Block.fromBuffer(payload);
        this.trigger(Node.Events.bestBlock, this, header);
    }

    private handleShares(payload: Buffer) {
        let { shares } = Shares.fromBuffer(payload);
        this.trigger(Node.Events.shares, this, shares);
    }

    private handleSharereq(payload: Buffer) {
        let request = Sharereq.fromBuffer(payload);
        console.log('new share request', request.hashes);
        this.trigger(Node.Events.shareReq, this, request);
    }

    private handleSharereply(payload: Buffer) {
        let reply = Sharereply.fromBuffer(payload);
        this.trigger(Node.Events.shareReply, this, reply);
    }

    /// -------------------- sendXXXAsync -------------------------

    private async sendAsync(data: Buffer) {
        try {
            return await this.socket.writeAsync(data);
        } catch (error) {
            this.trigger(Node.Events.error, this, error);
        }
    }

    async sendVersionAsync(bestShareHash: string = null) {
        if (this.peerAliveTimer) clearTimeout(this.peerAliveTimer);

        let addrTo = {
            services: 0,
            ip: this.socket.remoteAddress,
            port: this.socket.remotePort,
        };

        let addrFrom = {
            services: 0,
            ip: this.socket.localAddress,
            port: this.socket.localPort,
        };

        let msg = Message.fromObject({
            command: 'version',
            payload: {
                addressFrom: addrFrom,
                addressTo: addrTo,
                bestShareHash,
            }
        });

        return await this.sendAsync(msg.toBuffer());
    }

    async sendPingAsync() {
        let msg = Message.fromObject({ command: 'ping', payload: {} });
        return await this.sendAsync(msg.toBuffer());
    }

    private async sendPongAsync() {
        let msg = Message.fromObject({ command: 'pong', payload: {} });
        return await this.sendAsync(msg.toBuffer());
    }

    /**
     * Tell a peer to record my address
     * You should check the externalAddress equals the socket.localAddress
     * @param port 
     */
    async sendAddrmeAsync(port: number) {
        let msg = Message.fromObject({ command: 'addrme', payload: { port: port } });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendGetaddrsAsync(count: number) {
        let msg = Message.fromObject({ command: 'getaddrs', payload: { count: count } });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendAddrsAsync(addrs: TypeAddrs[]) {
        let data = Message.fromObject({ command: 'addrs', payload: addrs });
        return await this.sendAsync(data.toBuffer());
    }

    async sendSharereqAsync(sharereq: TypeSharereq) {
        let data = Message.fromObject({ command: 'sharereq', payload: sharereq });
        return await this.sendAsync(data.toBuffer());
    }

    async sendSharereplyAsync(reply: TypeSharereply) {
        let msg = Message.fromObject({ command: 'sharereply', payload: reply });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendSharesAsync(shares: TypeShares[]) {
        let msg = Message.fromObject({ command: 'shares', payload: shares });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendHave_txAsync(txHashes: string[]) {
        let msg = Message.fromObject({ command: 'have_tx', payload: { txHashes } });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendLosing_txAsync(txHashes: string[]) {
        let msg = Message.fromObject({ command: 'losing_tx', payload: { txHashes } });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendForget_txAsync(txHashes: string[], totalSize: number) {
        this.remoteRememberedTxsSize -= totalSize;

        let msg = Message.fromObject({ command: 'forget_tx', payload: { txHashes } });
        return await this.sendAsync(msg.toBuffer());
    }

    async sendRemember_txAsync(rememberTx: TypeRemember_tx) {
        if (rememberTx.hashes.length == 0 && rememberTx.txs.length == 0) return;

        this.remoteRememberedTxsSize += rememberTx.txs.sum(tx => tx.data.length / 2);
        let msg = Message.fromObject({ command: 'remember_tx', payload: rememberTx });
        return await this.sendAsync(msg.toBuffer());
    }

    get isAvailable() {
        return this.socket && this.socket && this.socket.readable && this.socket.writable;
    }

    /// -------------------- onXXXEvents --------------------------

    onError(callback: (sender: Node, error) => void) {
        super.register(Node.Events.error, callback);
        return this;
    }

    onBadPeer(callback: (sender: Node, message: string) => void) {
        super.register(Node.Events.badPeer, callback);
        return this;
    }

    onTimeout(callback: (sender: Node) => void) {
        super.register(Node.Events.timeout, callback);
        return this;
    }

    onEnd(callback: (sender: Node) => void) {
        super.register(Node.Events.end, callback);
        return this;
    }

    onUnknownCommand(callback: (sender: Node, cmd: string) => void) {
        super.register(Node.Events.unknownCommand, callback);
        return this;
    }

    onVersionVerified(callback: (sender: Node, version: Version) => void) {
        super.register(Node.Events.version, callback);
        return this;
    }

    onAddrme(callback: (sender: Node, ip: string, port: number) => void) {
        super.register(Node.Events.addrMe, callback);
        return this;
    }

    onAddrs(callback: (sender: Node, addrs: TypeAddrs[]) => void) {
        super.register(Node.Events.addrs, callback);
        return this;
    }

    onGetaddrs(callback: (sender: Node, count: number) => void) {
        super.register(Node.Events.getAddrs, callback);
        return this;
    }

    onHave_tx(callback: (sender: Node, txHashes: string[]) => void) {
        super.register(Node.Events.haveTx, callback);
        return this;
    }

    onLosing_tx(callback: (sender: Node, txHashes: string[]) => void) {
        super.register(Node.Events.losingTx, callback);
        return this;
    }

    onForget_tx(callback: (sender: Node, txHashes: string[]) => void) {
        super.register(Node.Events.forgetTx, callback);
        return this;
    }

    onRemember_tx(callback: (sender: Node, txHashes: string[], txs: Transaction[]) => void) {
        super.register(Node.Events.rememberTx, callback);
        return this;
    }

    onBestBlock(callback: (sender: Node, header: Block) => void) {
        super.register(Node.Events.bestBlock, callback);
        return this;
    }

    onShares(callback: (sender: Node, shares: { version: number, contents: BaseShare }[]) => void) {
        super.register(Node.Events.shares, callback);
        return this;
    }

    onSharereq(callback: (sender: Node, req: TypeSharereq) => void) {
        super.register(Node.Events.shareReq, callback);
        return this;
    }

    onSharereply(callback: (sender: Node, reply: TypeSharereply) => void) {
        super.register(Node.Events.shareReply, callback);
        return this;
    }
}