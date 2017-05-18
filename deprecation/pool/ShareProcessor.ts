import { Client, Consumer } from 'kafka-node';
import { ZookeeperOptions } from "./task";
import * as crypto from 'crypto';
import { Topics } from "./Constant";

type ShareProcesserOptions = {
    zookeeper: ZookeeperOptions;
    groupId: string,
    refreshInterval?: number,
}

export class ShareProcessor {

    private sharesConsumer: Consumer;
    private totalDiff = 0;
    private const = Math.pow(2, 32);
    private interval: number;
    private refreshTimer: NodeJS.Timer;

    constructor(opts: ShareProcesserOptions) {
        this.interval = opts.refreshInterval || 30;

        let zookeeper = new Client(`${opts.zookeeper.host}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString('hex'));
        this.sharesConsumer = new Consumer(zookeeper, [{ topic: Topics.Shares }], { autoCommit: true, groupId: opts.groupId });
        this.sharesConsumer.on('message', this.onMessage.bind(this));
        this.refreshTimer = setInterval(this.onUpdatingHashrate.bind(this), this.interval * 1000);
    }

    private onMessage(msg: { topic: string, value: any, offset: number, partition: number }) {
        let share = JSON.parse(msg.value) as { miner: string, hash: string, diff: number, expectedDiff: number, timestamp: number, shareDiff?: number };
        this.totalDiff += share.expectedDiff || share.diff;
    }

    private onUpdatingHashrate() {
        let hashesPerSecond = this.totalDiff * this.const / this.interval;
        let kiloHashesPerSecond = hashesPerSecond / 1024;
        let megaHashesPerSecond = kiloHashesPerSecond / 1024;
        let gigaHashesPerSecond = megaHashesPerSecond / 1024;
        let teraHashesPerSecond = gigaHashesPerSecond / 1024;
        let petaHashesPerSecond = teraHashesPerSecond / 1024;

        this.totalDiff = 0;
        console.log(kiloHashesPerSecond | 0, 'kh/s');
    }

    setRefreshInterval(interval: number) {
        this.interval = interval;
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(this.onUpdatingHashrate.bind(this), interval * 1000);
    }
}