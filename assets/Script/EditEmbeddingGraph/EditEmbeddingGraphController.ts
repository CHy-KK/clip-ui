import { _decorator, assert, Color, Component, director, error, EventMouse, EventTouch, Graphics, Input, input, Label, Node, Prefab, SpringJoint2D, Sprite, SpriteFrame, UITransform, Vec2, Vec3 } from 'cc';
import { MainController } from '../Controller';
import { EditEmbeddingNodeOperation } from './EditEmbeddingNodeOperation';
import { EditEmbeddingNodeVoxel } from './EditEmbeddingNodeVoxel';
import { EditEmbeddingNodeBase, OutString } from './EditEmbeddingNodeBase';
const { ccclass, property } = _decorator;

const opPriority = new Map();
opPriority.set('(', -1);
opPriority.set('+', 0);
opPriority.set('-', 0);
opPriority.set('*', 1);
opPriority.set('/', 1);
opPriority.set('max', 2);
opPriority.set('min', 2);

@ccclass('EditEmbeddingGraphController')
export class EditEmbeddingGraphController extends Component {

    
    @property(Prefab)
    public readonly EditGraphNodePrefab: Prefab = null;

    /**记录编辑操作 */
    /**
     * @type number
     * @type string
     */
    private operations = []; 
    /**对应每一步operation在ui上的长度，在backspace时用来调整position */
    private operationsLength = [];
    private controller: MainController = null;
    private opStack: string[] = [];
    /**
     * @type number
     * @type string
     */
    private embStack: any[] = [];
    /**记录当前公式长度 */
    private formulaEndPos: Vec3 = new Vec3();
    private showFormulaNode: Node = null;
    private constantInputNode: Node = null;

    /**记录当前是否处于链接两个embedding node */
    private _isConnecting: boolean = false;
    /**记录链接起始点 */
    private connectFrom: Node = null;

    private isDragNode: boolean = false;
    private dragOffset: Vec2 = new Vec2();
    private draggingNode: Node = null;

    protected onEnable(): void {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    public get isConnecting() {
        return this._isConnecting;
    }

    private set isConnecting(val: boolean) {
        if (this.isConnecting === true) {
            console.error('此时已经处于链接状态');
            return;
        }
        this._isConnecting = val;
    }
    

    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.showFormulaNode = this.node.getChildByPath('showFormula/EditNode');
        this.constantInputNode = this.node.getChildByPath('constantInput/TEXT_LABEL');
        const editGraphMask = this.node.getChildByPath('showFormula/background').getComponent(Graphics);
        editGraphMask.fillColor.fromHEX('#444444');
        editGraphMask.moveTo(-275, 150);
        editGraphMask.lineTo(275, 150);
        editGraphMask.lineTo(275, -150);
        editGraphMask.lineTo(-275, -150);
        editGraphMask.lineTo(-275, 150);
        editGraphMask.fill();
    }

    private calculateOps(op: string) {
        console.log(op);
        let res;
        const emb1 = this.embStack.pop();
        const type1 = typeof emb1;
        const emb2 = this.embStack.pop();
        const type2 = typeof emb2;
        // TODO:　要确认这些数字+array是不是合法的，ts到底会不会catch相关报错，如果不行，还是要手动做类型检测
        switch(op) {
            case '+':
                try {
                    if (type1 === 'number' && type2 === 'number') 
                        res = emb1 + emb2;
                    else if (emb1.length === 128 && emb2.length === 128) {
                        res = new Array(128);
                        for (let i = 0; i < 128; i++) 
                            res[i] = emb1[i] + emb2[i];
                        console.log(res);
                    } else {
                        throw new Error('+ operation type wrong!');
                    }
                } catch(e) {
                    console.error(e);
                    return null;
                }
                break;

            case '-':
                try {
                    if (type1 === 'number' && type2 === 'number') 
                        res = emb2 - emb1;
                    else if (emb1.length === 128 && emb2.length === 128) {
                        res = new Array(128);
                        for (let i = 0; i < 128; i++) 
                            res[i] = emb2[i] - emb1[i];
                    } else {
                        throw new Error('- operation type wrong!');
                    }
                } catch(e) {
                    console.error(e);
                    return null;
                }
                break;

            case '*':
                try {
                    if (type1 === 'number') {
                        if (type2 === 'number') {
                            res = emb1 * emb2;
                        } else if (emb2.length === 128) {
                            res = new Array(128);
                            for (let i = 0; i < 128; i++) 
                                res[i] = emb2[i] * emb1;
                        }
                    } else if (type2 === 'number' && emb1.length === 128) {
                        res = new Array(128);
                        for (let i = 0; i < 128; i++) 
                            res[i] = emb1[i] * emb2;
                    } else {
                        throw new Error('* operation type wrong!');
                    }
                } catch(e) {
                    console.error(e);
                    return null;
                }
                break;

            case '/':   // 被除数emb1一定要是常数
                try {
                    if (type1 === 'number' && type2 === 'number')
                        res = emb2 / emb1;
                    else if (type1 === 'number' && emb2.length === 128){
                        res = new Array(128);
                        for (let i = 0; i < 128; i++) 
                            res[i] = emb2[i] / emb1;
                    } else {
                        throw new Error('/ operation type wrong!');
                    }
                } catch(e) {
                    console.error(e);
                    return null;
                }
                break;

            case 'max':
                try {
                    if (type1 === 'number' && type2 === 'number') 
                        res = Math.max(emb1, emb2);
                    else if (emb1.length === 128 && emb2.length === 128) {
                        res = new Array(128);
                        for (let i = 0; i < 128; i++) 
                            res[i] = Math.max(emb1[i], emb2[i]);
                    } else {
                        throw new Error('max operation type wrong!');
                    }
                } catch(e) {
                    console.error(e);
                    return null;
                }
                break;

            case 'min':
                try {
                    if (type1 === 'number' && type2 === 'number') 
                        res = Math.min(emb1, emb2);
                    else if (emb1.length === 128 && emb2.length === 128) {
                        res = new Array(128);
                        for (let i = 0; i < 128; i++) 
                            res[i] = Math.min(emb1[i], emb2[i]);
                    } else {
                        throw new Error('min operation type wrong!');
                    }
                } catch(e) {
                    console.error(e);
                    return null;
                }
                break;
        }
        console.log(op + ' finished, res:');
        console.log(res);
        return res;
    }

    private analyseEditOp() {
        this.opStack = [];
        this.embStack = [];
        for (let i = 0; i < this.operations.length; i++) {
            const sign = this.operations[i];
            console.log('for ' + sign);
            switch(sign) {
                case '+':
                case '-':
                case '*': 
                case '/': {
                    while (this.opStack.length && opPriority.get(sign) <= opPriority.get(this.opStack[this.opStack.length - 1])) {
                        const res = this.calculateOps(this.opStack.pop());
                        if (!res)
                            return;
                        this.embStack.push(res);
                    }
                    this.opStack.push(sign);
                    break;
                }

                case '(':
                    this.opStack.push('(');
                    break;

                case ')':
                    let rightOp = this.opStack.pop();
                    while (rightOp !== '(') {
                        const res = this.calculateOps(rightOp);
                        if (!res)
                            return;
                        this.embStack.push(res);
                        console.log('emb push');
                        rightOp = this.opStack.pop();
                    }
                    break;

                case 'max':
                case 'min': {
                    this.opStack.push(sign);
                    break;
                }
                
                default: {
                    // 在id前面加上字符串id以区分数字id和数字！
                    const optype = typeof sign;
                    if (optype === 'number' || optype === 'object') {
                        this.embStack.push(sign);
                    } else {
                        console.log(optype);
                        console.error('错误的操作符号!!');
                        return;
                    }
                    break;
                }
            }
        }

        const res = this.embStack[0];
        console.log(res);
        if (this.opStack.length > 0 || this.embStack.length === 0 || this.embStack.length > 1 || res.length !== 128) {
            
            console.error('计算式错误!');
            console.error(this.opStack);
            console.error(this.embStack);
            return null;
        }
        return res;
    }

    public clearEdit()  {
        this.opStack = [];
        this.embStack = [];
        this.operations = [];
        this.node.getChildByName('showFormula').destroyAllChildren();
        this.formulaEndPos = new Vec3();
    }

    public calculateEdit() {
        this.operations.unshift('(');
        this.operations.push(')');
        console.log("calculating operations:");
        console.log(this.operations);
        const res = this.analyseEditOp();
        this.operations.shift();
        this.operations.pop();
        if (res)
            this.controller.drawDetailInfoNode(res);
    }

    public addSnapShotToEdit() {
        const curId = this.controller.curSelectVoxelId;
        if (this.controller.isExistHistoryList(curId) === -1) {
            return;
        }
        const curEmb: number[] = this.controller.getVoxelEmbeddingById(curId);
        const curSp: SpriteFrame = this.controller.getVoxelSnapShotById(curId);
        this.operations.push(curEmb);

        const voxelNode = new Node();
        voxelNode.layer = this.node.layer;
        const eenv = voxelNode.addComponent(EditEmbeddingNodeVoxel);
        eenv.voxelSnapShot = curSp;

        this.showFormulaNode.addChild(voxelNode);
        
        // this.operationsLength.push(55);
        // this.formulaEndPos.add(new Vec3(55, 0, 0));
        // this.showFormulaNode.setPosition(Vec3.multiplyScalar(new Vec3, this.formulaEndPos, -0.5).add(new Vec3(0, 100, 0)));
    }

    public addConstantToEdit() {
        const inputConstant = this.constantInputNode.getComponent(Label).string;
        const num = parseFloat(inputConstant);
        console.log(num);
        if (!isNaN(num)) {
            
            const numNode = new Node();
            const numLabel = numNode.addComponent(Label);
            numLabel.string = inputConstant;
            numLabel.color.fromHEX('#000000');
            numLabel.fontSize = 15;
            numLabel.lineHeight = 15;
            numNode.getComponent(UITransform).anchorPoint.set(0, 0.5);
            numNode.layer = this.node.layer;
            this.showFormulaNode.addChild(numNode);
            numNode.setPosition(this.formulaEndPos);

            // this.operations.push(num);
            // this.operationsLength.push(10 * inputConstant.length);
            // this.formulaEndPos.add(new Vec3(10 * inputConstant.length, 0, 0));
            // this.showFormulaNode.setPosition(Vec3.multiplyScalar(new Vec3, this.formulaEndPos, -0.5).add(new Vec3(0, 100, 0)));
        }
    }

    public onOperationButtonClick(e: Event, op: string) {
        console.log(op);
        const opNode = new Node();
        const opLabel = opNode.addComponent(Label);
        opLabel.string = op;
        opLabel.color.fromHEX('#000000');
        opLabel.fontSize = 15;
        opLabel.lineHeight = 15;
        opNode.getComponent(UITransform).anchorPoint.set(0, 0.5);
        opNode.layer = this.node.layer;
        this.showFormulaNode.addChild(opNode);
        opNode.setPosition(this.formulaEndPos);

        const EENO = new Node();
        EENO.addComponent(EditEmbeddingNodeOperation);
        this.node.addChild(EENO);

        if (op === 'max' || op === 'min') {
            this.operations.push(op);
            this.operationsLength.push(30);
            this.formulaEndPos.add(new Vec3(30, 0, 0));
        } else if (op === ',') {
            this.operationsLength.push(15);
            this.formulaEndPos.add(new Vec3(15, 0, 0));
        } else {
            this.operations.push(op);
            this.operationsLength.push(15);
            this.formulaEndPos.add(new Vec3(15, 0, 0));
        }
        // this.showFormulaNode.setPosition(Vec3.multiplyScalar(new Vec3, this.formulaEndPos, -0.5).add(new Vec3(0, 100, 0)));
        // console.log(this.operations);
    }

    public onBackSpaceButtonClick() {
        // this.operations.pop();
        // this.showFormulaNode.children.pop();
        // const offset = this.operationsLength.pop();
        // this.formulaEndPos.subtract(new Vec3(offset, 0, 0));
        // this.showFormulaNode.setPosition(Vec3.multiplyScalar(new Vec3, this.formulaEndPos, -0.5).add(new Vec3(0, 100, 0)));
    }

    public connectEditEmbedding (from: Node) {
        this.isConnecting = true;
        this.connectFrom = from;
    }

    private onMouseDown(e: EventMouse) {
        console.log('click number' + e.getButton());
        if (e.getButton() === EventMouse.BUTTON_RIGHT) {
            // const sp = this.node.getChildByName('LeftRightClickVisualize').getComponent(Sprite);
            // sp.color = new Color(0, 255, 0);
            console.log('right');
            this.isConnecting = false;
            this.connectFrom = null;
        } else if (e.getButton() === EventMouse.BUTTON_LEFT) {
            // const sp = this.node.getChildByName('LeftRightClickVisualize').getComponent(Sprite)
            // sp.color = new Color(0, 0, 255);
            const childList = this.showFormulaNode.children;
            this.draggingNode = null;
            for (let i = childList.length - 1; i >= 0; i--) {
                // getcomponent会查询派生
                const een = childList[i].getComponent(EditEmbeddingNodeBase);
                let clickType: OutString = { str: '' };
                if (een?.clickQuery(e.getUILocation(), clickType)) {
                    console.log(clickType);
                    if (clickType.str === 'output') {
                        this.isConnecting = true;   
                    } else if (clickType.str === 'move') {
                        this.isDragNode = true;
                        Vec2.subtract(this.dragOffset, new Vec2(childList[i].worldPosition.x, childList[i].worldPosition.y), e.getUILocation());
                        this.draggingNode = childList[i];
                        this.showFormulaNode.removeChild(this.draggingNode);
                        this.showFormulaNode.addChild(this.draggingNode);
                    }
                    break;
                }
            }
        }
    }

    private onMouseMove(e: EventMouse) {
        if (this.isConnecting) {
            const g = this.connectFrom.getComponent(Graphics);
            g.clear();
            g.strokeColor.fromHEX('#333333');
            g.lineWidth = 2;
            g.moveTo(0, 0);
            g.lineTo(10, 10);
            g.stroke();
        } else if (this.isDragNode) {
            const newPos = Vec2.add(new Vec2(), e.getUILocation(), this.dragOffset);
            this.draggingNode.setWorldPosition(newPos.x, newPos.y, 0);
        }
    }

    private onMouseUp(e: EventMouse) {
        if (e.getButton() === EventMouse.BUTTON_LEFT) {
            // const sp = this.node.getChildByName('LeftRightClickVisualize').getComponent(Sprite)
            // sp.color = new Color(0, 0, 255);
            const childList = this.showFormulaNode.children;
            for (let i = childList.length - 1; i >= 0; i--) {
                // getcomponent会查询派生
                const een = childList[i].getComponent(EditEmbeddingNodeBase);
                let clickType: OutString = { str: '' };
                if (een.clickQuery(e.getUILocation(), clickType)) {
                    // 如果鼠标起来的时候在input button上，且已经点击过一个节点的output节点，那么
                    if (clickType.str === 'input' && this.isConnecting) {

                    }
                    break;
                }
            }
        }
        this.isDragNode = false;
        this.isConnecting = false;
        this.draggingNode = null;
    }

}



/**
 * 
 * max (a, c + b * d) * 3
 * *****************************                                                                *****************************
 * a c b d                                                            ) * 3                                       * + ( max |
 * *****************************                                                                *****************************
 * a b 3 * + c d max e + 2 * +
 * 
 */