import { Texture2D, Vec3 } from "cc";
import { PREVIEW } from "cc/env";

export class VoxelHistoryQueue {

    private rawVoxelDataHistory: Queue<Vec3[]>; 
    private voxelIdxHistory: Queue<string>;    

    constructor(maxlength: number) {
        this.rawVoxelDataHistory = new Queue<Vec3[]>(maxlength);
        this.voxelIdxHistory = new Queue<string>(maxlength);
    }

    public isExist(id: string): number {
        for (let i = 0; i < this.voxelIdxHistory.length; i++) {
            if (this.voxelIdxHistory.getElement(i) === id) 
                return i;
        }
        return -1;
    }

    public getElementById(id: string): Vec3[] {
        const idx = this.isExist(id);
        if(idx == -1 && PREVIEW) {
            console.error('this id is not in queue now');
            return;
        }
        return idx === -1 ? null : this.rawVoxelDataHistory.getElement(idx);
    }

    public getElement(idx: number): Vec3[] {
        return this.rawVoxelDataHistory.getElement(idx);
    }

    public push(voxel: Vec3[], id: string): boolean {
        if (this.isExist(id) != -1)
            return true;
        
        if (this.voxelIdxHistory.push(id)) {
            this.rawVoxelDataHistory.push(voxel);
            return true;
        }
        return false;
    }

    public popHead() {
        this.rawVoxelDataHistory.popHead();
        this.voxelIdxHistory.popHead();
    }

    public head() {
        return this.rawVoxelDataHistory.head();
    }

    public tail() {
        return this.rawVoxelDataHistory.tail();
    }

    public length() {
        return this.rawVoxelDataHistory.length;
    }

}


export  class Queue<T> {
    public length: number = 0;

    private maxLength: number;
    private data: T[] = []; 
    private headIdx: number = 0;
    private tailIdx: number = 0;
 
    constructor(maxLength: number) {
        this.maxLength = maxLength;
        this.data = new Array(maxLength);
    }

    public push(d: T): boolean {
        if (this.length < this.maxLength) {
            this.data[this.tailIdx] = d;
            this.tailIdx = (this.tailIdx + 1) % this.maxLength;
            this.length++;
            return true;
        }
        if (PREVIEW)  {
            console.error('queue is full, pop head first!');
        }
        return false;
    }

    public popHead() {
        if (this.length > 0) {
            this.headIdx = (this.headIdx + 1) % this.maxLength;
            this.length--;
        } else if (PREVIEW) {
            console.error('queue is empty, push elements first!');
        }
    }

    public head(): T {
        if (this.length === 0) {
            if (PREVIEW)
                console.error('array empty has no head!');
            return 
        }
        return this.data[this.headIdx];
    }

    public tail(): T {
        if (this.length === 0) {
            if (PREVIEW)
                console.error('array empty has no head!');
            return 
        }
        return this.data[this.tailIdx === 0 ? this.maxLength - 1 : this.tailIdx - 1];
    }

    public getElement(idx: number): T {
        if (idx > this.length) {
            if (PREVIEW)
                console.error('array out of bounds!!');
            return null;
        }
        return this.data[(this.headIdx + idx) % this.maxLength];
    }
}
