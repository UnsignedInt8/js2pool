import * as crypto from 'crypto';

type TypeMiningTask = {
    stratumParams: (string | boolean | string[])[],
    timestamp: number,
}

export default class TaskManager {

    tasks = new Map<string, TypeMiningTask>();

    createTask(paramsTemplate: (string | boolean | string[])[]) {
        let taskId: string;
        do {
            taskId = crypto.randomBytes(8).toString('hex');
        } while (this.tasks.has(taskId));

        let stratumParams = Array.from(paramsTemplate);
        stratumParams[0] = taskId;

        let task = {
            stratumParams,
            timestamp: Date.now(),
        };

        this.tasks.set(taskId, task);
        return task;
    }

    hasTask(id: string) {
        return this.tasks.has(id);
    }

    deleteTask(id: string) {
        this.tasks.delete(id);
    }

    cleanTasks() {
        this.tasks.clear();
    }
}