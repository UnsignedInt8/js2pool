import { IWorkerManager } from './IWorkerManager';

export class DefaultWorkerManager implements IWorkerManager {
    static readonly Instance = new DefaultWorkerManager();

    async authorizeAsync(worker: string, password: string) {
        return { authorized: true, initDifficulty: 0.0025 };
    }
}