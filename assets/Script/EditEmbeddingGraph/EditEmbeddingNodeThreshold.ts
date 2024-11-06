import { _decorator, Component, instantiate, Label, Node, Vec2, SpringJoint2D, Sprite, Color } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
import { EditEmbeddingNodeType, EditEmbeddingOutputType, EENTypeWithDiffOperand } from '../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('EditEmbeddingNodeThreshold')
export class EditEmbeddingNodeThreshold extends EditEmbeddingNodeBase {

    start() {
        /**整体bg */
        this.backgroundGraphic.clear();
        this.backgroundGraphic.fillColor.fromHEX('#666666');
        this.backgroundGraphic.moveTo(-32, 15);
        this.backgroundGraphic.lineTo(32, 15);
        this.backgroundGraphic.lineTo(32, -31);
        this.backgroundGraphic.lineTo(-32, -31);
        this.backgroundGraphic.lineTo(-32, 15);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        this.nodeBoundingBox = {
            left: -34, 
            right: 34,
            top: 15,
            bottom: -31 
        }

        /**name label bg */
        this.backgroundGraphic.fillColor.fromHEX('#888888');
        this.backgroundGraphic.moveTo(-32, 15);
        this.backgroundGraphic.lineTo(32, 15);
        this.backgroundGraphic.lineTo(32, 1);
        this.backgroundGraphic.lineTo(-32, 1);
        this.backgroundGraphic.lineTo(-32, 15);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        this.nameLabel.setPosition(0, 15);
        this.nameLabel.getComponent(Label).string = 'Threshold';
        this.nodeType = EditEmbeddingNodeType.Threshold;
        this.outputType = EditEmbeddingOutputType.VoxelEmbedding;

        /**input bg */
        this.backgroundGraphic.moveTo(-32, 0);
        this.backgroundGraphic.lineTo(0, 0);
        this.backgroundGraphic.lineTo(0, -30);
        this.backgroundGraphic.lineTo(-32, -30);
        this.backgroundGraphic.lineTo(-32, 0);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        this.inputNode1.active = true;
        this.inputNode2.active = true;
        this.inputNode3.active = true;
        this.inputNode1.setPosition(-32, -5);
        this.inputNode1.getComponent(Sprite).color = new Color(255, 255, 0);
        this.inputNode2.setPosition(-32, -15);
        this.inputNode3.setPosition(-32, -25);
        this.outputNode.setPosition(32, -10);
        this.inputNode1.getChildByName('inputType').getComponent(Label).string = 'Voxel';
        this.inputNode2.getChildByName('inputType').getComponent(Label).string = 'Pos';
        this.inputNode3.getChildByName('inputType').getComponent(Label).string = 'Neg';

    }

    protected update(dt: number): void {
        if (this.isInputChange && this.inputFrom1 && this.inputFrom2 && this.inputFrom3) {
            console.log('update calculate threshold');
            this.calculateNode();
        }
    }


    /**from和input都是button节点，不要传错了 */
    public override setInput(from: Node, input: Node): boolean {
        // const otherInput = input === this.inputNode1 ? this.inputNode2 : this.inputNode1;
        const fromNum = input === this.inputNode1 ? 1 : 2;
        let originFrom = null;
        let fromEENB = from.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        if (input === this.inputNode1) {
            if (fromEENB.outputType !== EditEmbeddingOutputType.VoxelEmbedding)
                return false;
            originFrom = this.inputFrom1;
        } else if (input === this.inputNode2) {
            if (fromEENB.outputType !== EditEmbeddingOutputType.Number)
                return false;
            originFrom = this.inputFrom2;
        } else if (input === this.inputNode3) {
            if (fromEENB.outputType !== EditEmbeddingOutputType.Number)
                return false;
            originFrom = this.inputFrom3;
        }

        if (originFrom) {
            const eeno = originFrom.getParent().getParent().getComponent(EditEmbeddingNodeBase);
            eeno.outputTo = null;
            eeno.connectLineGraphic.clear();
        } 
        const g = fromEENB.connectLineGraphic;
        g.clear();
        g.moveTo(0, 0);
        const lineTarget = (new Vec2(input.worldPosition.x, input.worldPosition.y)).subtract(new Vec2(from.worldPosition.x, from.worldPosition.y));
        g.lineTo(lineTarget.x, lineTarget.y);
        g.stroke();                
        fromEENB.outputTo = input;
        
        if (input === this.inputNode1) 
            this.inputFrom1 = from;
        else if (input === this.inputNode2)
            this.inputFrom2 = from;
        else
            this.inputFrom3 = from;
            
        if (this.inputFrom1 && this.inputFrom2 && this.inputFrom3)
            this.calculateNode();
        return true;
    }

    /**计算该运算符的值，并通知output后继节点数值改变 */
    private calculateNode() {
        const originVal = this.value;
        const eenb1 = this.inputFrom1.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        const eenb2 = this.inputFrom2.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        const eenb3 = this.inputFrom3.getParent().getParent().getComponent(EditEmbeddingNodeBase);

        const thresholdPos = (num: number, th: number) => {
            return num >= th ? num : 0;
        };

        const thresholdNeg = (num: number, th: number) => {
            return num <= th ? num : 0;
        };
        this.value = new Array(128);
        for (let i = 0; i < 128; i++) {
            this.value[i] = eenb1.value[i] > 0 ? thresholdPos(eenb1.value[i], eenb2.value) : thresholdNeg(eenb1.value[i], eenb3.value);
        }

        if (originVal !== this.value) {
            this.outputTo?.getParent().getParent().getComponent(EditEmbeddingNodeBase).changeInputValue(this.outputNode);
        }
        this.isInputChange = false;
    }



}


