
import { IStratumMiners } from "./StratumServer";

export class StratumMiners implements IStratumMiners {

    authorize(username: string, password: string): { authorized: boolean; initDiff: number; } {
        return { authorized: true, initDiff: 0.0025 };
    }

}