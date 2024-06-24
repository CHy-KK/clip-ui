import { _decorator, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, Vec2, Vec4 } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
import { EditEmbeddingNodeType, EditEmbeddingOutputType } from '../Utils/Utils';
import { EegMsg, GET_VOXEL_FOR_EEGRAPH } from '../Controller';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('EditEmbeddingNodeVoxel')
export class EditEmbeddingNodeVoxel extends EditEmbeddingNodeBase {

    public voxelSnapShot: SpriteFrame = null;
    private spNode: Node = null;
    private vid: string = null;

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
            left: -34, 
            right: 34,
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
        this.nameLabel.getComponent(Label).string = 'Voxel Node';
        this.nodeType = EditEmbeddingNodeType.Voxel;
        this.outputNode.getChildByName('outputType').getComponent(Label).string = this.outputType;

        /**input bg */
        this.backgroundGraphic.moveTo(-32, 35);
        this.backgroundGraphic.lineTo(0, 35);
        this.backgroundGraphic.lineTo(0, 21);
        this.backgroundGraphic.lineTo(-32, 21);
        this.backgroundGraphic.lineTo(-32, 35);
        this.backgroundGraphic.fill();
        this.inputNode1.active = true;
        this.inputNode1.setPosition(-32, 28);
        this.outputNode.setPosition(32, 28);

        this.spNode = new Node();
        this.spNode.layer = this.node.layer;
        const sp = this.spNode.addComponent(Sprite);
        sp.spriteFrame = this.voxelSnapShot;
        this.spNode.setPosition(0, -12);
        this.spNode.setScale(1, -1, 1);
        this.spNode.getComponent(UITransform).contentSize.set(64, 64);
        this.node.addChild(this.spNode);
    }

    protected update(dt: number): void {
        if (this.isInputChange) {
            const newFromVal = this.inputFrom1.getParent().getParent().getComponent(EditEmbeddingNodeBase).value;
            if (this.value !== newFromVal) {
                this.value = newFromVal;
                /**@TODO 这里的feature后面需要根据情况填入，如果feature */
                this.EEGController.controller.node.emit(GET_VOXEL_FOR_EEGRAPH, { emb: this.value, eenv: this, feature: null});
                this.outputTo?.getParent().getParent().getComponent(EditEmbeddingNodeBase).changeInputValue(this.outputNode);
            }
            this.isInputChange = false;
        }
    }

    /**外部设置embedding只允许第一次创建时设置 */
    public setEmbd(emb: number[], embType: EditEmbeddingOutputType) {
        if (!this.value) {
            this.value = emb;
            this.outputType = embType;
        }
    }
    //TODO: 

    /**from和input都是button节点，不要传错了; voxel节点不能连接voxel节点 */
    public override setInput(from: Node, input: Node): boolean {
        console.log('set input voxel');
        const fromEENB = from.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        if (fromEENB.nodeType !==  EditEmbeddingNodeType.Voxel && (fromEENB.outputType === EditEmbeddingOutputType.VoxelEmbedding || fromEENB.outputType === EditEmbeddingOutputType.ClipEmbedding)) {
            this.outputType = fromEENB.outputType;
            if (this.inputFrom1) {
                const eenb = this.inputFrom1.getParent().getParent().getComponent(EditEmbeddingNodeBase);
                eenb.outputTo = null;
                eenb.connectLineGraphic.clear();
            }
            fromEENB.outputTo = this.inputNode1;
            this.inputFrom1 = fromEENB.outputNode;
            const g = fromEENB.connectLineGraphic;
            g.clear();
            g.moveTo(0, 0);
            const lineTarget = (new Vec2(input.worldPosition.x, input.worldPosition.y)).subtract(new Vec2(from.worldPosition.x, from.worldPosition.y));
            g.lineTo(lineTarget.x, lineTarget.y);
            g.stroke();
            const originVal = this.value;
            this.value = fromEENB.value;

            if (this.value !== originVal) {
                console.log('set new value');
                const msg: EegMsg = {
                    emb: this.value, 
                    eenv: this,
                    feature: null
                }

                this.EEGController.controller.node.emit(GET_VOXEL_FOR_EEGRAPH, msg);
                this.outputTo?.getParent().getParent().getComponent(EditEmbeddingNodeBase).changeInputValue(this.outputNode);
            }
        } else 
            return false;
        return true;
    }

    public setVoxelInfo(spf: SpriteFrame, vid: string) {
        this.vid = vid;
        const sp = this.spNode.getComponent(Sprite);
        sp.spriteFrame = spf;
        this.spNode.getComponent(UITransform).contentSize.set(64, 64);
    }

    public override setClick() {
        this.EEGController.drawDetailInfoNode(this.value);
    }
}
