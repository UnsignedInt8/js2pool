
import { Event } from "../nodejs/Event";
import { Socket } from "net";
import * as crypto from 'crypto';

const Events = {
    flood: 'Flood',
    malformedMessage: 'MalformedMessage',
    end: 'End',
    keepAliveTimeout: 'KeepAliveTimeout',
    taskTimeout: 'TaskTimeout',

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
    keepAliveTimeout = 45;
    taskTimeout = 125;

    private socket: Socket;
    private keepAliveTimer: NodeJS.Timer;
    private taskTimeoutTimer: NodeJS.Timer;

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
                this.resetTaskTimeoutTimer();
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
        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        if (this.taskTimeoutTimer) clearTimeout(this.taskTimeoutTimer);
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

    onKeepAliveTimeout(callback: (sender: StratumClient) => void) {
        super.register(Events.keepAliveTimeout, callback);
    }

    onTaskTimeout(callback: (sender: StratumClient) => void) {
        super.register(Events.taskTimeout, callback);
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
        this.sendJson({ id: null, result: [], method: 'ping' });
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
        if (authorized) this.startKeepingAliveTimer();
    }

    sendDifficulty(difficulty: number) {
        this.difficulty = difficulty;
        this.sendJson({ id: null, method: "mining.set_difficulty", params: [difficulty] });
    }

    sendTask(task: (string | boolean | string[])[]) {
        this.sendJson({ id: null, method: "mining.notify", params: task });
        this.resetTaskTimeoutTimer();
    }

    sendSubmissionResult(id: number, validity: boolean, error?: any) {
        this.sendJson({ id: id, result: validity, error: error });
    }

    private startKeepingAliveTimer() {
        let me = this;
        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = setInterval(() => me.trigger(Events.keepAliveTimeout, me), this.keepAliveTimeout * 1000);
    }

    private resetTaskTimeoutTimer() {
        let me = this;
        if (this.taskTimeoutTimer) clearTimeout(this.taskTimeoutTimer);
        this.taskTimeoutTimer = setTimeout(() => me.trigger(Events.taskTimeout, me), this.taskTimeout * 1000);
    }
}