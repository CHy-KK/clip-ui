import { Sprite, Texture2D, Vec3, Node, Label, UITransform, director, SpriteFrame, Overflow } from "cc";
import { PREVIEW } from "cc/env";
import { SnapShotNode } from "../SnapShotNode";

export type VoxelRecord = {
    vid: string,
    idxInData: number,
    snapShotState: boolean
}

export class VoxelHistoryQueue {

    private rawVoxelDataHistory: Queue<Vec3[]>; 
    private voxelIdxHistory: Queue<VoxelRecord>;
    private HistoryListNode: Node = null;
    private maxLength: number;

    constructor(maxlength: number, bg: Node) {
        this.rawVoxelDataHistory = new Queue<Vec3[]>(maxlength);
        this.voxelIdxHistory = new Queue<VoxelRecord>(maxlength);
        // this.HistoryListNode = bg;
        this.HistoryListNode = director.getScene().getChildByPath('mainUI/OutUI/stencilMask/HistoryList');
        console.log(this.HistoryListNode);
        this.maxLength = maxlength;
    }

    public isExist(id: string): number {
        for (let i = 0; i < this.voxelIdxHistory.length; i++) {
            if (this.voxelIdxHistory.getElement(i).vid === id) 
                return i;
        }
        if(PREVIEW) {
            console.log(id + ' is not in queue now');
            return -1;
        }
        return -1;
    }

    public getVoxelById(id: string): Vec3[] {
        const idx = this.isExist(id);
        return idx === -1 ? null : this.rawVoxelDataHistory.getElement(idx);
    }

    // public getSnapShotReadyById(id: string): boolean {
    //     const idx = this.isExist(id);
    //     if (idx === -1)
    //         return false;
    //     return this.voxelIdxHistory.getElement(idx).snapShotState;
    // }
    
    // public setSnapShotReadyById(id: string) {
    //     const idx = this.isExist(id);
    //     if (idx === -1)
    //         return;
    //     this.voxelIdxHistory.setElement(idx, {vid: id, snapShotState: true});
    // }

    public push(voxel: Vec3[], id: string, idx: number, sss: boolean = false): boolean {
        if (this.isExist(id) != -1)
            return true;
        
        if (this.voxelIdxHistory.push({ vid: id, idxInData: idx, snapShotState: sss })) {
            this.rawVoxelDataHistory.push(voxel);

            // 创建snapShotNode
            const spriteNode = new Node();
            const ssn = spriteNode.addComponent(SnapShotNode);
            ssn.vid = id;
            spriteNode.layer = this.HistoryListNode.layer;
            spriteNode.setScale(new Vec3(1, -1, 1));

            const sp = spriteNode.addComponent(Sprite);
            // 等待后续赋值
            sp.spriteFrame = null;
            const idLabel = new Node();
            idLabel.layer = this.HistoryListNode.layer;
            const il = idLabel.addComponent(Label);
            il.string = id;
            il.fontSize = 20;
            il.lineHeight = 20;
            il.overflow = Overflow.RESIZE_HEIGHT;
            spriteNode.addChild(idLabel);
            idLabel.setPosition(new Vec3(0, 70, 0));
            idLabel.setScale(new Vec3(1, -1, 1));

            
            this.HistoryListNode.addChild(spriteNode);
            let xpos = 0;   
            const childList = this.HistoryListNode.children;
            for (let i = childList.length - 1; i >= 0; i--, xpos -= 120) {
                childList[i].position = new Vec3(xpos, 15, 0);
            }
            this.HistoryListNode.setPosition(new Vec3(440, 0, 0));
             
            return true;
        }
        return false;
    }

    public setSnapShot(sf: SpriteFrame) {
        const childList = this.HistoryListNode.children;
        childList[childList.length - 1].getComponent(Sprite).spriteFrame = sf;
        childList[childList.length - 1].getComponent(UITransform).contentSize.set(100, 100);
    }

    public getSnapShotById(id: string) {
        const idx = this.isExist(id);
        return this.HistoryListNode.children[idx].getComponent(Sprite).spriteFrame;
    }

    public getIdxInDataById(id: string): number {
        const idx = this.isExist(id);
        return this.voxelIdxHistory.getElement(idx).idxInData;
    }

    public popHead() {
        this.rawVoxelDataHistory.popHead();
        this.voxelIdxHistory.popHead();

        const childList = this.HistoryListNode.children;
        if (childList.length > this.maxLength) {
            const chtail = childList[0];
            this.HistoryListNode.removeChild(childList[0]);
            const sp = chtail.getComponent(Sprite).spriteFrame;
            if (sp.refCount <= 1) {
                sp.destroy();
            }
            chtail.destroy();
        }
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


export class Queue<T> {
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

    public setElement(idx: number, value: T) {
        if (idx > this.length) {
            if (PREVIEW)
                console.error('array out of bounds!!');
            return;
        }
        this.data[(this.headIdx + idx) % this.maxLength] = value;
    }
}
