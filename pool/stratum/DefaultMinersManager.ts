
import { IMinerManager } from "./StratumServer";

export class DefaultMinersManager implements IMinerManager {

    initDiff: number = 1;

    authorize(username: string, password: string): { authorized: boolean; initDiff: number; } {
        return { authorized: true, initDiff: this.initDiff };
    }

}