import { _decorator, Component, instantiate, Label, Node, Vec2 } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
import { EditEmbeddingNodeType, EditEmbeddingOutputType, EENTypeWithDiffOperand } from '../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('EditEmbeddingNodeOperation')
export class EditEmbeddingNodeOperation extends EditEmbeddingNodeBase {

    private numLabel: Label = null;
    private _nodeName: string = null;

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
            left: -34, 
            right: 34,
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
        this.nameLabel.getComponent(Label).string = this.nodeName;
        this.inputNode1.active = true;
        this.inputNode2.active = true;
        if (this.nodeType === EditEmbeddingNodeType.Divide) {
            this.inputNode1.getChildByName('inputType').getComponent(Label).string = 'divisor';
            this.inputNode2.getChildByName('inputType').getComponent(Label).string = 'dividend';
        }

        /**input bg */
        this.backgroundGraphic.moveTo(-32, 0);
        this.backgroundGraphic.lineTo(0, 0);
        this.backgroundGraphic.lineTo(0, -20);
        this.backgroundGraphic.lineTo(-32, -20);
        this.backgroundGraphic.lineTo(-32, 0);
        this.backgroundGraphic.fill();
        this.inputNode1.setPosition(-32, -5);
        this.inputNode2.setPosition(-32, -15);
        this.outputNode.setPosition(32, -10);

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

    public set nodeName(val: string) {
        if (!this._nodeName)
            this._nodeName = val;
    }

    public get nodeName() {
        return this._nodeName;
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
        if ((thisEENB.outputType === EditEmbeddingOutputType.ClipEmbedding && otherType === EditEmbeddingOutputType.VoxelEmbedding) ||
            (thisEENB.outputType === EditEmbeddingOutputType.VoxelEmbedding && otherType === EditEmbeddingOutputType.ClipEmbedding))
            return false;
        if (!otherFrom
            || (thisEENB.outputType !== otherType && (this.nodeType & EENTypeWithDiffOperand)) 
            || (thisEENB.outputType === otherType && this.nodeType !== EditEmbeddingNodeType.BiDirAdd)
            ) {
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
            
        } else 
            return false;
        if (this.inputFrom1 && this.inputFrom2)
            this.calculateNode();
  
        return true;
    }

    // TODO: 新增几种运算：
    // 目前来看，影响向量转换体素的是较大维度之间的差值大小，如果单纯改变一个embedding的比例（乘一个值），会形变很严重；如果把两个向量相加，反而保留特征的比较好，比使用max还好，所以要看看两个embeding最大值拉平之后，
    // 既然现在一般运算的结果很差，那么也可以利用“阈值消去低部来删除翅膀特征”这个思路，干脆对用户开放完全embedding自由编辑，让用户自己选择需要保留的维度、哪几个维度需要保持差值之类的
    // 实验一下过阈值之后再加到汽车上去，或者和汽车过一个max的结果，单纯做阈值说不定本来就不好看，要结合其他的一起看，或者过阈值不应该给0，而是应该给0.1、0.2这样
    /**计算该运算符的值，并通知output后继节点数值改变 */
    private calculateNode() {
        const originVal = this.value;
        const eenb1 = this.inputFrom1.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        const eenb2 = this.inputFrom2.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        console.log(eenb1.value);
        console.log(eenb2.value);
        switch (this.nodeType) {
            case EditEmbeddingNodeType.Add:
                if (eenb1.outputType === EditEmbeddingOutputType.Number) {
                    if (eenb2.outputType === EditEmbeddingOutputType.Number) {
                        this.value = eenb1.value + eenb2.value;
                        this.outputType = EditEmbeddingOutputType.Number;
                    } else {
                        const embLen = eenb2.value.length;
                        this.value = new Array(embLen);
                        for (let i = 0; i < embLen; i++)
                            this.value[i] = eenb1.value + eenb2.value[i];
                        this.outputType = eenb2.outputType;
                    }
                } else {
                    const embLen = eenb1.value.length;
                    this.value = new Array(embLen);
                    if (eenb2.outputType === EditEmbeddingOutputType.Number) {
                        for (let i = 0; i < embLen; i++)
                            this.value[i] = eenb1.value[i] + eenb2.value;
                    } else {
                        for (let i = 0; i < embLen; i++)
                            this.value[i] = eenb1.value[i] + eenb2.value[i];
                    }
                    this.outputType = eenb1.outputType;
                }
                break;


            case EditEmbeddingNodeType.BiDirAdd:
                if (eenb1.outputType === EditEmbeddingOutputType.Number) {
                    this.value = new Array(eenb2.value.length);
                    for (let i = 0; i < eenb2.value.length; i++)
                        this.value[i] = eenb1.value * Math.sign(eenb2.value[i]) + eenb2.value[i];
                    this.outputType = eenb2.outputType;
                } else {
                    this.value = new Array(eenb1.value.length);
                    for (let i = 0; i < eenb1.value.length; i++)
                        this.value[i] = eenb1.value[i] + eenb2.value * Math.sign(eenb1.value[i]);
                    this.outputType = eenb1.outputType;
                    
                }
                break;

            case EditEmbeddingNodeType.Multiply:
                if (eenb1.outputType === EditEmbeddingOutputType.Number && eenb2.outputType === EditEmbeddingOutputType.Number) {
                    this.value = eenb1.value * eenb2.value;
                    this.outputType = EditEmbeddingOutputType.Number;
                } else if (eenb1.outputType === EditEmbeddingOutputType.Number && (eenb2.outputType === EditEmbeddingOutputType.VoxelEmbedding || eenb2.outputType === EditEmbeddingOutputType.ClipEmbedding)) {
                    this.value = new Array(eenb2.value.length);
                    for (let i = 0; i < eenb2.value.length; i++)
                        this.value[i] = eenb1.value * eenb2.value[i];
                    this.outputType = eenb2.outputType;
                } else if ((eenb1.outputType === EditEmbeddingOutputType.VoxelEmbedding || eenb1.outputType === EditEmbeddingOutputType.ClipEmbedding) && eenb2.outputType === EditEmbeddingOutputType.Number) {
                    this.value = new Array(eenb1.value.length);
                    for (let i = 0; i < eenb1.value.length; i++)
                        this.value[i] = eenb2.value * eenb1.value[i];
                    this.outputType = eenb1.outputType;
                }
                break;

            case EditEmbeddingNodeType.Divide:
                if (eenb1.outputType === EditEmbeddingOutputType.Number && eenb2.outputType === EditEmbeddingOutputType.Number) {
                    if (eenb2.value === 0)
                        return;
                    this.value = eenb1.value / eenb2.value;
                    this.outputType = EditEmbeddingOutputType.Number;
                } else if (eenb1.outputType === EditEmbeddingOutputType.Number && (eenb2.outputType === EditEmbeddingOutputType.VoxelEmbedding || eenb2.outputType === EditEmbeddingOutputType.ClipEmbedding)) {
                    if (eenb1.value === 0)
                        return;
                    this.value = new Array(eenb2.value.length);
                    for (let i = 0; i < eenb2.value.length; i++)
                        this.value[i] = eenb1.value / (eenb2.value[i] === 0 ? 0.01 : eenb2.value[i]);
                        this.outputType = eenb2.outputType;
                } else if ((eenb1.outputType === EditEmbeddingOutputType.VoxelEmbedding || eenb1.outputType === EditEmbeddingOutputType.ClipEmbedding) && eenb2.outputType === EditEmbeddingOutputType.Number) {
                    if (eenb2.value === 0)
                        return;
                    this.value = new Array(eenb1.value.length);
                    for (let i = 0; i < eenb1.value.length; i++)
                        this.value[i] = eenb1.value[i] / (eenb2.value === 0 ? 0.01 : eenb2.value);
                        this.outputType = eenb1.outputType;
                }
                break;

            case EditEmbeddingNodeType.Max:
                if (eenb1.outputType === EditEmbeddingOutputType.Number) {
                    this.value = Math.max(eenb1.value, eenb2.value);
                    this.outputType = EditEmbeddingOutputType.Number;
                } else {
                    this.value = new Array(eenb2.value.length);
                    for (let i = 0; i < eenb2.value.length; i++)
                        this.value[i] = Math.abs(eenb1.value[i]) > Math.abs(eenb2.value[i]) ? eenb1.value[i] : eenb2.value[i];
                    this.outputType = eenb1.outputType;
                }
                break;

            case EditEmbeddingNodeType.Min:
                if (eenb1.outputType === EditEmbeddingOutputType.Number) {
                    this.value = Math.min(eenb1.value, eenb2.value);
                    this.outputType = EditEmbeddingOutputType.Number;
                } else {
                    this.value = new Array(eenb2.value.length);
                    for (let i = 0; i < eenb2.value.length; i++)
                        this.value[i] = Math.abs(eenb1.value[i]) < Math.abs(eenb2.value[i]) ? eenb1.value[i] : eenb2.value[i];
                    this.outputType = eenb1.outputType;
                }
                break;
        }

        if (this.outputType === EditEmbeddingOutputType.Number) {
            this.numLabel.string = this.value;
        }

        console.log(this.value);
        if (originVal !== this.value) {
            this.outputTo?.getParent().getParent().getComponent(EditEmbeddingNodeBase).changeInputValue(this.outputNode);
        }
        this.isInputChange = false;
    }

    public override cancelConnectInput(inNode: Node) {
        super.cancelConnectInput(inNode);
        this.setOutputLabel();
    }

    public override cancelConnectOuput(): boolean {
        const res = super.cancelConnectOuput();
        this.setOutputLabel();
        return res;
    }

    public setOutputLabel() {
        if (!this.inputFrom1 && !this.inputFrom2) 
            this.outputType = EditEmbeddingOutputType.None;
        
        this.numLabel.string = '';
    }

    public setClick() {
        if (this.outputType === EditEmbeddingOutputType.VoxelEmbedding || this.outputType === EditEmbeddingOutputType.ClipEmbedding) {
            this.EEGController.drawDetailInfoNode(this.value);
        }
    }
}


