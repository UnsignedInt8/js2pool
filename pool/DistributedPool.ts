import TaskPusher from "./TaskPusher";
import { StratumServer } from "./StratumServer";
import { StratumMiners } from "./StratumMiners";
import * as kinq from 'kinq';
kinq.enable();

let pusher = new TaskPusher({
    zookeeper: {
        address: 'localhost',
        port: 2181,
    },
    address: 'mnpbqSLQ3r293VHSjN82Ht63zf3PD8gBmm',
    daemon: {
        host: 'localhost',
        port: 19001,
        password: '123',
        username: 'admin1',
    },
});

let server = new StratumServer({
    zookeeper: {
        address: 'localhost',
        port: 2181,
    },
    groupId: 'server1',
    port: 3333,
    daemon: {
        host: 'localhost',
        port: 19011,
        password: '123',
        username: 'admin2',
    },
    coin: {
        algorithm: 'sha256d',
    }
}, new StratumMiners());

server.onReady(sender => sender.start());