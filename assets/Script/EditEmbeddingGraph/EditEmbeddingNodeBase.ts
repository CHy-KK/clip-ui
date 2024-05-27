import { _decorator, Button, Component, director, EventHandheld, EventHandle, EventHandler, EventTouch, Graphics, Input, instantiate, Label, Node, Sprite, UITransform, Vec2, Vec3 } from 'cc';
import { EditEmbeddingNodeType, RectSize } from '../Utils/Utils';
import { EditEmbeddingGraphController } from './EditEmbeddingGraphController';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('EditEmbeddingNodeBase')
export class EditEmbeddingNodeBase extends Component {
    /**点击控制节点移动的button Node，下挂显示节点名字的Label Node */
    protected nameLabel: Node = null;

    /**用于绘制节点背景框 */
    protected backgroundGraphic: Graphics = null;

    /**用于绘制节点到另一个节点连线，启点为0,0即可 */
    protected connectLineGraphic: Graphics = null;

    protected inputNode1: Node = null;
    protected inputNode2: Node = null;

    protected EEGController: EditEmbeddingGraphController = null;
    protected _nodeType: EditEmbeddingNodeType = null;

    /**记录该节点包围盒 */
    public nodeBoundingBox: RectSize = null;

    public outputNodePos: Vec2 = null;
    public inputNodePos1: Vec2 = null;
    public inputNodePos2: Vec2 = null;
    
    /**输出值节点 */
    protected outPutNode: Node = null;

    protected onLoad(): void {
        this.EEGController = director.getScene().getChildByPath('mainUI/InnerUI/EditEmbedding').getComponent(EditEmbeddingGraphController);
        const funcNode = instantiate(this.EEGController.EditGraphNodePrefab);
        funcNode.layer = this.node.layer;
        this.node.addChild(funcNode);
        this.nameLabel = funcNode.getChildByName('nameLabel');
        this.backgroundGraphic = funcNode.getComponent(Graphics);
        this.connectLineGraphic = funcNode.getChildByPath('connectGraphButton/connectLineGraph').getComponent(Graphics);
        this.outPutNode = funcNode.getChildByName('connectGraphButton');
        this.inputNode1 = funcNode.getChildByName('inputButton1');
        this.inputNode2 = funcNode.getChildByName('inputButton2');

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

    private onMoveButtonClick = (e: EventTouch) => {
        console.log('click move button');
        const parent = this.node.parent;
        parent.removeChild(this.node);
        parent.addChild(this.node);
        console.log(this.node.worldPosition);
        console.log(e.touch.getLocation());
        console.log(e.touch.getUILocation());
        const pos = e.touch.getUILocation();
        // this.node.setWorldPosition(pos.x, pos.y, 0);
    }

    public clickQuery(clickPos: Vec2, out: OutString): boolean {
        if (clickPos.x > this.node.worldPosition.x + this.nodeBoundingBox.left && clickPos.x < this.node.worldPosition.x + this.nodeBoundingBox.right &&
        clickPos.y > this.node.worldPosition.y + this.nodeBoundingBox.bottom && clickPos.y < this.node.worldPosition.y + this.nodeBoundingBox.top) {
            out.str = 'move';
            return true;
        }
        return false;
    }
}

export type OutString = {
    str: string
}


