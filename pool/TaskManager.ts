import * as crypto from 'crypto';

type TypeMiningTask = {
    stratumParams: (string | boolean | string[])[],
    timestamp: number,
}

export default class TaskManager {

    private tasks = new Map<string, TypeMiningTask>();

    createTask(paramsTemplate: (string | boolean | string[])[]) {
        let taskId = crypto.randomBytes(8).toString('hex');
        let stratumParams = Array.from(paramsTemplate);
        stratumParams[0] = taskId;

        let task = {
            stratumParams,
            timestamp: Date.now(),
        };

        this.tasks.set(taskId, task);
        return task;
    }

    cleanTasks() {
        this.tasks.clear();
    }
}