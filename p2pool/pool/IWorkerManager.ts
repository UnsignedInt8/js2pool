export interface IWorkerManager {
    authorizeAsync(work: string, password: string): Promise<{ authorized: boolean, initDifficulty?: number }>;
}