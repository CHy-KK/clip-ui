import { _decorator, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, Vec2, Vec4 } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('EditEmbeddingNodeVoxel')
export class EditEmbeddingNodeVoxel extends EditEmbeddingNodeBase {

    public voxelSnapShot: SpriteFrame = null;

    start() {        
        /**整体bg */
        this.backgroundGraphic.clear();
        this.backgroundGraphic.fillColor.fromHEX('#666666');
        this.backgroundGraphic.moveTo(-32, 50);
        this.backgroundGraphic.lineTo(32, 50);
        this.backgroundGraphic.lineTo(32, -49);
        this.backgroundGraphic.lineTo(-32, -49);
        this.backgroundGraphic.lineTo(-32, 50);
        this.backgroundGraphic.fill();

        /**name label bg */
        this.backgroundGraphic.fillColor.fromHEX('#888888');
        this.backgroundGraphic.moveTo(-32, 50);
        this.backgroundGraphic.lineTo(32, 50);
        this.backgroundGraphic.lineTo(32, 36);
        this.backgroundGraphic.lineTo(-32, 36);
        this.backgroundGraphic.lineTo(-32, 50);
        this.backgroundGraphic.fill();
        this.nameLabel.setPosition(0, 50);
        this.nodeBoundingBox = {
            left: -32, 
            right: 32,
            top: 50,
            bottom: -49 
        }

        /**input bg */
        this.backgroundGraphic.moveTo(-32, 35);
        this.backgroundGraphic.lineTo(0, 35);
        this.backgroundGraphic.lineTo(0, 15);
        this.backgroundGraphic.lineTo(-32, 15);
        this.backgroundGraphic.lineTo(-32, 35);
        this.backgroundGraphic.fill();
        this.inputNode1.setPosition(-27, 30);
        this.inputNode2.setPosition(-27, 22);
        this.outPutNode.setPosition(27, 26);
        this.inputNodePos1 = new Vec2(-27, 30);
        this.inputNodePos2 = new Vec2(-27, 22);
        this.outputNodePos = new Vec2(27, 26);

        const spNode = new Node();
        spNode.layer = this.node.layer;
        const sp = spNode.addComponent(Sprite);
        sp.spriteFrame = this.voxelSnapShot;
        spNode.setPosition(0, -17);
        spNode.getComponent(UITransform).contentSize.set(64, 64);
        this.node.addChild(spNode);
        this.nameLabel.getComponent(Label).string = 'Voxel';

    }

    update(deltaTime: number) {

    }

}


