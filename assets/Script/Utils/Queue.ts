import { Sprite, Texture2D, Vec3, Node, Label, UITransform, director, SpriteFrame, Overflow } from "cc";
import { PREVIEW } from "cc/env";
import { InOrOut, SnapShotNode } from "../SnapShotNode";

export type VoxelRecord = {
    vid: string,
    embedding: Array<number>,
    idxInData: number,
    snapShotState: boolean
}

export class VoxelHistoryQueue {

    private rawVoxelDataHistory: Queue<Vec3[]>; 
    private voxelIdxHistory: Queue<VoxelRecord>;
    private outHistoryListNode: Node = null;
    private innerHistoryListNode: Node = null;
    private maxLength: number;

    constructor(maxlength: number) {
        this.rawVoxelDataHistory = new Queue<Vec3[]>(maxlength);
        this.voxelIdxHistory = new Queue<VoxelRecord>(maxlength);
        this.outHistoryListNode = director.getScene().getChildByPath('mainUI/OutUI/stencilMask/HistoryList');
        this.innerHistoryListNode = director.getScene().getChildByPath('mainUI/InnerUI/InnerHistoryGraphic/stencilMask/HistoryList');
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
    private pushSprite(id: string) {
        // 创建snapShotNode
        const spriteNodeO = new Node();
        const spriteNodeI = new Node();
        const ssnO = spriteNodeO.addComponent(SnapShotNode);
        const ssnI = spriteNodeI.addComponent(SnapShotNode);
        ssnO.vid = id;
        ssnO.inout = InOrOut.Out;
        ssnI.vid = id;
        ssnI.inout = InOrOut.In;
        spriteNodeO.layer = this.outHistoryListNode.layer;
        spriteNodeI.layer = spriteNodeO.layer;
        spriteNodeO.setScale(new Vec3(1, -1, 1));
        spriteNodeI.setScale(new Vec3(1, -1, 1));

        const spO = spriteNodeO.addComponent(Sprite);
        const spI = spriteNodeI.addComponent(Sprite);
        // 等待后续赋值
        spO.spriteFrame = null;
        spI.spriteFrame = null;
        const idLabelO = new Node();
        const idLabelI = new Node();
        idLabelO.layer = this.outHistoryListNode.layer;
        idLabelI.layer = idLabelO.layer;
        const ilO = idLabelO.addComponent(Label);
        const ilI = idLabelI.addComponent(Label);
        ilO.string = id;
        ilI.string = id;
        ilO.fontSize = 15;
        ilI.fontSize = 10;
        ilO.lineHeight = 15;
        ilI.lineHeight = 10;
        ilO.overflow = Overflow.RESIZE_HEIGHT;
        ilI.overflow = Overflow.RESIZE_HEIGHT;
        spriteNodeO.addChild(idLabelO);
        spriteNodeI.addChild(idLabelI);
        idLabelO.setPosition(new Vec3(0, 60, 0));
        idLabelI.setPosition(new Vec3(0, 50, 0));
        idLabelO.setScale(new Vec3(1, -1, 1));
        idLabelI.setScale(new Vec3(1, -1, 1));

        
        this.outHistoryListNode.addChild(spriteNodeO);
        this.innerHistoryListNode.addChild(spriteNodeI);
        let xpos = 0;   
        let ypos = 0;
        const childListO = this.outHistoryListNode.children;
        const childListI = this.innerHistoryListNode.children;
        for (let i = childListO.length - 1; i >= 0; i--, xpos -= 120, ypos -= 110) {
            childListO[i].position = new Vec3(xpos, 15, 0);
            childListI[i].position = new Vec3(0, ypos, 0);
        }
        this.outHistoryListNode.setPosition(new Vec3(440, 0, 0));
        this.innerHistoryListNode.setPosition(new Vec3(0, 215, 0));
    }

    public push(voxel: Vec3[], id: string, emb: number[], idx: number, sss: boolean = false): boolean {
        if (this.isExist(id) != -1)
            return true;
        
        if (this.voxelIdxHistory.push({ vid: id, embedding: emb, idxInData: idx, snapShotState: sss })) {
            this.rawVoxelDataHistory.push(voxel);
            this.pushSprite(id);
            return true;
        }
        return false;
    }

    public setSnapShot(sf: SpriteFrame) {
        const childListO = this.outHistoryListNode.children;
        childListO[childListO.length - 1].getComponent(Sprite).spriteFrame = sf;
        childListO[childListO.length - 1].getComponent(UITransform).contentSize.set(100, 100);
        const childListI = this.innerHistoryListNode.children;
        childListI[childListI.length - 1].getComponent(Sprite).spriteFrame = sf;
        childListI[childListI.length - 1].getComponent(UITransform).contentSize.set(80, 80);
    }

    public getSnapShotById(id: string) {
        const idx = this.isExist(id);
        return this.outHistoryListNode.children[idx].getComponent(Sprite).spriteFrame;
    }

    public getIdxInDataById(id: string): number {
        const idx = this.isExist(id);
        console.log('in history? ' + idx);
        return this.voxelIdxHistory.getElement(idx).idxInData;
    }

    public getEmbById(id: string): number[] {
        const idx = this.isExist(id);
        console.log('in history? ' + idx);
        return this.voxelIdxHistory.getElement(idx).embedding;
    }

    public popHead() {
        this.rawVoxelDataHistory.popHead();
        this.voxelIdxHistory.popHead();

        const childListO = this.outHistoryListNode.children;
        const childListI = this.innerHistoryListNode.children;
        if (childListO.length > this.maxLength) {
            const chtailO = childListO[0];
            const chtailI = childListI[0];
            this.outHistoryListNode.removeChild(childListO[0]);
            this.innerHistoryListNode.removeChild(childListI[0]);
            chtailO.destroy();
            chtailI.destroy();
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
 
    constructor(maxLength: number = 0) {
        this.maxLength = maxLength;
        this.data = new Array(maxLength);
    };

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
