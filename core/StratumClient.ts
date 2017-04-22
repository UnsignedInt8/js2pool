
import { Event } from "../nodejs/Event";
import { Socket } from "net";
import * as crypto from 'crypto';
import { setTimeout } from "timers";

const Events = {
    flood: 'Flood',
    malformedMessage: 'MalformedMessage',
    end: 'End',
    miningNotificationTimeout: 'MiningNotificationTimeout',

    subscribe: 'Subscribe',
    authorize: 'Authorize',
    getMultiplier: 'GetMultiplier',
    submit: 'Submit',
}

type TypeStratumMessage = {
    id?: number,
    method?: string,
    params?: any[],
    result?: any[] | any,
    error?: boolean | any,
};

type TypeSubmitResult = {
    miner: string,
    taskId: string,
    extraNonce2: string,
    nTime: string,
    nonce: string,
}

export default class StratumClient extends Event {
    readonly extraNonce1: string;

    subscriptionId: string = null;
    authorized = false;
    difficulty = 0;
    remoteAddress: string;
    miner: string;
    miningNotifyTimeout = 45;

    private socket: Socket;
    private miningNotificationTimer: NodeJS.Timer;

    constructor(socket: Socket, extraNonce1Size: number) {
        super();
        socket.setKeepAlive(true);

        this.extraNonce1 = crypto.randomBytes(extraNonce1Size).toString('hex');
        this.socket = socket;
        this.remoteAddress = socket.remoteAddress;
        this.setupSocket();
    }

    private setupSocket() {
        let me = this;
        let dataBuffer = '';

        me.socket.on('data', d => {
            dataBuffer += d;

            if (Buffer.byteLength(dataBuffer, 'utf8') > 10240) { //10KB
                dataBuffer = '';
                me.trigger(Events.flood);
                me.close();
                return;
            }

            if (dataBuffer.indexOf('\n') === -1) return;

            let messages = dataBuffer.split('\n');
            let incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();

            messages.forEach(message => {
                if (message === '') return;

                let messageJson: TypeStratumMessage;
                try {
                    messageJson = JSON.parse(message);
                } catch (e) {
                    me.trigger(Events.malformedMessage, message);
                    me.close();
                    return;
                }

                if (messageJson) {
                    me.handleMessage(messageJson);
                }
            });

            dataBuffer = incomplete;
        });

        me.socket.on('close', () => {
            me.close();
        });

        me.socket.on('error', err => {
            console.error(err);
            me.close();
        });

    }

    private handleMessage(message: TypeStratumMessage) {
        switch (message.method) {
            case 'mining.subscribe':
                this.trigger(Events.subscribe, this, message);
                break;
            case 'mining.authorize':
                if (!message.params || message.params.length < 2) {
                    this.sendError();
                    this.trigger(Events.malformedMessage);
                    return;
                }

                let username = message.params[0];
                let password = message.params[1];
                this.miner = username;
                this.trigger(Events.authorize, this, username, password, message);
                break;
            case 'mining.get_multiplier':
                // this.sendJson({ id: null, result: [Algos[this.options.coin.algorithm].multiplier], method: "mining.get_multiplier" });
                this.trigger(Events.getMultiplier, this, message);
                break;
            case 'ping':
                this.sendPong();
                break;
            case 'mining.submit':
                if (!message.params || message.params.length < 5) {
                    this.sendError();
                    this.trigger(Events.malformedMessage, this);
                    return;
                }

                let result = {
                    miner: message.params[0],
                    taskId: message.params[1],
                    extraNonce2: message.params[2],
                    nTime: message.params[3],
                    nonce: message.params[4]
                }

                this.trigger(Events.submit, this, result, message);
                this.handleSubmit();
                break;
            case 'mining.get_transactions':
                this.sendError();
                break;
            default:
                return;
        }

    }

    close() {
        this.socket.end();
        this.socket.removeAllListeners();
        super.trigger(Events.end, this);
        super.removeAllEvents();
        if (this.miningNotificationTimer) clearTimeout(this.miningNotificationTimer);
        if (this.submittingTimeoutTimer) clearInterval(this.submittingTimeoutTimer);
    }

    // ------------------ Events ---------------------

    onFlood(callback: (sender: StratumClient) => void) {
        super.register(Events.flood, callback);
    }

    onMalformedMessage(callback: (sender: StratumClient, message: string) => void) {
        super.register(Events.malformedMessage, callback);
    }

    onEnd(callback: (sender: StratumClient) => void) {
        super.register(Events.end, callback);
    }

    onSubscribe(callback: (sender: StratumClient, message: TypeStratumMessage) => void) {
        super.register(Events.subscribe, callback);
    }

    onAuthorize(callback: (sender: StratumClient, username: string, password: string, message: TypeStratumMessage) => void) {
        super.register(Events.authorize, callback);
    }

    onGetMultiplier(callback: (sender: StratumClient, message: TypeStratumMessage) => void) {
        super.register(Events.getMultiplier, callback);
    }

    onSubmit(callback: (sender: StratumClient, result: TypeSubmitResult, message: TypeStratumMessage) => void) {
        super.register(Events.submit, callback);
    }

    onMiningNotificationTimeout(callback: (sender: StratumClient) => void) {
        super.register(Events.miningNotificationTimeout, callback);
    }

    private sendJson(msg: TypeStratumMessage, ...args) {
        let response = '';
        for (let i = 0; i < arguments.length; i++) {
            response += JSON.stringify(arguments[i]) + '\n';
        }
        this.socket.write(response);
    }

    sendPong() {
        this.sendJson({ id: null, result: [], method: 'pong' });
    }

    sendPing() {
        console.log('ping');
        this.sendJson({ id: Math.random() * 100000 | 0, result: [], method: 'pong' });
    }

    sendError() {
        this.sendJson({ id: null, result: [], error: true });
    }

    sendSubscription(id: number, extraNonce2Size: number) {
        if (this.subscriptionId) return;

        this.subscriptionId = crypto.randomBytes(8).toString('hex');
        this.sendJson({
            id: id,
            error: null,
            result: [
                [["mining.set_difficulty", crypto.randomBytes(2).toString('hex')], ["mining.notify", this.subscriptionId]],
                this.extraNonce1,
                extraNonce2Size
            ],
        });
    }

    sendAuthorization(id: number, authorized: boolean, error: string = null) {
        this.sendJson({ id: id, result: authorized, error: error });
        this.authorized = authorized;
    }

    sendDifficulty(difficulty: number) {
        this.difficulty = difficulty;
        this.sendJson({ id: null, method: "mining.set_difficulty", params: [difficulty] });
    }

    sendTask(task: (string | boolean | string[])[]) {
        this.sendJson({ id: null, method: "mining.notify", params: task });

        let me = this;
        if (this.miningNotificationTimer) clearTimeout(this.miningNotificationTimer);
        this.miningNotificationTimer = setTimeout(() => me.trigger(Events.miningNotificationTimeout, me), this.miningNotifyTimeout * 1000);
    }

    sendSubmissionResult(id: number, result: boolean, error?: any) {
        this.sendJson({ id: id, result: result, error: error });
    }

    // ----------------- Auto diff -------------------

    private secondsPerShare = 0;
    private autoDiffEnabled = false;
    private firstShareTimestamp: number;
    private blocksThresold = 0;
    private sharesCount = 0;
    private submittingTimeoutTimer: NodeJS.Timer;

    private handleSubmit() {
        if (!this.autoDiffEnabled || this.blocksThresold === 0) return;

        if (this.sharesCount == 0) this.firstShareTimestamp = Date.now();
        if (this.submittingTimeoutTimer) clearInterval(this.submittingTimeoutTimer);
        this.submittingTimeoutTimer = setInterval(this.onSubmittingShareTimeout.bind(this), this.secondsPerShare * 1000);
        this.sharesCount++;

        if (this.sharesCount < this.blocksThresold) return;

        this.sharesCount = 0;
        let actualTime = (Date.now() - this.firstShareTimestamp) / 1000;
        let newDiff = this.difficulty * (actualTime / (this.secondsPerShare * this.blocksThresold));
        console.log(`${this.blocksThresold} blocks, actual: ${actualTime}, new diff: ${newDiff}`);
        
        this.sendDifficulty(newDiff);
    }

    private onSubmittingShareTimeout() {
        console.log('submitting share timeout');
        console.log('new diff: ', this.difficulty * 0.75);
        this.sendDifficulty(this.difficulty * 0.75);
    }

    enableAutoDiff(secondsPerBlock = 600, secondsPerShare = 15) {
        this.secondsPerShare = secondsPerShare;
        this.blocksThresold = secondsPerBlock / secondsPerShare;
        this.autoDiffEnabled = true;
        this.submittingTimeoutTimer = setInterval(this.onSubmittingShareTimeout.bind(this), secondsPerShare * 1000);
        console.log(secondsPerBlock, secondsPerShare);
    }

    disableAutoDiff() {
        this.autoDiffEnabled = false;
    }
}