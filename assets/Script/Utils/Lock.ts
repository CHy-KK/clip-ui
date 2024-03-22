import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

export class LockAsync {
    private lockPromise: Promise<void>;
    private lockResolve: () => void;

    constructor() {
        this.lockPromise = Promise.resolve();
    }

    public async acquire(): Promise<void> {
        await this.lockPromise;
        this.lockPromise = new Promise((resolve, reject) => {
            this.lockResolve = resolve;
        })
    }

    public release(): void {
        this.lockResolve();
    }
}


