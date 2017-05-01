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
import * as fs from 'fs';
import { Block, Transaction } from "bitcoinjs-lib";
import Shares from "./Messages/Shares";
import { Share, NewShare, BaseShare } from "./Shares";
import { TypeSharereq, default as Sharereq } from "./Messages/Sharereq";
import { TypeSharereply, default as Sharereply } from "./Messages/Sharereply";

export default class Node extends Event {

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

    protected msgHandlers = new Map<string, (payload: Buffer) => void>();
    protected socket: Socket;

    remoteTxHashs = new Set<string>();
    rememberedTxs = new Map<string, Transaction>();
    remoteRememberedTxsSize = 0;
    isJs2PoolPeer = false;
    peerAddress: string;
    peerPort: number;
    tag: string;
    externalAddress?: string; // IP address from peer's view
    externalPort?: number; // the port from peer's view

    constructor() {
        super();
        let me = this;

        this.msgHandlers.set(Node.Messages.version, this.handleVersion.bind(me));
        this.msgHandlers.set(Node.Messages.ping, this.handlePing.bind(me));
        this.msgHandlers.set(Node.Messages.pong, this.handlePong.bind(me));
        this.msgHandlers.set(Node.Messages.addrs, this.handleAddrs.bind(me));
        this.msgHandlers.set(Node.Messages.addrme, this.handleAddrme.bind(me));
        this.msgHandlers.set(Node.Messages.getaddrs, this.handleGetaddrs.bind(me));
        this.msgHandlers.set(Node.Messages.have_tx, this.handleHave_tx.bind(me));
        this.msgHandlers.set(Node.Messages.losing_tx, this.handleLosing_tx.bind(me));
        this.msgHandlers.set(Node.Messages.forget_tx, this.handleForget_tx.bind(me));
        this.msgHandlers.set(Node.Messages.remember_tx, this.handleRemember_tx.bind(me));
        this.msgHandlers.set(Node.Messages.bestblock, this.handleBestBlock.bind(me));
        this.msgHandlers.set(Node.Messages.shares, this.handleShares.bind(me));
        this.msgHandlers.set(Node.Messages.sharereq, this.handleSharereq.bind(me));
        this.msgHandlers.set(Node.Messages.sharereply, this.handleSharereply.bind(me));
    }

    /// ---------------------- sockets ----------------------------

    initSocket(socket: Socket) {
        this.socket = socket;
        this.peerAddress = socket.remoteAddress;
        this.peerPort = socket.remotePort;
        this.tag = `${socket.remoteAddress}:${socket.remotePort}`;

        let me = this;
        socket.setTimeout(10 * 1000, () => me.trigger(Node.Events.timeout, me));
        socket.once('end', () => me.close());
        socket.once('error', err => {
            console.info(socket.remoteAddress, err.message);
            socket.destroy();
            me.close();
        });
    }

    async connectAsync(peerAddress: string, peerPort: number = 9333) {
        if (this.socket) throw Error('Socket has been initialized');
        let socket = new Socket();
        this.socket = socket;

        try {
            if (!await socket.connectAsync(peerPort, peerAddress)) return false;
            this.initSocket(socket);
            this.beginReceivingMessagesAsync();
            return true;
        } catch (error) {
            console.error(error);
            socket.removeAllListeners();
            return false;
        }
    }

    close() {
        if (!this.socket) return;
        this.socket.end();
        this.socket.removeAllListeners();
        this.trigger(Node.Events.end, this);
    }

    private static async readFlowingBytesAsync(stream: Socket, amount: number, preRead: Buffer) {
        return new Promise<{ data: Buffer, lopped: Buffer }>(resolve => {
            let buff = preRead ? preRead : Buffer.from([]);

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
            this.close();
            assert.ok(false);
            return;
        }

        let command = data.slice(8, 20).toString().replace(/\0+$/, '');
        let length = data.readUInt32LE(20);
        let checksum = data.readUInt32LE(24);

        let { data: payload, lopped: remain } = await Node.readFlowingBytesAsync(this.socket, length, lopped);
        if (utils.sha256d(payload).readUInt32LE(0) !== checksum) {
            this.trigger(Node.Events.badPeer, this, 'Bad checksum');
            this.close();
            assert.ok(false);
            return;
        }

        if (this.msgHandlers.has(command)) {
            console.info(command);
            this.msgHandlers.get(command)(payload);
        } else {
            console.info(`unknown command: ${command}`);
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

        this.trigger(Node.Events.version, this, version);
    }

    private handlePing(payload: Buffer) {
        if (!this.isJs2PoolPeer) {
            this.sendPingAsync();
            return;
        }

        this.sendPongAsync();
    }

    // Nothing to do here
    private handlePong(payload: Buffer) {
        console.info(this.socket.remoteAddress, 'is alive');
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
        let me = this;
        let tx = Have_tx.fromBuffer(payload);
        this.trigger(Node.Events.haveTx, this, tx.txHashes);

        while (me.remoteTxHashs.size > 10000) {
            let { value } = me.remoteTxHashs.keys().next();
            me.remoteTxHashs.delete(value);
        }

        tx.txHashes.forEach(h => me.remoteTxHashs.add(h));
    }

    private handleLosing_tx(payload: Buffer) {
        let me = this;
        let losingTx = Losing_tx.fromBuffer(payload);
        this.trigger(Node.Events.losingTx, this, losingTx.txHashes);

        losingTx.txHashes.forEach(h => me.remoteTxHashs.delete(h));
    }

    private handleForget_tx(payload: Buffer) {
        let hashes = Forget_tx.fromBuffer(payload).txHashes;
        for (let hash of hashes) {
            this.rememberedTxs.delete(hash);
        }

        this.trigger(Node.Events.forgetTx, this, hashes);
    }

    private handleRemember_tx(payload: Buffer) {
        let { txHashes, txs } = Remember_tx.fromBuffer(payload);
        for (let hash of txHashes) {
            if (this.rememberedTxs.has(hash)) {
                console.error('Peer referenced transaction twice, disconnecting');
                this.close();
                return;
            }


        }

        for (let tx of txs) {

        }
        this.trigger(Node.Events.rememberTx, this, txHashes, txs);
    }

    private handleBestBlock(payload: Buffer) {
        let header = Block.fromBuffer(payload);
        this.trigger(Node.Events.bestBlock, this, header);
    }

    private handleShares(payload: Buffer) {
        console.log('shares: ', payload.length);
        fs.writeFileSync('/tmp/shares_' + Date.now(), payload.toString('hex'));

        let sharesWrapper = Shares.fromBuffer(payload);
        this.trigger(Node.Events.shares, this, sharesWrapper.shares);
    }

    private handleSharereq(payload: Buffer) {
        let request = Sharereq.fromBuffer(payload);
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

    async sendVersionAsync() {
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

    async sendRemember_txAsync(rememberTx: TypeRemember_tx, totalSize: number) {
        this.remoteRememberedTxsSize += totalSize;

        let msg = Message.fromObject({ command: 'remember_tx', payload: rememberTx });
        return await this.sendAsync(msg.toBuffer());
    }

    isAvailable = () => this.socket && this.socket.readable && this.socket.writable;

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

    onSharereq(callback: (sender: Node, TypeSharereq) => void) {
        super.register(Node.Events.shareReq, callback);
        return this;
    }

    onSharereply(callback: (sender: Node, TypeSharereply) => void) {
        super.register(Node.Events.shareReply, callback);
        return this;
    }
}