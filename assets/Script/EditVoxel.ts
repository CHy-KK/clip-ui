import { _decorator, Camera, Color, color, Component, director, EventKeyboard, EventMouse, EventTouch, geometry, Graphics, input, Input, KeyCode, Material, MeshRenderer, Node, NodeSpace, PhysicsSystem, quat, Quat, RenderableComponent, Vec2, Vec3, view } from 'cc';
import { MainController } from './Controller';
import { angle2radian, EditState, isPosInQuad, RectSize, voxelScale } from './Utils/Utils';
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
    private selectZ: number = 0;
    private castVoxelPos: Vec3 = new Vec3();
    private viewHalfWidth: number;
    private viewHalfHeight: number;
    private wsHalfWidth: number;
    private wsHalfHeight: number;

    onEnable () {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.onkeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onkeyUp, this);
        input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }

    onDisable () {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.onkeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onkeyUp, this);
        input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }
    
    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.selectGraph = this.SelectGraphic.getComponent(Graphics);
        this.selectGraph.lineWidth = 1;
        this.selectGraph.strokeColor.fromHEX('0099aa');
        this.selectGraph.fillColor = new Color(0, 200, 200, 80);
        this.calScreenSizeinWorldSpace();

        // 对应鼠标事件的getLocation()
        this.viewHalfWidth = view.getViewportRect().width * 0.5;
        this.viewHalfHeight = view.getViewportRect().height * 0.5;
    }

    // TODO: 是否需要一个操作记录栈，毕竟如果误操作导致体素暴增后就不好删除了

    update(deltaTime: number) {
        if (this.isMove && this.controller.isOutUI() && (this.editState === EditState.MultiSelect)) {
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
                const screenRay = new geometry.Ray();
                this.curCamera.screenPointToRay(e.getLocationX(), e.getLocationY(), screenRay);
      
                const rayCastRes: boolean = PhysicsSystem.instance.raycastClosest(screenRay);
                let castSelect: boolean = false;
                const childList = this.node.children;
                if (rayCastRes) {
                    const res = PhysicsSystem.instance.raycastClosestResult.collider.node;
                    const resId = res.uuid;
                    this.selectIdxSet.forEach(value => {
                        if (childList[value].uuid === resId) {
                            castSelect = true;
                            this.editState = EditState.Selecting;
                            this.selectZ = res.worldPosition.z; 
                            this.castVoxelPos = res.worldPosition;
                            return;
                        }
                    });
                } 
                if (!(rayCastRes && castSelect)) {
                    // 恢复未选中状态
                    this.selectIdxSet.forEach(value => {
                        const mr = childList[value].getComponent(MeshRenderer);
                        mr.setMaterialInstance(this.defaultVoxelMat, 0);
                    })
                    this.selectIdxSet.clear();  
                }
            }
        }
    } 
    
    private calScreenSizeinWorldSpace() {
        const halfFov = this.curCamera.fov * 0.5;
        const n = this.curCamera.near;
        this.wsHalfHeight = n * Math.tan(angle2radian(halfFov));
        // 计算3D空间射线投射一定要用viewportrect的宽高！！！！！！！！！！！
        const ratio = view.getViewportRect().width / view.getViewportRect().height;
        this.wsHalfWidth = ratio * this.wsHalfHeight;
        //  TODO：这里计算屏幕坐标没有计入camera的旋转，后面如果有需求可以补上
       
    }

    private onTouchMove(e: EventTouch) {
        if (this.controller.isOutUI()) {
            
            const pos: Vec2 = e.touch.getUILocation();
            const posSS: Vec2 = e.touch.getLocation();

            e.touch.getLocation
            if (!this.isMove)
                this.isMove = true;
            if (!this.controller)
                this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
            switch (this.editState) {
                case EditState.MultiSelect:
                    this.selectMovingUIPos = pos;
                    break;

                case EditState.Rotate:
                    const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                    this.node.rotate(Quat.fromEuler(new Quat(), -deltaMove.y, deltaMove.x, 0), 1);
                    break;

                case EditState.Selecting:
                    // TODO: 体素跟随移动，要改变的是worldposition，然后在本地position层级将其还原到scale变换之前的坐标然后向下取整
                    // worldposition位移方式只给x、y方向上的
                    const clickX = this.wsHalfWidth * (posSS.x - this.viewHalfWidth) / this.viewHalfWidth;
                    const clickY = this.wsHalfHeight * (posSS.y - this.viewHalfHeight) / this.viewHalfHeight;

                    // 利用等腰三角形计算体素需要被移动到的位置的相机距离
                    const clickDis2Camera = Math.sqrt(clickX * clickX + clickY * clickY + this.curCamera.near * this.curCamera.near);
                    const targetDis2Camera = clickDis2Camera * Math.abs(this.selectZ - this.curCamera.node.position.z) / this.curCamera.near;
         
                    let target: Vec3 = new Vec3();
                    const myRay = new Vec3(clickX, clickY, -1).normalize();
                    Vec3.multiplyScalar(target, myRay, targetDis2Camera);
                    const offset: Vec3 = Vec3.subtract(new Vec3(), target, this.castVoxelPos);
                    const childList = this.node.children;
                    this.selectIdxSet.forEach(value => {
                        childList[value].setWorldPosition(Vec3.add(new Vec3(), childList[value].worldPosition, offset));
                    });
                    this.castVoxelPos = target;
                    // TODO: 体素旋转，只允许90度旋转
            }
        }
    }

    private onTouchEnd(e: EventTouch) {
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
                                mr.setMaterialInstance(matInstance, 0);
                            }
                        }
                    case EditState.Selecting:   // 选中状态且移动，表示在拖动选中的体素，
                        this.editState = EditState.None;
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
                    const childList = this.node.children;
                    this.selectIdxSet.forEach(value => {
                        if (this.controller.activeEditVoxelNum === childList.length) {
                            const ev = this.controller.createVoxel(voxelScale.Edit);
                            this.node.addChild(ev);
                        } else if (this.controller.activeEditVoxelNum > childList.length) {
                            console.error('EDIT记录的体素数量超过实际子节点体素数量！！');
                        }
                        const ev = childList[this.controller.activeEditVoxelNum++];
                        ev.position = childList[value].position;
                        ev.active = true;
                        childList[value].translate(new Vec3(0, 0, 0.01), NodeSpace.WORLD);
                    });
                    let i = this.controller.activeEditVoxelNum;
                    while (i < childList.length && childList[i].active) {
                        childList[i++].active = false;
                    }
                    break;
                case KeyCode.DELETE:
                    break;
                case KeyCode.KEY_A:
                    // TODO: 在一个体素的一个方向上增加体素
                    break;
                case KeyCode.KEY_D:
                    // TODO: 框选删除体素
                    break;

            }
        } 

    }

    private onkeyUp(key: EventKeyboard) {
        this.editState = EditState.None;
    }

    private onMouseWheel(e: EventMouse) {
        if (this.controller.isOutUI()) {
            if (this.editState === EditState.None) {
                const scroll = e.getScrollY();
                const fovAngle = this.curCamera.fov - scroll / 500;
                this.curCamera.fov = Math.min(75, Math.max(15, fovAngle));
                this.calScreenSizeinWorldSpace();
            }
        }
    }
}


