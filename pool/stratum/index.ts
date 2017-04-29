
import { ZookeeperOptions } from "../task/index";
import { DaemonOptions } from "../../core/DaemonWatcher";

export { StratumServer, IMinerManager } from './StratumServer';
export { DefaultMinersManager } from './DefaultMinersManager';

export type StratumServerOptions = {
    zookeeper: ZookeeperOptions,
    groupId: string,
    stratumPort: number, // stratum server port
    daemon: DaemonOptions,
    coin: {
        algorithm: string,
        normalHash?: boolean,
        symbol: string,
    },
    initDiff: number
}