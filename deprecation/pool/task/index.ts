import { GetBlockTemplate, DaemonOptions, BlockNotifyOptions } from "../../../core/DaemonWatcher";

export type ZookeeperOptions = {
    host: string,
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
    blockNotifyOpts?: BlockNotifyOptions
}

export { TaskServer } from './TaskServer';