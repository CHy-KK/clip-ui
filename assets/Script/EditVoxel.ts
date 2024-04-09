import { _decorator, Camera, Color, color, Component, director, EventKeyboard, EventMouse, EventTouch, geometry, Graphics, input, Input, KeyCode, Mat4, Material, memop, MeshRenderer, Node, NodeSpace, PhysicsSystem, quat, Quat, RenderableComponent, Vec2, Vec3, Vec4, view } from 'cc';
import { MainController } from './Controller';
import { angle2radian, cubeSize, EditState, isPosInQuad, RectSize, voxelScale } from './Utils/Utils';
const { ccclass, property } = _decorator;

const voxelPosLimit = 3.2;

type SelectInfo = {
    selectCubeSize: cubeSize,
    selectMovingUIPos: Vec2,
    selectIdxSet: Set<number>,
    selectZ: number
}

class VoxelData {
    private data: Array<boolean> = new Array();

    constructor() {
        this.data = new Array(64 * 64 * 64);
    }

    public getData(x: number, y: number, z: number) {
        return this.data[x * 4096 + y * 64 + z];
    }

    public setData(x: number, y: number, z: number, val: boolean) {
        this.data[x * 4096 + y * 64 + z] = val;
    }

    public clear() {
        for (let i = 0; i < this.data.length; i++)
            this.data[i] = false;
    }
}


@ccclass('EditVoxel')
export class EditVoxel extends Component {
    
    @property(Node)
    public readonly SelectGraphic: Node = null;

    @property(Camera)
    public readonly curCamera: Camera = null;

    @property(Material)
    public readonly defaultVoxelMat: Material = null;

    private editState: EditState = 0;
    private voxelData: VoxelData = new VoxelData();
    private activeEditVoxelNum: number  // 记录当前处于active的体素数量
    private selectGraph: Graphics = null;
    private controller: MainController = null;
    private isMove: boolean = false;
    private clickStartPos: Vec2 = new Vec2();
    private clickUIPos: Vec2 = new Vec2();

    // private selectCubeSize: cubeSize = {
    //     left: 10000,
    //     right: -10000, 
    //     bottom: 10000, 
    //     top: -10000,
    //     back: 10000,
    //     front: -10000
    // }
    // private selectMovingUIPos: Vec2 = new Vec2();
    // private selectIdxSet: Set<number> = new Set();
    // private selectZ: number = 0;
    private selectInfo: SelectInfo = {
        selectCubeSize: {
            left: 10000,
            right: -10000, 
            bottom: 10000, 
            top: -10000,
            back: 10000,
            front: -10000
        },
        selectMovingUIPos: new Vec2(),
        selectIdxSet: new Set(),
        selectZ: 0
    }

    private castVoxelPos: Vec3 = new Vec3();
    private castVoxelFace: Vec3 = new Vec3();
    private castFaceWorld: Vec3 = new Vec3();
    private addRecord: number = 0;  
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
    // TODO: 注意，在任何增删体素的修改之后（也包括上面的撤销）需要修改this.activeEditVoxelNum！！
    // TODO: 对所有修改了体素位置、增删的地方，改动需要同步this.voxelData
    // TODO: 所有修改都需要确实是否在安全范围内：-voxelPosLimit~voxelPosLimit

    update(deltaTime: number) { 
        if (this.isMove && this.controller.isOutUI() && (this.editState === EditState.MultiSelect || this.editState === EditState.MultiDelete)) {
            this.selectGraph.clear();
            this.selectGraph.moveTo(this.clickUIPos.x, this.clickUIPos.y);
            this.selectGraph.lineTo(this.selectInfo.selectMovingUIPos.x, this.clickUIPos.y);
            this.selectGraph.lineTo(this.selectInfo.selectMovingUIPos.x, this.selectInfo.selectMovingUIPos.y);
            this.selectGraph.lineTo(this.clickUIPos.x, this.selectInfo.selectMovingUIPos.y);
            this.selectGraph.lineTo(this.clickUIPos.x, this.clickUIPos.y);
            this.selectGraph.stroke();
            this.selectGraph.fill();
        }
    }

    public async onDrawEditVoxel(vid: string) {
        const voxelData = this.controller.getRawVoxelData(vid);
        this.voxelData.clear();
        for (let i = 0; i < voxelData.length; i++) {
            this.voxelData.setData(voxelData[i].x, voxelData[i].y, voxelData[i].z, true);
        }
        const childList = this.node.children;
        let i = 0;
        for (; i < voxelData.length; i++) {
            if (i === childList.length) {
                const ev = this.controller.createVoxel(voxelScale.Edit);
                this.node.addChild(ev);
                // this.voxelList.Edit.push(ev);
            } else if (i > childList.length) {
                console.error('EDIT记录的体素数量超过实际子节点体素数量！！');
            }
            const ev = childList[i];
            Vec3.multiplyScalar(ev.position, voxelData[i], voxelScale.Edit);
            ev.active = true;
        }
        this.activeEditVoxelNum = i;
        while (i < childList.length && childList[i].active) {
            childList[i++].active = false;
        }
    }

    private onTouchStart(e: EventTouch) {
        if (this.controller.isOutUI()) {
            const pos: Vec2 = e.touch.getUILocation();
            this.clickUIPos = pos;
            this.clickStartPos = e.touch.getLocation();

            if (this.selectInfo.selectIdxSet.size > 0 && this.editState === EditState.None) {
                const screenRay = new geometry.Ray();
                this.curCamera.screenPointToRay(e.getLocationX(), e.getLocationY(), screenRay);

                const rayCastRes: boolean = PhysicsSystem.instance.raycastClosest(screenRay);
                let castSelect: boolean = false;
                const childList = this.node.children;
                if (rayCastRes) {
                    const res = PhysicsSystem.instance.raycastClosestResult.collider.node;
                    const resId = res.uuid;
                    this.selectInfo.selectIdxSet.forEach(value => {
                        if (childList[value].uuid === resId) {
                            castSelect = true;
                            this.editState = EditState.Selecting;
                            this.selectInfo.selectZ = res.worldPosition.z; 
                            this.castVoxelPos = res.worldPosition;
                            // 计算本次点击是在体素的哪个面
                            this.node.inverseTransformPoint(this.castVoxelFace, PhysicsSystem.instance.raycastClosestResult.hitPoint);
                            this.castVoxelFace.subtract(res.position);
                            Vec3.subtract(this.castFaceWorld, PhysicsSystem.instance.raycastClosestResult.hitPoint,  res.worldPosition);
                            // 计算本地坐标系点击朝向
                            if (Math.abs(this.castVoxelFace.x) <= Math.abs(this.castVoxelFace.y)) {
                                this.castVoxelFace.x = 0;
                                if (Math.abs(this.castVoxelFace.y) <=  Math.abs(this.castVoxelFace.z)) {
                                    this.castVoxelFace.y = 0;
                                    this.castVoxelFace.z /= Math.abs(this.castVoxelFace.z);
                                } else {
                                    this.castVoxelFace.z = 0;
                                    this.castVoxelFace.y /= Math.abs(this.castVoxelFace.y);
                                }
                            } else {
                                this.castVoxelFace.y = 0;
                                if (Math.abs(this.castVoxelFace.x) <=  Math.abs(this.castVoxelFace.z)) {
                                    this.castVoxelFace.x = 0;
                                    this.castVoxelFace.z /= Math.abs(this.castVoxelFace.z);
                                } else {
                                    this.castVoxelFace.z = 0;
                                    this.castVoxelFace.x /= Math.abs(this.castVoxelFace.x);
                                }
                            }

                            // 计算世界坐标系点击朝向（影响鼠标拉伸延展）
                            if (Math.abs(this.castFaceWorld.x) >= Math.abs(this.castFaceWorld.y)) {
                                this.castFaceWorld.y = 0;
                                this.castFaceWorld.x = 1;
                                // this.castFaceWorld.x /= Math.abs(this.castFaceWorld.x);
                            } else {
                                this.castFaceWorld.x = 0;
                                this.castFaceWorld.y = 1;
                                // this.castFaceWorld.y /= Math.abs(this.castFaceWorld.y);
                            }
                            return;
                        }
                    });
                } 
                if (!(rayCastRes && castSelect)) {
                    // 恢复未选中状态
                    this.selectInfo.selectIdxSet.forEach(value => {
                        const mr = childList[value].getComponent(MeshRenderer);
                        mr.setMaterialInstance(this.defaultVoxelMat, 0);
                    });
                    this.selectInfo.selectIdxSet.clear();  
                    this.selectInfo.selectCubeSize = {
                        left: 10000,
                        right: -10000, 
                        bottom: 10000, 
                        top: -10000,
                        back: 10000,
                        front: -10000
                    }
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

            if (!this.isMove)
                this.isMove = true;
            if (!this.controller)
                this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
            switch (this.editState) {
                case EditState.MultiDelete:
                case EditState.MultiSelect:
                    this.selectInfo.selectMovingUIPos = pos;
                    break;

                case EditState.Rotate:
                    const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                    this.node.rotate(Quat.fromEuler(new Quat(), -deltaMove.y, deltaMove.x, 0), 1);
                    break;

                case EditState.Selecting: {
                    const clickX = this.wsHalfWidth * (posSS.x - this.viewHalfWidth) / this.viewHalfWidth;
                    const clickY = this.wsHalfHeight * (posSS.y - this.viewHalfHeight) / this.viewHalfHeight;

                    // 利用等腰三角形计算体素需要被移动到的位置的相机距离
                    const clickDis2Camera = Math.sqrt(clickX * clickX + clickY * clickY + this.curCamera.near * this.curCamera.near);
                    const targetDis2Camera = clickDis2Camera * Math.abs(this.selectInfo.selectZ - this.curCamera.node.position.z) / this.curCamera.near;
         
                    let target: Vec3 = new Vec3();
                    const myRay = new Vec3(clickX, clickY, -1).normalize();
                    Vec3.multiplyScalar(target, myRay, targetDis2Camera);
                    // 判断本次移动是否会造成超出范围
                    let localTarget = this.node.inverseTransformPoint(new Vec3(), target);
                    const localCastPos = this.node.inverseTransformPoint(new Vec3(), this.castVoxelPos);
                    let localOffset = Vec3.subtract(new Vec3(), localTarget, localCastPos);
                    localOffset.x = Math.max(localOffset.x, -voxelPosLimit - this.selectInfo.selectCubeSize.left);
                    localOffset.x = Math.min(localOffset.x, voxelPosLimit - this.selectInfo.selectCubeSize.right);
                    localOffset.y = Math.max(localOffset.y, -voxelPosLimit - this.selectInfo.selectCubeSize.bottom);
                    localOffset.y = Math.min(localOffset.y, voxelPosLimit - this.selectInfo.selectCubeSize.top);
                    localOffset.z = Math.max(localOffset.z, -voxelPosLimit - this.selectInfo.selectCubeSize.back);
                    localOffset.z = Math.min(localOffset.z, voxelPosLimit - this.selectInfo.selectCubeSize.front);

                    this.selectInfo.selectCubeSize.left += localOffset.x;
                    this.selectInfo.selectCubeSize.right += localOffset.x;
                    this.selectInfo.selectCubeSize.bottom += localOffset.y;
                    this.selectInfo.selectCubeSize.top += localOffset.y;
                    this.selectInfo.selectCubeSize.front += localOffset.z;
                    this.selectInfo.selectCubeSize.back += localOffset.z;

                    Vec3.add(localTarget, localOffset, localCastPos);
                    
                    const targetVec4 = Vec4.transformAffine(new Vec4(), new Vec4(localTarget.x, localTarget.y, localTarget.z, 1), this.node.getWorldMatrix()); 

                    target.x = targetVec4.x;
                    target.y = targetVec4.y;
                    target.z = targetVec4.z;

                    const offset: Vec3 = Vec3.subtract(new Vec3(), target, this.castVoxelPos);
                    const childList = this.node.children;
                    this.selectInfo.selectIdxSet.forEach(value => {
                        childList[value].setWorldPosition(Vec3.add(new Vec3(), childList[value].worldPosition, offset));
                    });
                    this.castVoxelPos = target;
                    break;
                }
                    
                case EditState.DirectionalAdd: {    
                    // TODO: 根据addRecord以及addDir来判断增删体素，如果addDir和addRecord异号，
                    // 说明要取消新增的体素，如果反向并超过说明不仅要取消还要到另一边新增
                    // 记得修改this.activeEditVoxelNum
                    // 要根据voxeldata中的记录看新增的体素是否有覆盖原来就有的体素
                    // 新增体素范围不能超过voxelPosLimit
                    // 同时记得更新selectCubeSize
                    const addDir = Vec2.dot(e.touch.getDelta(), new Vec2(this.castFaceWorld.x, this.castFaceWorld.y));
                    const addNum = Math.abs(addDir);
                    for (let i = 0; i < addNum; i++) {
                        
                    }
                    break;
                }
                // TODO: 体素旋转，只允许90度旋转
            }
        }
    }

    private onTouchEnd(e: EventTouch) {
        if (this.controller.isOutUI()) {
            const clickEndPos = e.touch.getLocation();
            const childList = this.node.children;
            if (this.isMove) {
                switch (this.editState) {
                    case EditState.MultiSelect:
                        const selectQuad: RectSize = {
                            left: Math.min(this.clickStartPos.x, clickEndPos.x),
                            right: Math.max(this.clickStartPos.x, clickEndPos.x),
                            bottom: Math.min(this.clickStartPos.y, clickEndPos.y),
                            top: Math.max(this.clickStartPos.y, clickEndPos.y),
                        }
                        let matInstance = new Material();
                        matInstance.initialize({
                            effectName: 'builtin-standard',
                            defines: {
                                USE_INSTANCING: true
                            }
                        });
                        matInstance.setProperty('mainColor', new Color(255, 255, 0, 255));
                        for (let i = 0; i < this.activeEditVoxelNum; i++) {
                            const ssPos = this.curCamera.worldToScreen(childList[i].worldPosition);
                            if (isPosInQuad(new Vec2(ssPos.x, ssPos.y), selectQuad)) {
                                if (!this.selectInfo.selectIdxSet.has(i)) {
                                    this.selectInfo.selectIdxSet.add(i);
                                    const mr = (childList[i].getComponent(MeshRenderer) as RenderableComponent);
                                    mr.setMaterialInstance(matInstance, 0);
                                    const pos = childList[i].position;
                                    this.selectInfo.selectCubeSize.left = Math.min(this.selectInfo.selectCubeSize.left, pos.x);
                                    this.selectInfo.selectCubeSize.right = Math.max(this.selectInfo.selectCubeSize.right, pos.x);
                                    this.selectInfo.selectCubeSize.bottom = Math.min(this.selectInfo.selectCubeSize.bottom, pos.y);
                                    this.selectInfo.selectCubeSize.top = Math.max(this.selectInfo.selectCubeSize.top, pos.y);
                                    this.selectInfo.selectCubeSize.back = Math.min(this.selectInfo.selectCubeSize.back, pos.z);
                                    this.selectInfo.selectCubeSize.front = Math.max(this.selectInfo.selectCubeSize.front, pos.z);
                                }
                            }
                        }
                        break;
                    case EditState.MultiDelete:
                        // const clickEndPos = e.touch.getLocation();
                        const selectQuadD: RectSize = {
                            left: Math.min(this.clickStartPos.x, clickEndPos.x),
                            right: Math.max(this.clickStartPos.x, clickEndPos.x),
                            bottom: Math.min(this.clickStartPos.y, clickEndPos.y),
                            top: Math.max(this.clickStartPos.y, clickEndPos.y),
                        }
                        for (let i = 0; i < this.activeEditVoxelNum; i++) {
                            const ssPos = this.curCamera.worldToScreen(childList[i].worldPosition);
                            if (isPosInQuad(new Vec2(ssPos.x, ssPos.y), selectQuadD)) {
                                if (this.selectInfo.selectIdxSet.has(i)) {
                                    this.selectInfo.selectIdxSet.delete(i);
                                    const mr = (childList[i].getComponent(MeshRenderer) as RenderableComponent);
                                    mr.setMaterialInstance(this.defaultVoxelMat, 0);
                                }
                            }
                        }
                        break;
                    case EditState.Selecting:   //  体素位移结束后，需要把体素local position归正到64 * 64空间
                        this.editState = EditState.None;
                        this.selectInfo.selectIdxSet.forEach(value => {
                            let pos = childList[value].position;
                            childList[value].setPosition(Vec3.round(new Vec3(), pos.multiplyScalar(1 / voxelScale.Edit)).multiplyScalar(voxelScale.Edit));
                        });
                        break;
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
            const childList = this.node.children;
            switch(key.keyCode) {
                case KeyCode.ALT_LEFT:
                    this.editState = EditState.Rotate;
                    break;
                case KeyCode.CTRL_LEFT:
                    this.selectGraph.strokeColor.fromHEX('0099aa');
                    this.selectGraph.fillColor = new Color(0, 200, 200, 80);
                    this.editState = EditState.MultiSelect;
                    break;
                case KeyCode.KEY_C:     // 复制当前选中的所有体素
                    console.log('copy');
                    this.selectInfo.selectIdxSet.forEach(value => {
                        if (this.activeEditVoxelNum === childList.length) {
                            const ev = this.controller.createVoxel(voxelScale.Edit);
                            this.node.addChild(ev);
                        } else if (this.activeEditVoxelNum > childList.length) {
                            console.error('EDIT记录的体素数量超过实际子节点体素数量！！');
                        }
                        const ev = childList[this.activeEditVoxelNum++];
                        ev.position = childList[value].position;
                        ev.active = true;
                        childList[value].translate(new Vec3(0, 0, 0.01), NodeSpace.WORLD);
                    });
                    let i = this.activeEditVoxelNum;
                    while (i < childList.length && childList[i].active) {
                        childList[i++].active = false;
                    }
                    break;
                case KeyCode.DELETE:    // 删除当前框选中的所有体素
                    let deleteVoxelRef = new Array<Node>(this.selectInfo.selectIdxSet.size);
                    this.activeEditVoxelNum -= this.selectInfo.selectIdxSet.size;
                    let idx = 0;
                    this.selectInfo.selectIdxSet.forEach(value => {
                        deleteVoxelRef[idx] = childList[value];
                        idx++;
                    });
                    for (idx = 0; idx < deleteVoxelRef.length; idx++) {
                        this.node.removeChild(deleteVoxelRef[idx]);
                    }
                    this.selectInfo.selectIdxSet.clear();
                    break;
                case KeyCode.KEY_A:     // 在一个体素的一个方向上增加体素
                    this.editState = EditState.DirectionalAdd;
                    break;
                case KeyCode.KEY_D:     // 本次框选中的体素，如果处于被选中状态则取消选中
                    this.editState = EditState.MultiDelete;
                    this.selectGraph.strokeColor.fromHEX('ff0000');
                    this.selectGraph.fillColor = new Color(210, 0, 0, 40);
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


