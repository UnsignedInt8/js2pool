
import { IMinerManager } from "./StratumServer";

export class DefaultMinersManager implements IMinerManager {

    authorize(username: string, password: string): { authorized: boolean; initDiff: number; } {
        return { authorized: true, initDiff: 0.0025 };
    }

}