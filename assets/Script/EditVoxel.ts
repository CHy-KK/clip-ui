import { _decorator, Camera, Color, color, Component, director, EventKeyboard, EventTouch, Graphics, input, Input, KeyCode, Material, MeshRenderer, Node, quat, Quat, RenderableComponent, Vec2, Vec3 } from 'cc';
import { MainController } from './Controller';
import { EditState, isPosInQuad, RectSize } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('EditVoxel')
export class EditVoxel extends Component {
    
    @property(Node)
    public readonly SelectGraphic: Node = null;

    @property(Camera)
    public readonly curCamera: Camera = null;

    @property(Material)
    public readonly defaultVoxelMat: Material = null;

    private selectGraph: Graphics = null;
    private controller: MainController = null;
    private editState: EditState = 0;
    // private isRotating: boolean = false;+
    private isMove: boolean = false;
    private clickStartPos: Vec2 = new Vec2();
    private clickUIPos: Vec2 = new Vec2();
    private selectMovingUIPos: Vec2 = new Vec2();
    private selectIdxSet: Set<number> = new Set();

    onEnable () {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.onkeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onkeyUp, this);
    }

    onDisable () {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.onkeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onkeyUp, this);
    }
    
    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.selectGraph = this.SelectGraphic.getComponent(Graphics);
        this.selectGraph.lineWidth = 1;
        this.selectGraph.strokeColor.fromHEX('0099aa');
        this.selectGraph.fillColor = new Color(0, 200, 200, 80);
    }

    update(deltaTime: number) {
        if (this.isMove && this.controller.isOutUI() && (this.editState === EditState.MultiSelect)) {
            console.log('draw line');
            this.selectGraph.clear();
            this.selectGraph.moveTo(this.clickUIPos.x, this.clickUIPos.y);
            this.selectGraph.lineTo(this.selectMovingUIPos.x, this.clickUIPos.y);
            this.selectGraph.lineTo(this.selectMovingUIPos.x, this.selectMovingUIPos.y);
            this.selectGraph.lineTo(this.clickUIPos.x, this.selectMovingUIPos.y);
            this.selectGraph.lineTo(this.clickUIPos.x, this.clickUIPos.y);
            this.selectGraph.stroke();
            this.selectGraph.fill();
        }
    }

    private onTouchStart(e: EventTouch) {
        if (this.controller.isOutUI()) {
            const pos: Vec2 = e.touch.getUILocation();
            this.clickUIPos = pos;
            this.clickStartPos = e.touch.getLocation();
            // TODO：射线做个判断，如果selectIdxSet不为空&&editstate为none&没有击中被选中的体素才清空selectIdxSet；如果命中被选中的体素，将editstate改为Moving，表示拖动当前选中的体素
            if (this.selectIdxSet.size > 0 && this.editState === EditState.None) {
                const childList = this.node.children;
                this.selectIdxSet.forEach(value => {

                    const mr = childList[value].getComponent(MeshRenderer);
                    mr.setMaterialInstance(this.defaultVoxelMat, 0);
                })
                this.selectIdxSet.clear();  
            }
        }
    }

    private onTouchMove(e: EventTouch) {
        if (this.controller.isOutUI()) {
            const pos: Vec2 = e.touch.getUILocation();
            e.touch.getLocation
            if (!this.isMove)
                this.isMove = true;
            if (!this.controller)
                this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
            console.log('edit state' + this.editState);
            switch (this.editState) {
                case EditState.MultiSelect:
                    this.selectMovingUIPos = pos;
                    console.log('slect moving' + this.selectMovingUIPos);
                    break;

                case EditState.Rotate:
                    const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                    this.node.rotate(Quat.fromEuler(new Quat(), -deltaMove.y, deltaMove.x, 0), 1);
                    console.log('rotation');
                    break;
            }
        }
    }

    private onTouchEnd(e: EventTouch) {
        console.log('touch end');
        if (this.controller.isOutUI()) {
            if (this.isMove) {
                switch (this.editState) {
                    case EditState.MultiSelect:
                        const clickEndPos = e.touch.getLocation();
                        const selectQuad: RectSize = {
                            left: Math.min(this.clickStartPos.x, clickEndPos.x),
                            right: Math.max(this.clickStartPos.x, clickEndPos.x),
                            bottom: Math.min(this.clickStartPos.y, clickEndPos.y),
                            top: Math.max(this.clickStartPos.y, clickEndPos.y),
                        }
                        console.log(selectQuad);
                        const childList = this.node.children;
                        let matInstance = new Material();
                        matInstance.initialize({
                            effectName: 'builtin-standard',
                            defines: {
                                USE_INSTANCING: true
                            }
                        });
                        matInstance.setProperty('mainColor', new Color(255, 255, 0, 255));
                        for (let i = 0; i < childList.length; i++) {
                            if (!childList[i].active) 
                                break;
                            const ssPos = this.curCamera.worldToScreen(childList[i].worldPosition);
                            if (isPosInQuad(new Vec2(ssPos.x, ssPos.y), selectQuad)) {
                                if (!this.selectIdxSet.has(i))
                                    this.selectIdxSet.add(i);
                                const mr = (childList[i].getComponent(MeshRenderer) as RenderableComponent);
                                console.log('in');
                                mr.setMaterialInstance(matInstance, 0);
                            }
                        }
                }
    
                this.isMove = false;
                this.selectGraph.clear();
            } else {
                // TODO: 处理单次点击但没有发生移动的情况
                
            }
            

        }
    }


    private onkeyDown(key: EventKeyboard) {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        
        if (this.controller.isOutUI() && this.editState === EditState.None) {
            switch(key.keyCode) {
                case KeyCode.ALT_LEFT:
                    this.editState = EditState.Rotate;
                    break;
                case KeyCode.CTRL_LEFT:
                    this.editState = EditState.MultiSelect;
                    break;
                case KeyCode.KEY_C:
                    console.log('copy');
                    // TODO: 将选中的体素复制一份加入该节点的childlist，还是那套规则，如果有空闲的就用active，没有才initialize
                    break;
                case KeyCode.DELETE:
                    break;


            }
        } 

    }

    private onkeyUp(key: EventKeyboard) {
        console.log('editstate置零');
        this.editState = EditState.None;
    }
}


