import { _decorator, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, Vec2, Vec4 } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
import { EditEmbeddingNodeType } from '../Utils/Utils';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('EditEmbeddingNodeVoxel')
export class EditEmbeddingNodeVoxel extends EditEmbeddingNodeBase {

    public voxelSnapShot: SpriteFrame = null;
    public embedding: number[] = [];

    start() {        
        /**整体bg */
        this.backgroundGraphic.clear();
        this.backgroundGraphic.fillColor.fromHEX('#666666');
        this.backgroundGraphic.moveTo(-32, 50);
        this.backgroundGraphic.lineTo(32, 50);
        this.backgroundGraphic.lineTo(32, -44);
        this.backgroundGraphic.lineTo(-32, -44);
        this.backgroundGraphic.lineTo(-32, 50);
        this.backgroundGraphic.fill();
        this.nodeBoundingBox = {
            left: -32, 
            right: 32,
            top: 50,
            bottom: -44 
        }

        /**name label bg */
        this.backgroundGraphic.fillColor.fromHEX('#888888');
        this.backgroundGraphic.moveTo(-32, 50);
        this.backgroundGraphic.lineTo(32, 50);
        this.backgroundGraphic.lineTo(32, 36);
        this.backgroundGraphic.lineTo(-32, 36);
        this.backgroundGraphic.lineTo(-32, 50);
        this.backgroundGraphic.fill();
        this.nameLabel.setPosition(0, 50);
        this.nameLabel.getComponent(Label).string = 'Voxel';
        this.nodeType = EditEmbeddingNodeType.Voxel;
        this.outputType = EditEmbeddingNodeType.Voxel;
        this.outputNode.getChildByName('outputType').getComponent(Label).string = 'Voxel';

        /**input bg */
        this.backgroundGraphic.moveTo(-32, 35);
        this.backgroundGraphic.lineTo(0, 35);
        this.backgroundGraphic.lineTo(0, 21);
        this.backgroundGraphic.lineTo(-32, 21);
        this.backgroundGraphic.lineTo(-32, 35);
        this.backgroundGraphic.fill();
        this.inputNode1.setPosition(-27, 28);
        this.outputNode.setPosition(27, 28);
        this.inputNode2.active = false;

        const spNode = new Node();
        spNode.layer = this.node.layer;
        const sp = spNode.addComponent(Sprite);
        sp.spriteFrame = this.voxelSnapShot;
        spNode.setPosition(0, -12);
        spNode.getComponent(UITransform).contentSize.set(64, 64);
        this.node.addChild(spNode);
        this.value = new Array(128);
    }

    /**外部设置embedding只允许第一次创建时设置 */
    public setEmbd(emb: number[]) {
        if (!this.value)
            this.value = emb;
    }

    /**from和input都是button节点，不要传错了 */
    public override setInput(from: Node, input: Node): boolean {
        const fromEENB = from.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        if (fromEENB.outputType === EditEmbeddingNodeType.Voxel) {
            if (this.inputFrom1) {
                const eenb = this.inputFrom1.getParent().getParent().getComponent(EditEmbeddingNodeBase);
                eenb.outputTo = null;
                eenb.connectLineGraphic.clear();
            }
            fromEENB.outputTo = this.inputFrom1;
            this.inputFrom1 = fromEENB.outputNode;
            const g = fromEENB.connectLineGraphic;
            g.clear();
            g.moveTo(0, 0);
            const lineTarget = (new Vec2(input.worldPosition.x, input.worldPosition.y)).subtract(new Vec2(from.worldPosition.x, from.worldPosition.y));
            g.lineTo(lineTarget.x, lineTarget.y);
            g.stroke();
            this.value = fromEENB.value;

            // TODO: 这里接上获取后端体素渲染后图片(要写一个发送embedding获取voxel的接口)，然后传给后续节点
            // 这里可以先尝试用事件的方式通知controller触发获取体素事件
        } else 
            return false;
        return true;
    }
}


