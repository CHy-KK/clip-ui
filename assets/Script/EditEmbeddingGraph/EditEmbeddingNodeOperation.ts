import { _decorator, Component, instantiate, Label, Node, Vec2 } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
import { EditEmbeddingNodeType } from '../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('EditEmbeddingNodeOperation')
export class EditEmbeddingNodeOperation extends EditEmbeddingNodeBase {

    private numLabel: Label = null;

    start() {
        /**整体bg */
        this.backgroundGraphic.clear();
        this.backgroundGraphic.fillColor.fromHEX('#666666');
        this.backgroundGraphic.moveTo(-32, 15);
        this.backgroundGraphic.lineTo(32, 15);
        this.backgroundGraphic.lineTo(32, -35);
        this.backgroundGraphic.lineTo(-32, -35);
        this.backgroundGraphic.lineTo(-32, 15);
        this.backgroundGraphic.fill();
        this.nodeBoundingBox = {
            left: -32, 
            right: 32,
            top: 15,
            bottom: -35 
        }

        /**name label bg */
        this.backgroundGraphic.fillColor.fromHEX('#888888');
        this.backgroundGraphic.moveTo(-32, 15);
        this.backgroundGraphic.lineTo(32, 15);
        this.backgroundGraphic.lineTo(32, 1);
        this.backgroundGraphic.lineTo(-32, 1);
        this.backgroundGraphic.lineTo(-32, 15);
        this.backgroundGraphic.fill();
        this.nameLabel.setPosition(0, 15);
        this.nameLabel.getComponent(Label).string = this.nodeType;

        /**input bg */
        this.backgroundGraphic.moveTo(-32, 0);
        this.backgroundGraphic.lineTo(0, 0);
        this.backgroundGraphic.lineTo(0, -20);
        this.backgroundGraphic.lineTo(-32, -20);
        this.backgroundGraphic.lineTo(-32, 0);
        this.backgroundGraphic.fill();
        this.inputNode1.setPosition(-27, -5);
        this.inputNode2.setPosition(-27, -15);
        this.outputNode.setPosition(27, -10);

        /**show number bg */
        this.backgroundGraphic.moveTo(-32, -21);
        this.backgroundGraphic.lineTo(32, -21);
        this.backgroundGraphic.lineTo(32, -35);
        this.backgroundGraphic.lineTo(-32, -35);
        this.backgroundGraphic.lineTo(-32, -21);
        this.backgroundGraphic.fill();
        const numLabelNode = instantiate(this.EEGController.numLabelPrefab);
        numLabelNode.layer = this.node.layer;
        this.node.addChild(numLabelNode);
        numLabelNode.setPosition(0, -22);
        this.numLabel = numLabelNode.getComponent(Label);
    }

    protected update(dt: number): void {
        if (this.isInputChange && this.inputFrom1 && this.inputFrom2) {
            console.log('update calculate')
            this.calculateNode();
        }
    }

    /**from和input都是button节点，不要传错了 */
    public override setInput(from: Node, input: Node): boolean {
        // const otherInput = input === this.inputNode1 ? this.inputNode2 : this.inputNode1;
        const fromNum = input === this.inputNode1 ? 1 : 2;
        const otherFrom = fromNum === 1 ? this.inputFrom2 : this.inputFrom1;
        const originFrom = fromNum === 1 ? this.inputFrom1 : this.inputFrom2; 
        const thisEENB = from.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        // if (!thisEENB.cancelConnectOuput())
        //     return false;
        const otherType = otherFrom?.getParent().getParent().getComponent(EditEmbeddingNodeBase).outputType;
        if (!otherFrom || (thisEENB.outputType === EditEmbeddingNodeType.Number && otherType === EditEmbeddingNodeType.Number) ||
            (thisEENB.outputType === otherType && this.nodeType !== EditEmbeddingNodeType.Multiply && this.nodeType !== EditEmbeddingNodeType.Divide) ||
            (thisEENB.outputType !== otherType && (this.nodeType === EditEmbeddingNodeType.Multiply || this.nodeType === EditEmbeddingNodeType.Divide))) {
            if (originFrom) {
                const eeno = originFrom.getParent().getParent().getComponent(EditEmbeddingNodeBase);
                eeno.outputTo = null;
                eeno.connectLineGraphic.clear();
            } 
            const g = thisEENB.connectLineGraphic;
            g.clear();
            g.moveTo(0, 0);
            const lineTarget = (new Vec2(input.worldPosition.x, input.worldPosition.y)).subtract(new Vec2(from.worldPosition.x, from.worldPosition.y));
            g.lineTo(lineTarget.x, lineTarget.y);
            g.stroke();                
            thisEENB.outputTo = input;
            
            if (input === this.inputNode1) 
                this.inputFrom1 = from;
            else 
                this.inputFrom2 = from;

            // this.outputType = thisEENB.outputType;
            // this.outputNode.getChildByName('outputType').getComponent(Label).string = thisEENB.outputType;
            
        } else 
            return false;
        if (this.inputFrom1 && this.inputFrom2)
            this.calculateNode();
        else {

        }
        return true;
    }

    /**计算该运算符的值，并通知output后继节点数值改变 */
    private calculateNode() {
        const originVal = this.value;
        const eenb1 = this.inputFrom1.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        const eenb2 = this.inputFrom2.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        switch (this.nodeType) {
            case EditEmbeddingNodeType.Add:
                if (eenb1.outputType === EditEmbeddingNodeType.Number) {
                    this.value = eenb1.value + eenb2.value;
                    this.outputType = EditEmbeddingNodeType.Number;
                } else {
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = eenb1.value[i] + eenb2.value[i];
                    this.outputType = EditEmbeddingNodeType.Voxel;
                }
                break;


            case EditEmbeddingNodeType.Subtract:
                if (eenb1.outputType === EditEmbeddingNodeType.Number) {
                    this.value = eenb1.value - eenb2.value;
                    this.outputType = EditEmbeddingNodeType.Number;
                } else {
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = eenb1.value[i] - eenb2.value[i];
                    this.outputType = EditEmbeddingNodeType.Voxel;
                }
                break;

            case EditEmbeddingNodeType.Multiply:
                if (eenb1.outputType === EditEmbeddingNodeType.Number && eenb2.outputType === EditEmbeddingNodeType.Number) {
                    this.value = eenb1.value * eenb2.value;
                    this.outputType = EditEmbeddingNodeType.Number;
                } else if (eenb1.outputType === EditEmbeddingNodeType.Number && eenb2.outputType === EditEmbeddingNodeType.Voxel) {
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = eenb1.value * eenb2.value[i];
                    this.outputType = EditEmbeddingNodeType.Voxel;
                } else if (eenb1.outputType === EditEmbeddingNodeType.Voxel && eenb2.outputType === EditEmbeddingNodeType.Number) {
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = eenb2.value * eenb1.value[i];
                    this.outputType = EditEmbeddingNodeType.Voxel;
                }
                break;

            case EditEmbeddingNodeType.Divide:
                if (eenb1.outputType === EditEmbeddingNodeType.Number && eenb2.outputType === EditEmbeddingNodeType.Number) {
                    if (eenb2.value === 0)
                        return;
                    this.value = eenb1.value / eenb2.value;
                    this.outputType = EditEmbeddingNodeType.Number;
                } else if (eenb1.outputType === EditEmbeddingNodeType.Number && eenb2.outputType === EditEmbeddingNodeType.Voxel) {
                    if (eenb1.value === 0)
                        return;
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = eenb2.value[i] / eenb1.value;
                    this.outputType = EditEmbeddingNodeType.Voxel;
                } else if (eenb1.outputType === EditEmbeddingNodeType.Voxel && eenb2.outputType === EditEmbeddingNodeType.Number) {
                    if (eenb2.value === 0)
                        return;
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = eenb1.value[i] / eenb2.value;
                    this.outputType = EditEmbeddingNodeType.Voxel;
                }
                break;

            case EditEmbeddingNodeType.Max:
                if (eenb1.outputType === EditEmbeddingNodeType.Number) {
                    this.value = Math.max(eenb1.value, eenb2.value);
                    this.outputType = EditEmbeddingNodeType.Number;
                } else {
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = Math.max(eenb1.value[i], eenb2.value[i]);
                    this.outputType = EditEmbeddingNodeType.Voxel;
                }
                break;

            case EditEmbeddingNodeType.Min:
                if (eenb1.outputType === EditEmbeddingNodeType.Number) {
                    this.value = Math.min(eenb1.value, eenb2.value);
                    this.outputType = EditEmbeddingNodeType.Number;
                } else {
                    this.value = new Array(128);
                    for (let i = 0; i < 128; i++)
                        this.value[i] = Math.min(eenb1.value[i], eenb2.value[i]);
                    this.outputType = EditEmbeddingNodeType.Voxel;
                }
                break;
        }

        this.outputNode.getChildByName('outputType').getComponent(Label).string = this.outputType;

        if (this.outputType === EditEmbeddingNodeType.Number) {
            this.numLabel.string = this.value;
        }
        if (originVal !== this.value) {
            this.outputTo?.getParent().getParent().getComponent(EditEmbeddingNodeBase).changeInputValue(this.outputNode);
        }
        this.isInputChange = false;
    }

    public override setOutputLabel() {
        super.setOutputLabel();
        this.numLabel.string = '';
    }

}


