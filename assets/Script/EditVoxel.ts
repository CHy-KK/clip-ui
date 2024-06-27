import { _decorator, Camera, Color, color, Component, director, EditBox, error, EventKeyboard, EventMouse, EventTouch, geometry, Graphics, input, Input, KeyCode, Label, Mat4, Material, memop, MeshRenderer, Node, NodeSpace, PhysicsSystem, quat, Quat, RenderableComponent, Slider, Vec2, Vec3, Vec4, view, Toggle, assert } from 'cc';
import { MainController } from './Controller';
import { angle2radian, cubeSize, drawRoundRect, EditState, isPosInQuad, RectSize } from './Utils/Utils';
import { Queue } from './Utils/Queue';
import { PREVIEW } from 'cc/env';
const { ccclass, property } = _decorator;

/**实际显示范围为-voxelPosLimit到voxelPosLimit */
const voxelPosLimit = 32;
const opTipString = {
    normal: '按住左alt旋转体素\n按住左ctrl框选\n按住D取消框选体素\n按DELETE删除选中的体素\n按C进入复制当前选中体素\n按住A选择本次需要增加的体素\n按Z回退上一步操作',
    copy: '按D退出复制模式\n按V在当前位置粘贴复制的体素',
    dirAdd:  '按D退出增加体素模式\n在拖动增加体素时按V粘贴增加的体素'
}
/********************************** 注意事项 ********************************** 
* 1. 不要修改main camera的transfrom！！所有体素编辑坐标计算基于worldposition，但实际上应该是基于camera的local空间，main camera的transform全部置0即模拟在world space下的坐标，所以不能做修改！
* 2. 每个ev生成后都要手动置材质，因为部分增加体素的行为比如direcational add会修改材质但是暂不显示，后面生成ev时就会材质错误*/

type SelectInfo = {
    selectCubeSize: cubeSize,
    selectMovingUIPos: Vec2,
    selectNodeSet: Set<Node>,
    selectZ: number,
    selectCentroid: Vec3,
    selectRotate: Vec2,
    selectRotateAcculate: Vec2
}

type AddVoxelInfo = {
    castVoxelPos: Vec3,
    castVoxelFace: Vec3,
    castFaceWorld: Vec3,
    startVoxel: Vec3,
    addArrayNegative: Array<Node>,  
    negLimit: number,
    addArrayPositive: Array<Node>,
    posLimit: number,
}

class VoxelData {
    // 体素坐标范围为-32~31
    private data: Array<Node> = new Array();
    private length: number = 64 * 64 * 64;

    constructor() {
        this.data = new Array(this.length);
    }

    public getData(x: number, y: number, z: number) {
        if (x < 32 && x > -33 && y < 32 && y > -33 && z < 32 && z > -33)
            return this.data[(x + 32) * 4096 + (y + 32) * 64 + (z + 32)];
        return null;
    }

    public setData(x: number, y: number, z: number, val: Node) {
        if (x < 32 && x > -33 && y < 32 && y > -33 && z < 32 && z > -33)
            this.data[(x + 32) * 4096 + (y + 32) * 64 + (z + 32)] = val;
    }

    public clear() {
        for (let i = 0; i < this.data.length; i++)
            this.data[i] = null;
    }
}


@ccclass('EditVoxel')
export class EditVoxel extends Component {
    
    @property(Node)
    public readonly SelectGraphic: Node = null;

    @property(Graphics)
    public readonly BackGroundGraphic: Graphics = null;

    @property(Camera)
    public readonly curCamera: Camera = null;

    @property(Material)
    public readonly defaultVoxelMat: Material = null;

    @property(Material)
    public readonly selectVoxelMat: Material = null;

    @property(Material)
    public readonly addVoxelMat: Material = null;

    private editState: EditState = 0;
    private voxelPosQuery: VoxelData = new VoxelData();
    /**记录当前处于active的体素数量 */
    private activeEditVoxelNum: number;
    private selectGraph: Graphics = null;
    private controller: MainController = null;
    private isMove: boolean = false;
    private clickStartPos: Vec2 = new Vec2();
    private clickUIPos: Vec2 = new Vec2();
    private rotateAngleX: number = 0;
    private rotateAngleY : number = 0;
    private rotateAngleZ : number = 0;
    private editboxX: EditBox = null;
    private sliderX: Slider = null;
    private editboxY: EditBox = null;
    private sliderY: Slider = null;
    private editboxZ: EditBox = null;
    private sliderZ: Slider = null;
    private voxelRead: HTMLInputElement = null;
    private voxelDownLoadLink: HTMLAnchorElement = null;
    private opTipLabel: Label = null;
    private rotate90Check: Toggle = null;
    /**记录选中体素旋转复位信息 */
    private voxelRotateResetRecord: Vec3[] = [];

    /**
     * @type selectCubeSize: 选中体素包围盒
     * @type selectNodeSet: 选中体素Node集合
     * @type selectCentroid: 所有选中体素的坐标和，质心在使用时计算
     * @type selectRotate: 所有选中体素的旋转
     * @type selectRotateAcculate: 累积旋转角度，显示在ui上
     */
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
        selectNodeSet: new Set(),
        selectZ: 0,
        selectCentroid: new Vec3(0, 0, 0),
        selectRotate: new Vec2(0, 0),
        selectRotateAcculate: new Vec2(0, 0)
    }

    /**
     * 本次点击的本地方向
     * @type castVoxelPos: Vec3()    本次点击hitpoint的世界坐标
     * @type castVoxelFace: Vec3()   本次点击中体素面本地朝向
     * @type castFaceWorld: Vec3()   本次击中体素面世界方向
     * @type startVoxel: Vec3()      本次击中体素的local坐标
     * @type addArrayPositive: Array<Node>()     添加到击中体素正方向的体素
     * @type posLimit                正方向能添加的最多体素 0~61
     * @type addArrayNegative: Array<Node>()     添加到击中体素负方向的体素
     * @type negLimit                负方向能添加的最多体素 0~61
     */
    private addInfo: AddVoxelInfo = {
        castVoxelPos: new Vec3(),
        castVoxelFace: new Vec3(),
        castFaceWorld: new Vec3(),
        startVoxel: new Vec3(),
        addArrayPositive: new Array<Node>(),
        posLimit: 0,
        addArrayNegative: new Array<Node>(),
        negLimit: 0,
    }
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
        this.editboxX = director.getScene().getChildByPath('mainUI/OutUI/CameraRotation/RAX/EditBox').getComponent(EditBox);
        this.sliderX = director.getScene().getChildByPath('mainUI/OutUI/CameraRotation/RAX/TotalSlider').getComponent(Slider);
        this.editboxY = director.getScene().getChildByPath('mainUI/OutUI/CameraRotation/RAY/EditBox').getComponent(EditBox);
        this.sliderY = director.getScene().getChildByPath('mainUI/OutUI/CameraRotation/RAY/TotalSlider').getComponent(Slider);
        this.editboxZ = director.getScene().getChildByPath('mainUI/OutUI/CameraRotation/RAZ/EditBox').getComponent(EditBox);
        this.sliderZ = director.getScene().getChildByPath('mainUI/OutUI/CameraRotation/RAZ/TotalSlider').getComponent(Slider);
        this.opTipLabel = director.getScene().getChildByPath('mainUI/OutUI/OperationTip/tips').getComponent(Label);
        this.opTipLabel.string = opTipString.normal;
        this.rotate90Check = director.getScene().getChildByPath('mainUI/OutUI/SelectingRotation/rotate90').getComponent(Toggle);

        // 初始化文件加载和下载模块
        this.voxelDownLoadLink = document.createElement("a");
        this.voxelRead = document.createElement('input');
        this.voxelRead.setAttribute('type', 'file');
        this.voxelRead.addEventListener('change', (event) => {  
            const file = (event.target as HTMLInputElement).files[0]
            const reader = new FileReader();  
            reader.onload = (e) => {  
                try {
                    const fileData = e.target.result; 
                    const fd = JSON.parse(fileData as string);
                    const vd = new Array<Vec3>();
                    fd.forEach(element => {
                        vd.push(new Vec3(element.x, element.y, element.z));
                    });
                    this.renderEditVoxel(vd);
                } catch(e) {
                    console.error('not voxel file');
                }
                
            };  
            reader.readAsText(file);  
        }); 

        drawRoundRect(this.BackGroundGraphic, new Vec2(-630, 560), 290, 310, 10, true);
        this.BackGroundGraphic.fillColor.fromHEX('#dddddd');
        this.BackGroundGraphic.fill();
        
    }

    // TODO: 是否需要一个操作记录栈，毕竟如果误操作导致体素暴增后就不好删除了
    // TODO: 注意，在任何增删体素的修改之后（也包括上面的撤销）需要修改this.activeEditVoxelNum！！
    // TODO: 对所有修改了体素位置、增删的地方，改动需要同步this.voxelData，搜索childList[value]能查找修改
    // TODO: 所有修改都需要确实是否在安全范围内：-voxelPosLimit~voxelPosLimit
    // TODO: 1. 对于选中状态，将记录从坐标查询表中删除，直到取消选中状态时于所处坐标，查询该坐标是否存在体素，如果有则覆盖并删除原体素，并将active体素计数-1
    // TODO: 2. 对于复制状态，新复制出来的一份视为取消选中状态，查询当前坐标体素情况做覆盖，
    // TODO: 3. 对于单面增加状态，不能用框选，只能用点选，要设置一种新状态做单独处理。由于不会移动原有位置的体素，所以不需要考虑原体素坐标查询问题。
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

    private resetSelectInfo() {
        this.selectInfo.selectNodeSet.clear();  
        this.selectInfo.selectCubeSize = {
            left: 10000,
            right: -10000, 
            bottom: 10000, 
            top: -10000,
            back: 10000,
            front: -10000
        }
        this.selectInfo.selectCentroid.multiplyScalar(0);
        this.selectInfo.selectRotate.multiplyScalar(0);
    }

    public async onDrawEditVoxelById(vid: string) {

        const voxelData = this.controller.getRawVoxelDataById(vid);
        this.renderEditVoxel(voxelData);
    }

    public onUploadEditVoxelButtonClick() {
        const voxelData = [];
        const childList = this.node.children;
        
        for (let i = 0; i < childList.length; i++) {
            voxelData.push(childList[i].position);
        }
        this.controller.uploadVoxelToServer(voxelData);
    }

    public renderEditVoxel(voxelData: Vec3[]) {
        // 把之前的所有状态清空
        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
            const mr = chd.getComponent(MeshRenderer);
            mr.setMaterialInstance(this.defaultVoxelMat, 0);
        })
        this.resetSelectInfo();
        this.voxelPosQuery.clear();
        this.editState = EditState.None;
        const childList = this.node.children;
        let i = 0;
        for (; i < voxelData.length; i++) {
            if (i === childList.length) {
                const ev = this.controller.createVoxel();
                this.node.addChild(ev);
                // this.voxelList.Edit.push(ev);
            } else if (i > childList.length) {
                console.error('EDIT记录的体素数量超过实际子节点体素数量！！');
            }
            const ev = childList[i];
            const mr = ev.getComponent(MeshRenderer);
            mr.setMaterialInstance(this.defaultVoxelMat, 0);
            ev.position = new Vec3(voxelData[i].x, voxelData[i].y, voxelData[i].z);
            ev.active = true;
            ev.setScale(1,1,1);
            this.voxelPosQuery.setData(voxelData[i].x, voxelData[i].y, voxelData[i].z, ev);

        }
        this.activeEditVoxelNum = i;
        while (i < childList.length && childList[i].active) {
            childList[i++].active = false;
        }
        this.node.setWorldRotation(Quat.fromEuler(new Quat(), 0, 0, 0));
        this.rotateAngleX = 0;
        this.rotateAngleY = 0;
        this.rotateAngleZ = 0;
        this.editboxX.string = (0).toString();
        this.sliderX.progress = 0;
        this.editboxY.string = (0).toString();
        this.sliderY.progress = 0;
        this.editboxZ.string = (0).toString();
        this.sliderZ.progress = 0;
    }

    private onTouchStart(e: EventTouch) {
        if (this.controller.isOutUI()) {
            const pos: Vec2 = e.touch.getUILocation();
            this.clickUIPos = pos;
            this.clickStartPos = e.touch.getLocation();
            const screenRay = new geometry.Ray();
            this.curCamera.screenPointToRay(e.getLocationX(), e.getLocationY(), screenRay);
            const rayCastRes: boolean = PhysicsSystem.instance.raycastClosest(screenRay);
            if (this.selectInfo.selectNodeSet.size > 0) {
                let castSelect: boolean = false;
                if (this.editState === EditState.Copying) { // 点击空屏不取消选中状态
                    if (rayCastRes) {
                        const res = PhysicsSystem.instance.raycastClosestResult.collider.node;
                        if (this.selectInfo.selectNodeSet.has(res)) {
                            this.selectInfo.selectZ = res.worldPosition.z; 
                            this.addInfo.castVoxelPos = res.worldPosition;
                        }
                    }
                } else if (this.editState === EditState.None) {
                    if (rayCastRes) {
                        const res = PhysicsSystem.instance.raycastClosestResult.collider.node;
                        if (this.selectInfo.selectNodeSet.has(res)) {
                            this.editState = EditState.Selecting;
                            castSelect = true;
                            this.selectInfo.selectZ = res.worldPosition.z; 
                            this.addInfo.castVoxelPos = res.worldPosition;
                            this.addInfo.startVoxel = res.position;
                            if (PREVIEW)
                                console.log(this.addInfo.castVoxelPos);
                        }
                    } 
                    if (!(rayCastRes && castSelect)) {  // 取消选中状态，TODO: 感觉最好有一个button专门执行取消选中的工作
                        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                            this.deleteCoincideVoxel(chd);
                            const mr = chd.getComponent(MeshRenderer);
                            mr.setMaterialInstance(this.defaultVoxelMat, 0);
                        });
                        this.resetSelectInfo();
                    }
                } else if (this.editState === EditState.DirectionalAdd) {
                    const res = PhysicsSystem.instance.raycastClosestResult.collider.node;
                        if (this.selectInfo.selectNodeSet.has(res)) {
                            this.editState = EditState.DirectionalAddMove;
                            this.selectInfo.selectZ = res.worldPosition.z; 
                            this.addInfo.castVoxelPos = res.worldPosition;
                            this.addInfo.startVoxel = res.position;
                            // 计算本次点击是在体素的哪个面
                            this.node.inverseTransformPoint(this.addInfo.castVoxelFace, PhysicsSystem.instance.raycastClosestResult.hitPoint);
                            this.addInfo.castVoxelFace.subtract(res.position);
                            
                            // 计算本地坐标系点击朝向
                            if (Math.abs(this.addInfo.castVoxelFace.x) <= Math.abs(this.addInfo.castVoxelFace.y)) {
                                this.addInfo.castVoxelFace.x = 0;
                                if (Math.abs(this.addInfo.castVoxelFace.y) <=  Math.abs(this.addInfo.castVoxelFace.z)) {
                                    this.addInfo.castVoxelFace.y = 0;
                                    this.addInfo.castVoxelFace.z = 1;
                                } else {
                                    this.addInfo.castVoxelFace.z = 0;
                                    this.addInfo.castVoxelFace.y = 1;
                                }
                            } else {
                                this.addInfo.castVoxelFace.y = 0;
                                if (Math.abs(this.addInfo.castVoxelFace.x) <=  Math.abs(this.addInfo.castVoxelFace.z)) {
                                    this.addInfo.castVoxelFace.x = 0;
                                    this.addInfo.castVoxelFace.z = 1;
                                } else {
                                    this.addInfo.castVoxelFace.z = 0;
                                    this.addInfo.castVoxelFace.x = 1;
                                }
                            }
                            this.addInfo.posLimit = 31 - Vec3.dot(this.addInfo.startVoxel, this.addInfo.castVoxelFace);
                            this.addInfo.negLimit = -(63 - this.addInfo.posLimit - this.addInfo.posLimit);
                            this.addInfo.addArrayNegative = [];
                            this.addInfo.addArrayPositive = [];

                            const castWorld4 = Vec4.transformAffine(new Vec4(), new Vec4(this.addInfo.castVoxelFace.x, this.addInfo.castVoxelFace.y, this.addInfo.castVoxelFace.z, 0), this.node.getWorldMatrix()); 
                            this.addInfo.castFaceWorld = new Vec3(castWorld4.x, castWorld4.y, castWorld4.z)
                            this.addInfo.castFaceWorld.normalize();
                        }
                }
            }
            if (this.editState === EditState.DirectionalAddSelect) {    //  单选情况不受选中size影响
                if (rayCastRes) {
                    const res = PhysicsSystem.instance.raycastClosestResult.collider.node;
                    const resId = res.uuid;
                    // this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                    //     if (chd.uuid === resId) {
                    //         this.selectInfo.selectNodeSet.delete(res);
                    //         throw new Error();
                    //     }
                    // });
                    if (this.selectInfo.selectNodeSet.has(res)) {
                        this.opTipLabel.string = opTipString.normal;
                        this.selectInfo.selectNodeSet.delete(res);
                        const mr = res.getComponent(MeshRenderer);
                        mr.setMaterialInstance(this.defaultVoxelMat, 0);
                    } else if (this.selectInfo.selectNodeSet.size === 0) {
                        this.opTipLabel.string = opTipString.dirAdd;
                        const mr = res.getComponent(MeshRenderer);
                        mr.setMaterialInstance(this.selectVoxelMat, 0);
                        // 因为不用移动，所以不用设置selectInfo中的其他属性
                        this.selectInfo.selectNodeSet.add(res);
                    }
                    
                }
            }
        }
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
                    if (this.selectInfo.selectNodeSet.size) {
                        const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                        if (this.rotate90Check.isChecked) {
                            this.selectInfo.selectRotate.add(deltaMove);
                            // xoffset绕Y旋转，yoffset绕X旋转
                            if (Math.abs(this.selectInfo.selectRotate.x) > 90) {
                                const angle = Math.sign(deltaMove.x) * 90;
                                const qy = Quat.fromAxisAngle(new Quat(), Vec3.UP, angle2radian(angle));
                                this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                                    const pos = Vec3.transformQuat(new Vec3, chd.position.subtract(this.selectInfo.selectCentroid), qy);
                                    chd.setPosition(pos.add(this.selectInfo.selectCentroid));
                                    // let rot = chd.worldRotation;
                                    // Quat.rotateAround(rot, rot, Vec3.UP, angle2radian(angle));
                                    // Quat.normalize(rot, rot);
                                    // chd.setWorldRotation(rot);
                                });
                                this.selectInfo.selectRotate.x = 0;
                                this.selectInfo.selectRotateAcculate.x += angle;
                            } 
                            if (Math.abs(this.selectInfo.selectRotate.y) > 90) {
                                const angle = -Math.sign(deltaMove.y) * 90;
                                const qx = Quat.fromAxisAngle(new Quat(), Vec3.RIGHT, angle2radian(angle));
                                this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                                    const pos = Vec3.transformQuat(new Vec3, chd.position.subtract(this.selectInfo.selectCentroid), qx);
                                    chd.setPosition(pos.add(this.selectInfo.selectCentroid));
                                    // let rot = chd.worldRotation;
                                    // Quat.rotateAround(rot, rot, Vec3.RIGHT, angle2radian(angle));
                                    // Quat.normalize(rot, rot);
                                    // chd.setWorldRotation(rot);
                                });
                                this.selectInfo.selectRotate.y = 0;
                                this.selectInfo.selectRotateAcculate.y += angle;
                            }
                        } else {
                            if (Math.abs(deltaMove.x) > Math.abs(deltaMove.y)) {
                                const qy = Quat.fromAxisAngle(new Quat(), Vec3.UP, angle2radian(deltaMove.x));
                                this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                                    const pos = Vec3.transformQuat(new Vec3, chd.position.subtract(this.selectInfo.selectCentroid), qy);
                                    // chd.setPosition(Vec3.round(new Vec3, pos.add(this.selectInfo.selectCentroid)));
                                    chd.setPosition(pos.add(this.selectInfo.selectCentroid));
                                });
                                this.selectInfo.selectRotate.x = 0;
                                this.selectInfo.selectRotateAcculate.x += deltaMove.x;
                            } else {
                                const qx = Quat.fromAxisAngle(new Quat(), Vec3.RIGHT, angle2radian(-deltaMove.y));
                                this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                                    const pos = Vec3.transformQuat(new Vec3, chd.position.subtract(this.selectInfo.selectCentroid), qx);
                                    // chd.setPosition(Vec3.round(new Vec3, pos.add(this.selectInfo.selectCentroid)));
                                    chd.setPosition(pos.add(this.selectInfo.selectCentroid));
                                });
                                this.selectInfo.selectRotate.y = 0;
                                this.selectInfo.selectRotateAcculate.y += -deltaMove.y;
                            }
                        }
                    } 
                    
                    // this.rotateAngleY += deltaMove.x;
                    // this.editboxY.string = this.rotateAngleY.toString();
                    // const apy = (this.rotateAngleY % 360) / 360;
                    // this.sliderY.progress = apy < 0 ? 1 + apy : apy;
                    break;

                case EditState.Copying:
                case EditState.Selecting: {
                    const clickX = this.wsHalfWidth * (posSS.x - this.viewHalfWidth) / this.viewHalfWidth;
                    const clickY = this.wsHalfHeight * (posSS.y - this.viewHalfHeight) / this.viewHalfHeight;

                    // 利用相似三角形计算体素需要被移动到的位置的相机距离
                    const clickDis2Camera = Math.sqrt(clickX * clickX + clickY * clickY + this.curCamera.near * this.curCamera.near);
                    const targetDis2Camera = clickDis2Camera * Math.abs(this.selectInfo.selectZ - this.curCamera.node.position.z) / this.curCamera.near;
            
                    let target: Vec3 = new Vec3();
                    const myRay = new Vec3(clickX, clickY, -1).normalize();
                    Vec3.multiplyScalar(target, myRay, targetDis2Camera);
                    // 判断本次移动是否会造成超出范围   
                    let localTarget = this.node.inverseTransformPoint(new Vec3(), target);
                    const localCastPos = this.node.inverseTransformPoint(new Vec3(), this.addInfo.castVoxelPos);
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

                    const offset: Vec3 = Vec3.subtract(new Vec3(), target, this.addInfo.castVoxelPos);
                    this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                        chd.setWorldPosition(Vec3.add(new Vec3(), chd.worldPosition, offset));
                    });
                    this.selectInfo.selectCentroid.add(localOffset);
                    this.addInfo.castVoxelPos = target;
                    break;
                }

                case EditState.DirectionalAddMove: {
                    const clickX = this.wsHalfWidth * (posSS.x - this.viewHalfWidth) / this.viewHalfWidth;
                    const clickY = this.wsHalfHeight * (posSS.y - this.viewHalfHeight) / this.viewHalfHeight;

                    // 先计算在相同深度下鼠标对应空间中的目标点
                    const clickDis2Camera = Math.sqrt(clickX * clickX + clickY * clickY + this.curCamera.near * this.curCamera.near);
                    const targetDis2Camera = clickDis2Camera * Math.abs(this.selectInfo.selectZ - this.curCamera.node.position.z) / this.curCamera.near;
                    let worldTarget: Vec3 = new Vec3();
                    const myRay = new Vec3(clickX, clickY, -1).normalize();
                    Vec3.multiplyScalar(worldTarget, myRay, targetDis2Camera);

                    // 计算目标点在位移方向上的投影
                    let moveWorld = new Vec3();
                    Vec3.multiplyScalar(moveWorld, this.addInfo.castFaceWorld, Vec3.dot(this.addInfo.castFaceWorld, Vec3.subtract(new Vec3(), worldTarget, this.addInfo.castVoxelPos)));
                    const localMove4 = Vec4.transformAffine(new Vec4(), new Vec4(moveWorld.x, moveWorld.y, moveWorld.z, 0), this.node.getWorldMatrix().invert())
                    const localMove = new Vec3(localMove4.x, localMove4.y, localMove4.z);
                    let moveNum = Vec3.dot(localMove, this.addInfo.castVoxelFace);
                    const negArray = this.addInfo.addArrayNegative;
                    const posArray = this.addInfo.addArrayPositive;
                    
                    const childList = this.node.children;
                    if (moveNum > 0) {
                        moveNum = Math.floor(moveNum);
                        while (negArray.length > 0) {
                            if (negArray[negArray.length - 1] === childList[this.activeEditVoxelNum - 1]) {
                                negArray.pop();
                                childList[this.activeEditVoxelNum - 1].active = false;
                                this.activeEditVoxelNum--;
                            } else
                                throw new Error('add array ele idx not match activeEditVoxelNum')
                        }
                    
                        if (moveNum < posArray.length) {
                            while (posArray.length > moveNum) {
                                if (posArray[posArray.length - 1] === childList[this.activeEditVoxelNum - 1]) {
                                    posArray.pop();
                                    childList[--this.activeEditVoxelNum].active = false;
                                } else
                                    throw new Error('add array ele idx not match activeEditVoxelNum')
                            }
                        } else if (moveNum > posArray.length) {
                            while (posArray.length < moveNum && posArray.length <= this.addInfo.posLimit) { 
                                if (this.activeEditVoxelNum === childList.length) {
                                    const ev = this.controller.createVoxel();
                                    this.node.addChild(ev);
                                } else if (this.activeEditVoxelNum > childList.length) {
                                    throw new Error('EDIT记录的体素数量超过实际子节点体素数量！！');
                                }
                                const ev = childList[this.activeEditVoxelNum++];
                                ev.active = true;
                                ev.setScale(1,1,1);
                                ev.setPosition(Vec3.add(new Vec3(), this.addInfo.startVoxel, Vec3.multiplyScalar(new Vec3(), this.addInfo.castVoxelFace, posArray.length + 1)));
                                const mr = (ev.getComponent(MeshRenderer) as RenderableComponent);
                                mr.setMaterialInstance(this.addVoxelMat, 0);
                                posArray.push(ev);
                            }
                        }
                    } else if (moveNum < 0) {
                        moveNum = Math.floor(Math.abs(moveNum));
                        while (posArray.length > 0) {
                            if (posArray[posArray.length - 1] === childList[this.activeEditVoxelNum - 1]) {
                                posArray.pop();
                                childList[this.activeEditVoxelNum - 1].active = false;
                                this.activeEditVoxelNum--;
                            } else
                                throw new Error('add array ele idx not match activeEditVoxelNum')
                        }
                        if (negArray.length > moveNum) {
                            while (negArray.length > moveNum) {
                                if (negArray[negArray.length - 1] === childList[this.activeEditVoxelNum - 1]) {
                                    negArray.pop();
                                    childList[--this.activeEditVoxelNum].active = false;
                                } else
                                    throw new Error('add array ele idx not match activeEditVoxelNum')
                            }
                        } else if (moveNum > negArray.length) {
                            while (negArray.length < moveNum && negArray.length <= this.addInfo.posLimit) { 
                                if (this.activeEditVoxelNum === childList.length) {
                                    const ev = this.controller.createVoxel();
                                    this.node.addChild(ev);
                                } else if (this.activeEditVoxelNum > childList.length) {
                                    throw new Error('EDIT记录的体素数量超过实际子节点体素数量！！');
                                }
                                const ev = childList[this.activeEditVoxelNum++];
                                ev.setScale(1,1,1);
                                ev.active = true;
                                ev.setPosition(Vec3.add(new Vec3(), this.addInfo.startVoxel, Vec3.multiplyScalar(new Vec3(), this.addInfo.castVoxelFace, -(negArray.length + 1))));
                                const mr = (ev.getComponent(MeshRenderer) as RenderableComponent);
                                mr.setMaterialInstance(this.addVoxelMat, 0);
                                negArray.push(ev);
                            }
                        }
                        
                    } else {

                    }

                    break;
                }
    
                default: 
                    break;
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
                        this.selectInfo.selectCentroid.multiplyScalar(this.selectInfo.selectNodeSet.size);
                        for (let i = 0; i < this.activeEditVoxelNum; i++) {
                            const ssPos = this.curCamera.worldToScreen(childList[i].worldPosition);
                            if (isPosInQuad(new Vec2(ssPos.x, ssPos.y), selectQuad)) {
                                if (!this.selectInfo.selectNodeSet.has(childList[i])) {
                                    this.selectInfo.selectNodeSet.add(childList[i]);
                                    this.selectInfo.selectCentroid.add(childList[i].position);
                                    const mr = (childList[i].getComponent(MeshRenderer) as RenderableComponent);
                                    mr.setMaterialInstance(matInstance, 0);
                                    const pos = childList[i].position;
                                    this.voxelPosQuery.setData(pos.x, pos.y, pos.z, null);
                                    this.selectInfo.selectCubeSize.left = Math.min(this.selectInfo.selectCubeSize.left, pos.x);
                                    this.selectInfo.selectCubeSize.right = Math.max(this.selectInfo.selectCubeSize.right, pos.x);
                                    this.selectInfo.selectCubeSize.bottom = Math.min(this.selectInfo.selectCubeSize.bottom, pos.y);
                                    this.selectInfo.selectCubeSize.top = Math.max(this.selectInfo.selectCubeSize.top, pos.y);
                                    this.selectInfo.selectCubeSize.back = Math.min(this.selectInfo.selectCubeSize.back, pos.z);
                                    this.selectInfo.selectCubeSize.front = Math.max(this.selectInfo.selectCubeSize.front, pos.z);
                                }
                            }
                        }
                        this.selectInfo.selectCentroid.multiplyScalar(1 / this.selectInfo.selectNodeSet.size);
                        break;
                    case EditState.MultiDelete:
                        // TODO: 这里要重新计算selectinfo里的包围盒
                        const selectQuadD: RectSize = {
                            left: Math.min(this.clickStartPos.x, clickEndPos.x),
                            right: Math.max(this.clickStartPos.x, clickEndPos.x),
                            bottom: Math.min(this.clickStartPos.y, clickEndPos.y),
                            top: Math.max(this.clickStartPos.y, clickEndPos.y),
                        }
                        this.selectInfo.selectCentroid.multiplyScalar(this.selectInfo.selectNodeSet.size);
                        for (let i = 0; i < this.activeEditVoxelNum; i++) {
                            const ssPos = this.curCamera.worldToScreen(childList[i].worldPosition);
                            if (isPosInQuad(new Vec2(ssPos.x, ssPos.y), selectQuadD)) {
                                if (this.selectInfo.selectNodeSet.has(childList[i])) {
                                    this.selectInfo.selectCentroid.subtract(childList[i].position);
                                    this.selectInfo.selectNodeSet.delete(childList[i]);
                                    const mr = (childList[i].getComponent(MeshRenderer) as RenderableComponent);
                                    mr.setMaterialInstance(this.defaultVoxelMat, 0);
                                }
                            }
                        }
                        this.selectInfo.selectCentroid.multiplyScalar(1 / this.selectInfo.selectNodeSet.size);
                        break;
                    case EditState.Selecting:   //  体素位移结束后，需要把体素local position归正到64 * 64空间
                        this.editState = EditState.None;
                    case EditState.Copying:
                        // 记录选中体素的旋转复位坐标
                        let recIdx = 0;
                        this.voxelRotateResetRecord = new Array(this.selectInfo.selectNodeSet.size)
                        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                            chd.position = Vec3.round(new Vec3(), chd.position); 
                            this.voxelRotateResetRecord[recIdx++] = new Vec3(chd.position);
                        });
                        Vec3.round(this.selectInfo.selectCentroid, this.selectInfo.selectCentroid);
                        break;
                    case EditState.DirectionalAddMove: 
                        this.editState = EditState.DirectionalAdd;
                        const addArray = this.addInfo.addArrayNegative.length > 0 ? this.addInfo.addArrayNegative : this.addInfo.addArrayPositive;
                        for (let i = addArray.length - 1; i >= 0; i--) {
                            childList[--this.activeEditVoxelNum].active = false;
                            addArray.pop();
                        }
                        break;
                }
    
                this.isMove = false;
                this.selectGraph.clear();
            } else {

            }
        }
    }


    private onkeyDown(key: EventKeyboard) {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        if (this.controller.isOutUI()) {
            const childList = this.node.children;
            if (this.editState === EditState.None) {    // 常规模式
                switch(key.keyCode) {
                    case KeyCode.ALT_LEFT:  // 鼠标旋转
                        this.editState = EditState.Rotate;
                        break;
                    case KeyCode.CTRL_LEFT: // 框选 
                        this.selectGraph.strokeColor.fromHEX('0099aa');
                        this.selectGraph.fillColor = new Color(0, 200, 200, 80);
                        this.editState = EditState.MultiSelect;
                        break;
                    case KeyCode.KEY_C:     // 复制当前选中的所有体素，进入copying状态，阻塞其他一切操作，直到粘贴或者取消复制
                        if (this.selectInfo.selectNodeSet.size > 0) {
                            this.editState = EditState.Copying;
                            this.opTipLabel.string = opTipString.copy;
                            this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                                if (this.activeEditVoxelNum === childList.length) {
                                    const ev = this.controller.createVoxel();
                                    this.node.addChild(ev);
                                } else if (this.activeEditVoxelNum > childList.length) {
                                    console.error('EDIT记录的体素数量超过实际子节点体素数量！！');
                                }
                                const ev = childList[this.activeEditVoxelNum++];
                                this.voxelPosQuery.setData(chd.position.x, chd.position.y, chd.position.z, ev);
                                const mr = ev.getComponent(MeshRenderer);
                                mr.setMaterialInstance(this.defaultVoxelMat, 0);
                                ev.position = chd.position;
                                ev.setScale(1,1,1);
                                ev.active = true;
                                
                            });
                            let i = this.activeEditVoxelNum;
                            while (i < childList.length && childList[i].active) {
                                childList[i++].active = false;
                            }
                        }
                        break;
                    case KeyCode.DELETE:    // 删除当前框选中的所有体素
                        this.activeEditVoxelNum -= this.selectInfo.selectNodeSet.size;
                        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                            this.voxelPosQuery.setData(chd.position.x, chd.position.y, chd.position.z, null);
                            this.node.removeChild(chd);
                            chd.destroy();
                        });
                        this.selectInfo.selectNodeSet.clear();
                        this.resetSelectInfo();
                        break;
                    case KeyCode.KEY_A:     // 在一个体素的一个方向上增加体素
                        this.editState = EditState.DirectionalAddSelect;
                        break;
                    case KeyCode.KEY_D:     // 本次框选中的体素，如果处于被选中状态则取消选中
                        this.editState = EditState.MultiDelete;
                        this.selectGraph.strokeColor.fromHEX('ff0000');
                        this.selectGraph.fillColor = new Color(210, 0, 0, 40);
                        break;
                        
                }
            } else if (this.editState === EditState.Copying) {  // 复制模式
                switch(key.keyCode) {
                    case KeyCode.KEY_V:
                        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                            if (this.voxelPosQuery.getData(chd.position.x, chd.position.y, chd.position.z) === null) {
                                if (this.activeEditVoxelNum === childList.length) {
                                    const ev = this.controller.createVoxel();
                                    this.node.addChild(ev);
                                } else if (this.activeEditVoxelNum > childList.length) {
                                    console.error('EDIT记录的体素数量超过实际子节点体素数量！！');
                                }
                                const ev = childList[this.activeEditVoxelNum++];
                                const mr = ev.getComponent(MeshRenderer);
                                mr.setMaterialInstance(this.defaultVoxelMat, 0);
                                ev.setPosition(new Vec3(chd.position.x, chd.position.y, chd.position.z));
                                ev.active = true;
                                ev.setScale(1,1,1);
                                this.voxelPosQuery.setData(ev.position.x, ev.position.y, ev.position.z, ev);
                            }
                        });
                        let i = this.activeEditVoxelNum;
                        while (i < childList.length && childList[i].active) {
                            childList[i++].active = false;
                        }
                        break;
                    
                    case KeyCode.KEY_D: // 放弃粘贴，退出copying模式，删除选中记录（这里不能用重置）
                        this.activeEditVoxelNum -= this.selectInfo.selectNodeSet.size;
                        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                            this.node.removeChild(chd);
                            chd.destroy();
                        });
                        this.resetSelectInfo();
                        this.editState = EditState.None;
                        this.opTipLabel.string = opTipString.normal;
                        break;

                }
            } else if (this.editState === EditState.DirectionalAdd) {
                switch(key.keyCode) {
                    case KeyCode.KEY_A:
                        this.editState = EditState.DirectionalAddSelect;
                        break; 
                    case KeyCode.KEY_D:
                        this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                            const mr = chd.getComponent(MeshRenderer);
                            mr.setMaterialInstance(this.defaultVoxelMat, 0);
                        });
                        this.resetSelectInfo();
                        this.editState = EditState.None;
                        this.opTipLabel.string = opTipString.normal;
                        break;
                }
            } else if (this.editState === EditState.DirectionalAddMove && key.keyCode === KeyCode.KEY_V) {
                const addArray = this.addInfo.addArrayNegative.length > 0 ? this.addInfo.addArrayNegative : this.addInfo.addArrayPositive;
   
                for (let i = addArray.length; i > 0; i--) {
                    const mr = childList[this.activeEditVoxelNum - i].getComponent(MeshRenderer);
                    mr.setMaterialInstance(this.defaultVoxelMat, 0);
                    this.deleteCoincideVoxel(childList[this.activeEditVoxelNum - i]);
                    addArray.pop();
                }
            }
            
        } 

    }

    private onkeyUp(key: EventKeyboard) {
                    
        switch(key.keyCode) {
            case KeyCode.ALT_LEFT:
                this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                    chd.setPosition(Vec3.round(new Vec3, chd.position));
                });
                break;
        }

        if (this.editState >= EditState.DirectionalAdd) {
            if (this.editState === EditState.DirectionalAddSelect && this.selectInfo.selectNodeSet.size > 0) {
                this.editState = EditState.DirectionalAdd;
            }
        }
        else
            this.editState = EditState.None;

    }

    private onMouseWheel(e: EventMouse) {
        if (this.controller.isOutUI()) {
            // if (this.editState === EditState.None) {
            const scroll = e.getScrollY();
            const fovAngle = this.curCamera.fov - scroll / 500;
            this.curCamera.fov = Math.min(75, Math.max(15, fovAngle));
            this.calScreenSizeinWorldSpace();
            // }
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
    
    private deleteCoincideVoxel(chd: Node) { // 在复制/增加体素后需要检查是否移动之后原位置上就有体素了，如果有，需要把那个位置上原有的体素加入删除队列
        const res = this.voxelPosQuery.getData(chd.position.x, chd.position.y, chd.position.z);

        if (res != null) {
            this.activeEditVoxelNum -= 1;
            this.node.removeChild(chd);
            chd.destroy();
        } 
        // else {
        this.voxelPosQuery.setData(chd.position.x, chd.position.y, chd.position.z, chd);
        // }
    }

    public onEditTextRAChange(text: string, editbox: EditBox, customEventData: string) {
        if (this.controller.isOutUI()) {
            if (text.length === 0)
                text = '0';
            const angle = parseFloat(text);
            editbox.string = angle.toString();
            const ap = (angle % 360) / 360;
            if (customEventData === 'angleX') {
                this.rotateAngleX = angle;
                this.sliderX.progress = ap < 0 ? 1 + ap : ap;
            } else if (customEventData === 'angleY') {
                this.rotateAngleY = angle;
                this.sliderY.progress = ap < 0 ? 1 + ap : ap;
            } else {
                this.rotateAngleZ = angle;
                this.sliderZ.progress = ap < 0 ? 1 + ap : ap;
            }
            this.node.setWorldRotation(Quat.fromEuler(new Quat(), this.rotateAngleX, this.rotateAngleY, this.rotateAngleZ));
        }
    }

    public onSliderChange(slider: Slider, customEventData: string) {
        if (this.controller.isOutUI()) {

            if (customEventData === 'sliderX') {
                this.rotateAngleX = Math.round(360 * slider.progress);
                this.editboxX.string = this.rotateAngleX.toString();
            } else if (customEventData === 'sliderY'){
                this.rotateAngleY = Math.round(360 * slider.progress);
                this.editboxY.string = this.rotateAngleY.toString();
            } else {
                this.rotateAngleZ = Math.round(360 * slider.progress);
                this.editboxZ.string = this.rotateAngleZ.toString();
            }
            this.node.setWorldRotation(Quat.fromEuler(new Quat(), this.rotateAngleX, this.rotateAngleY, this.rotateAngleZ));
        }
    }


    public onloadVoxel() {
        this.voxelRead.click();
    }

    public onSaveVoxelToFile(type: string) {
        let voxelData = new Array<Vec3>();

        const childList = this.node.children;
        for (let i = 0; i < this.activeEditVoxelNum; i++) {
            voxelData.push(childList[i].position);
        }
        const jsonStr = JSON.stringify(voxelData);
        const textFileAsBlob = new Blob([jsonStr], { type: 'application/json' });
        this.voxelDownLoadLink.download = 'voxel';
        if (window.webkitURL != null) {
            this.voxelDownLoadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        this.voxelDownLoadLink.click();
    }

    public resetSelectingVoxel() {
        console.log('reseting');
        if (this.selectInfo.selectNodeSet.size) {
            console.log("reset voxel pos" + this.selectInfo.selectNodeSet.size);
            let i = 0;
            assert(this.voxelRotateResetRecord.length === this.selectInfo.selectNodeSet.size, "复位体素记录列表长度和当前选中体素数量不一致！！");
            console.log("reset voxel pos" + this.selectInfo.selectNodeSet.size);
            this.selectInfo.selectNodeSet.forEach((chd: Node) => {
                if(chd.position === this.voxelRotateResetRecord[i]) {
                    console.error("chd position === this.voxelRotateResetRecord");
                }
                chd.setPosition(this.voxelRotateResetRecord[i++]);
            });
        }
    }
}


