import { _decorator, Button, Component, director, EventHandheld, EventHandle, EventHandler, EventTouch, Graphics, Input, instantiate, Label, Node, Sprite, UITransform, Vec2, Vec3 } from 'cc';
import { EditEmbeddingNodeType, EditEmbeddingOutputType, RectSize } from '../Utils/Utils';
import { EditEmbeddingGraphController } from './EditEmbeddingGraphController';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('EditEmbeddingNodeBase')
export class EditEmbeddingNodeBase extends Component {
    /**点击控制节点移动的button Node，下挂显示节点名字的Label Node */
    protected nameLabel: Node = null;

    /**用于绘制节点背景框 */
    protected backgroundGraphic: Graphics = null;

    /**本节点的input button节点 */
    public inputNode1: Node = null;
    /**本节点的input button节点 */
    public inputNode2: Node = null;
    /**本节点的input button节点 */
    public inputNode3: Node = null;
    /**记录连接本节点的前继输入节点的output button节点 */
    public inputFrom1: Node = null;
    /**记录连接本节点的前继输入节点的output button节点 */
    public inputFrom2: Node = null;
    /**记录连接本节点的前继输入节点的output button节点 */
    public inputFrom3: Node = null;
    /**本节点输出的button节点 */
    public outputNode: Node = null;
    /**记录本节点连接的输出目标节点的button节点 */
    public outputTo: Node = null;
    /**用于绘制节点到另一个节点连线，启点为0,0即可 */
    public connectLineGraphic: Graphics = null;

    protected EEGController: EditEmbeddingGraphController = null;
    protected _nodeType: EditEmbeddingNodeType = null;
    protected _outputType: EditEmbeddingOutputType = null;

    /**记录该节点包围盒 */
    public nodeBoundingBox: RectSize = null;

    /**记录该节点的数据number/voxel embedding */
    protected _value: any = null;

    protected isInputChange: boolean = false;

    protected onLoad(): void {
        this.EEGController = director.getScene().getChildByPath('mainUI/InnerUI/EditEmbedding').getComponent(EditEmbeddingGraphController);
        const funcNode = instantiate(this.EEGController.EditGraphNodePrefab);
        funcNode.layer = this.node.layer;
        this.node.addChild(funcNode);
        this.nameLabel = funcNode.getChildByName('nameLabel');
        this.backgroundGraphic = funcNode.getComponent(Graphics);
        this.connectLineGraphic = funcNode.getChildByPath('connectGraphButton/connectLineGraph').getComponent(Graphics);
        this.outputNode = funcNode.getChildByName('connectGraphButton');
        this.inputNode1 = funcNode.getChildByName('inputButton1');
        this.inputNode2 = funcNode.getChildByName('inputButton2');
        this.inputNode3 = funcNode.getChildByName('inputButton3');
    }


    /**只有第一次设置有效 */
    public set nodeType(val) {
        if (this._nodeType) 
            return;
        this._nodeType = val;
    }

    public get nodeType() {
        return this._nodeType;
    }

    public set outputType(val) {
        if (val === EditEmbeddingOutputType.Number || val === EditEmbeddingOutputType.Voxel)
            this._outputType = val;
    }

    public get outputType() {
        return this._outputType;
    }

    protected set value(val: any) {
        this._value = val;
    }

    public get value() {
        return this._value;
    }

    /**
     * 
     * @param clickPos 
     * @param out out.node 为点击中的input或output button节点
     * @returns 
     */
    public clickQuery(clickPos: Vec2, out: OutInfo): boolean {
        if (clickPos.x > this.node.worldPosition.x + this.nodeBoundingBox.left && clickPos.x < this.node.worldPosition.x + this.nodeBoundingBox.right &&
        clickPos.y > this.node.worldPosition.y + this.nodeBoundingBox.bottom && clickPos.y < this.node.worldPosition.y + this.nodeBoundingBox.top) {
            if (this.inputNode1.active && Vec2.distance(clickPos, new Vec2(this.inputNode1.worldPosition.x, this.inputNode1.worldPosition.y)) < 2.5) {
                out.str = 'input';
                out.node = this.inputNode1;
            } else if (this.inputNode2.active && Vec2.distance(clickPos, new Vec2(this.inputNode2.worldPosition.x, this.inputNode2.worldPosition.y)) < 2.5) {
                out.str = 'input';
                out.node = this.inputNode2;
            } else if (this.inputNode3.active && Vec2.distance(clickPos, new Vec2(this.inputNode3.worldPosition.x, this.inputNode3.worldPosition.y)) < 2.5) {
                out.str = 'input';
                out.node = this.inputNode3;
            } else if (Vec2.distance(clickPos, new Vec2(this.outputNode.worldPosition.x, this.outputNode.worldPosition.y)) < 2.5) {
                out.str = 'output';
                out.node = this.outputNode;
            } else {
                out.str = 'move';
            }
            return true;
        }
        return false;
    }

    /**from和input都是button节点，不要传错了 */
    public setInput(from: Node, input: Node): boolean {
        return true;
    }

    /**
     * 从input删除链接, 删除链接不改变节点value
     */
    public cancelConnectInput(inNode: Node) {
        if (inNode === this.inputNode1) {
            const eeno = this.inputFrom1?.getParent().getParent().getComponent(EditEmbeddingNodeBase);
            eeno.outputTo = null;
            eeno.connectLineGraphic.clear();
            this.inputFrom1 = null;
        } else if (inNode === this.inputNode2) {
            const eeno = this.inputFrom2?.getParent().getParent().getComponent(EditEmbeddingNodeBase);
            eeno.outputTo = null;
            eeno.connectLineGraphic.clear();
            this.inputFrom2 = null;
        } else if (inNode === this.inputNode3) {
            const eeno = this.inputFrom3?.getParent().getParent().getComponent(EditEmbeddingNodeBase);
            eeno.outputTo = null;
            eeno.connectLineGraphic.clear();
            this.inputFrom3 = null;
        } else {
            console.error('cancelConnectInput 节点错误');
        }
    }

    /**
     * 从output删除链接, 删除链接不改变节点value
     */
    public cancelConnectOuput(): boolean {
        if (!this.outputTo)
            return true;
        // if (!outputEENB) {
        const outputEENB = this.outputTo.getParent().getParent().getComponent(EditEmbeddingNodeBase);
        if (this.outputNode === outputEENB.inputFrom1) 
            outputEENB.inputFrom1 = null;
        else if (this.outputNode === outputEENB.inputFrom2) 
            outputEENB.inputFrom2 = null;
        else if (this.outputNode === outputEENB.inputFrom3) 
            outputEENB.inputFrom3 = null;
        else {
            console.error('cancelConnectOuput 找不到该output对应的inputfrom');
            return false;
        }
        this.outputTo = null;
        this.outputNode.getChildByName('connectLineGraph').getComponent(Graphics).clear();
        return true;
    }

 

    /**传入outputnode */
    public changeInputValue(from: Node) {
        if (from === this.inputFrom1 || from === this.inputFrom2  || from === this.inputFrom3) {
            console.log('change value finish');
            this.isInputChange = true;
        }
    }
}

export type OutInfo = {
    str: string,
    node: Node
}


