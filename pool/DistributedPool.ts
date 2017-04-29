import * as kinq from 'kinq';
import { StratumServer } from './stratum';
import { DefaultMinersManager } from './stratum';
import { ShareProcessor } from './ShareProcessor';
import { DaemonWatcher } from '../core/DaemonWatcher';
import { TaskServer } from './task/TaskServer';
kinq.enable();

let zookeeper = {
    address: 'localhost',
    port: 2181,
};


let taskServer = new TaskServer({
    zookeeper,
    address: 'mnpbqSLQ3r293VHSjN82Ht63zf3PD8gBmm',
    daemons: [
        {
            host: 'localhost',
            port: 19001,
            password: '123',
            username: 'admin1',
        },
    ],
    blocknotifylistener: {
        enabled: true,
        port: 11111,
        host: 'localhost',
    },
});


let server = new StratumServer({
    zookeeper,
    groupId: 'server1',
    stratumPort: 3333,
    daemon: {
        host: 'localhost',
        port: 19011,
        password: '123',
        username: 'admin2',
    },
    coin: {
        algorithm: 'sha256',
        symbol: 'BTC',
    },
    initDiff: 0.025
}, new DefaultMinersManager());

server.onReady(sender => sender.start());

let shareProcessor = new ShareProcessor({
    zookeeper,
    groupId: 'share-1',
});