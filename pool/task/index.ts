import { GetBlockTemplate, DaemonOptions } from "../../core/DaemonWatcher";

export type ZookeeperOptions = {
    address: string,
    port: number,
}

export type TaskSerialization = {
    taskId: string,
    coinbaseTx: string[],
    stratumParams: (string | boolean | string[])[],
    previousBlockHash: string,
    merkleLink: string[],
    height: number,
    template: GetBlockTemplate,
}

export type TaskServerOptions = {
    zookeeper: ZookeeperOptions,
    daemons: DaemonOptions[],
    address: string, // coinbase reward address
    fees?: [{ address: string, percent: number }],
    blocknotifylistener?: {
        enabled: boolean,
        port: number,
        host: string,
    },
}

export { TaskServer } from './TaskServer';