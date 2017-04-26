import { Client, Consumer } from 'kafka-node';
import { ZookeeperOptions } from "./TaskPusher";
import * as crypto from 'crypto';
import { Topics } from "./Constant";

type ShareProcesserOptions = {
    zookeeper: ZookeeperOptions;
    groupId: string,
}

export class ShareProcessor {

    private sharesConsumer: Consumer;
    private totalDiff = 0;
    private totalSeconds = 0;
    private c1 = Math.pow(2, 32);

    constructor(opts: ShareProcesserOptions) {
        let zookeeper = new Client(`${opts.zookeeper.address}:${opts.zookeeper.port}`, crypto.randomBytes(4).toString('hex'));
        this.sharesConsumer = new Consumer(zookeeper, [{ topic: Topics.Shares }], { autoCommit: true, groupId: opts.groupId });
        this.sharesConsumer.on('message', this.onMessage.bind(this));
        setInterval(this.onUpdatingHashrate.bind(this), 1 * 1000);
    }

    private onMessage(msg: { topic: string, value: any, offset: number, partition: number }) {
        let share = JSON.parse(msg.value) as { miner: string, hash: string, diff: number, timestamp: number, shareDiff?: number };
        this.totalDiff += share.diff || share.shareDiff;
    }

    private onUpdatingHashrate() {
        this.totalSeconds++;
        let hashesPerSecond = this.c1 * this.totalDiff / this.totalSeconds;
        let kiloHashesPerSecond = hashesPerSecond / 1024;
        let megaHashesPerSecond = kiloHashesPerSecond / 1024;
        let gigaHashesPerSecond = megaHashesPerSecond / 1024;
        let teraHashesPerSecond = gigaHashesPerSecond / 1024;
        let petaHashesPerSecond = teraHashesPerSecond / 1024;

        console.log(kiloHashesPerSecond, 'kh/s');
    }
}