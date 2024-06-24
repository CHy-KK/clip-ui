import { _decorator, assert, Button, Color, Component, director, EventHandler, EventKeyboard, EventTouch, Graphics, ImageAsset, Input, input, instantiate, KeyCode, Label, lerp, Material, MeshRenderer, Node, Overflow, Prefab, Quat, quat, random, randomRange, randomRangeInt, RenderableComponent, renderer, RenderTexture, SpringJoint2D, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, ValueType, Vec2, Vec3, Vec4, Widget } from 'cc';
// import `native` from 'cc'
import { PREVIEW, NATIVE } from 'cc/env';
import { Queue, VoxelHistoryQueue } from './Utils/Queue';
import { SnapShotNode } from './SnapShotNode';
import { LockAsync } from './Utils/Lock';
import { PanelNode } from './PanelNode';
import { DataPoint, RectSize, VoxelBuffer, SelectingType, SnapShotState, voxelScale, type2Color, RequestName, angle2radian, ClickState, drawRoundRect } from './Utils/Utils';
import { QuadPanelGradient } from './QuadPanelGradient';
import { EditEmbeddingNodeVoxel } from './EditEmbeddingGraph/EditEmbeddingNodeVoxel';
import { ScatterController } from './ScatterController';
import { EditEmbeddingGraphController } from './EditEmbeddingGraph/EditEmbeddingGraphController';
import { ImageScatterController } from './ImageScatterController';
const { ccclass, property } = _decorator;

export const SERVER_HOST = 'http://127.0.0.1:5000';    // 注意这里端口可能被占用
const GET_VOXEL_FINISH_EVENT = 'getvoxel-voxel-finish';
const SNAPSHOT_FOR_NEW_VOXEL_EVENT = 'snapshot-for-new-voxel';
export const GET_VOXEL_FOR_EEGRAPH = 'getvoxel-edit-embedding-graph'
export const DRAW_EDIT_VOXEL_EVENT = 'draw-edit-voxel';

export type EegMsg = {
    emb: number[], 
    eenv: EditEmbeddingNodeVoxel,
    feature: number[]
}

@ccclass('MainController')
export class MainController extends Component {

    /******************* 可外部编辑参数 *******************/
    @property()
    public readonly historyMaxLength: number = 20;


    @property({ tooltip: '坐标轴刻度数量' })
    public scaleSegNum: number = 10;

    
    @property(Material)
    public readonly voxelMatDefault: Material = null;

    @property(Material)
    public readonly voxelMat1: Material = null;

    @property(Material)
    public readonly voxelMat2: Material = null;

    @property
    public isUseTestCase: boolean = true;
    
    /******************* 场景数据 *******************/
    @property(Graphics)
    public readonly DivideLineGraphic: Graphics = null;

    @property(Node)
    public readonly ScatterNode: Node = null;

    @property(Node)
    public readonly EditEmbeddingNode: Node = null;

    @property(Node)
    public readonly ScatterImageNode: Node = null;

    @property(Node)
    public readonly AxisGraphic: Node = null;

    @property(Node)
    public readonly ScaleGraphic: Node = null;


    // @property(Node)
    // public readonly HistoryBgGraphic: Node = null;

    // @property(Node)
    // public readonly InnerHistoryGraphic: Node = null;

    @property(Node)
    public readonly UICanvas: Node = null;

    @property(Prefab)
    public readonly VoxelCube: Prefab = null;

    @property({ type: Node, tooltip: '挂载inner ui体素数据的节点' })
    public readonly VoxelNodeSelect: Node = null;

    @property({ type: Node, tooltip: '挂载世界空间可编辑体素数据的节点' })
    public readonly VoxelNodeEdit: Node = null;

    @property(RenderTexture)
    public readonly selectRT: RenderTexture = null; 

    @property(SpriteFrame)
    public readonly FUFUSF: SpriteFrame = null;

    @property(Node)
    public readonly quadPanelNode: Node = null;

    @property(Node)
    public readonly detailInfoNode: Node = null;

    public data: DataPoint[] = [];
    private typeDict: Map<string, number> = new Map();
    /**记录每个类别下所有数据点在data中坐标 */
    public type2Idx: Map<number, [number]> = new Map();
    private canvasSize: Vec2 = new Vec2(0);
    // private historyBgGraph: Graphics;       // 外UI历史选中列表
    // private innerHistoryGraph: Graphics;    // 内UI历史选中列表
    public contourBg: Node;          // 散点图下等高线图
    private isInnerUI: boolean = true;
    // private selectNodeList: Node[] = [];
    private quadPanelPos: RectSize;
    private quadShowSelect: RectSize;
    private isGetVoxelFinished: boolean = false;
    private voxelDataHistory: VoxelHistoryQueue;
    private panelPosBoard: Label = null;
    private axisLength: number;
    private tileLength: number;
    private voxelReadHTML: HTMLInputElement = null;
    private voxelDownLoadLinkHTML: HTMLAnchorElement = null;
    private imageReadHTML: HTMLInputElement = null;
    private contourData = [];
    private scatterController: ScatterController = null;

    // 交互数据
    private _isInitialize: boolean = false;
    // private isSelectCtrl: boolean = false;
     /**
     * @mention 不要世界对该变量赋值，用setSelectType接口
     */
    // private selectType: SelectingType = SelectingType.None;
    private isSnapShotReady: SnapShotState = 0;
    private snapShotId: string = '';
    private panelClickPos: Vec3 = new Vec3(0);
    private clickState: ClickState = 0;
    private _curSelectVoxelId: string = '';      // 当前innerUI显示在select区域的体素id
    private curEditVoxelId: string = '';        // 当亲outUI显示在编辑区域的体素id 
    private selectSnapNode: Node[] = [];
    private curEENV: EditEmbeddingNodeVoxel = null;
    /**标识白板体素序号 */
    private blankNum = 0;   
    /**标识创建体素序号 */
    private createNum = 0;

    start() {
        // 界面初始化
        this.canvasSize.x = this.UICanvas.getComponent(UITransform).contentSize.x;
        this.canvasSize.y = this.UICanvas.getComponent(UITransform).contentSize.y;
        // 计算rgb调色盘区域坐标
        const quadPanel = this.UICanvas.getChildByPath('InnerUI/quadPanel');
        this.quadPanelPos = {
            right: this.canvasSize.x - quadPanel.getComponent(Widget).right,
            top: this.canvasSize.y - quadPanel.getComponent(Widget).top,
            left: 0,
            bottom: 0
        };
        this.quadPanelPos.left = this.quadPanelPos.right - quadPanel.getComponent(UITransform).contentSize.x;
        this.quadPanelPos.bottom = this.quadPanelPos.top - quadPanel.getComponent(UITransform).contentSize.y;
        this.panelPosBoard = this.quadPanelNode.getChildByPath('select2/posBg/clickPos').getComponent(Label);
        this.contourBg = director.getScene().getChildByPath('mainUI/InnerUI/ScatterNode/Contour');
        this.scatterController = director.getScene().getChildByPath('mainUI/InnerUI/ScatterNode').getComponent(ScatterController);
        // 计算显示select界面区域坐标
        const quadSelct = this.UICanvas.getChildByPath('InnerUI/ShowSelectVoxelScreen');
        this.quadShowSelect = {
            right: this.canvasSize.x - quadSelct.getComponent(Widget).right,
            bottom: quadSelct.getComponent(Widget).bottom,
            left: 0, 
            top: 0
        }
        this.quadShowSelect.left = this.quadShowSelect.right - quadSelct.getComponent(UITransform).contentSize.x;
        this.quadShowSelect.top = this.quadShowSelect.bottom + quadSelct.getComponent(UITransform).contentSize.y;

        // 初始化历史队列
        this.voxelDataHistory = new VoxelHistoryQueue(this.historyMaxLength);
        // this.historyBgGraph = this.HistoryBgGraphic.getComponent(Graphics);
        // this.innerHistoryGraph = this.InnerHistoryGraphic.getComponent(Graphics);        

        // 初始化体素，对每个体素列表预生成32 * 32 * 32个cube
        this.VoxelNodeSelect.setScale(new Vec3(voxelScale.Select, voxelScale.Select, voxelScale.Select));
        this.VoxelNodeEdit.setScale(new Vec3(voxelScale.Edit, voxelScale.Edit, voxelScale.Edit));
        
        // 体素文件读取HTML元素初始化
        this.voxelDownLoadLinkHTML = document.createElement("a");
        this.voxelReadHTML = document.createElement('input');
        this.voxelReadHTML.setAttribute('type', 'file');
        this.voxelReadHTML.addEventListener('change', (event) => {  
            console.log('file input!!');
            const file = (event.target as HTMLInputElement).files[0];
            const reader = new FileReader();  
            reader.onload = (e) => {  
                const fileData = e.target.result; 
                const vd = [new Vec3()];
                this.uploadVoxelToServer(vd);
            };  
            reader.readAsText(file);  

        }); 

        this.imageReadHTML = document.createElement('input');
        this.imageReadHTML.setAttribute('type', 'file');
        this.imageReadHTML.addEventListener('change', (event) => {
            const file = (event.target as HTMLInputElement).files[0];

            let formData = new FormData();  
            formData.append('image', file);  
            formData.append("name", file.name);
            console.log('send image');
        
            let xhr = new XMLHttpRequest();  
            xhr.open('POST', SERVER_HOST + RequestName.SendImage, true);  
            xhr.onload = () => {  
                if (xhr.status === 200) {  
                    // try {
                        const receiveData = JSON.parse(xhr.response);
                        const rawVoxelData = receiveData[1];  
                        // const emb = receiveData[0][1];
                     
                        const fileName = receiveData[0][0];   
                        const emb = receiveData[0][1][0];
                        for (let i = 0; i < emb.length; i++) {
                            emb[i] = parseFloat(emb[i]);
                        }
                        let voxelData: Vec3[] = [];
    
                        for (let x = 0; x < 32; x++) {
                            for (let y = 0; y < 32; y++) {
                                for (let z = 0; z < 32; z++) {
                                    if (rawVoxelData[z][y][x]) {
                                        voxelData.push(new Vec3(x - 16, y - 16, z - 16));
                                    }
                                }
                            }
                        }
    
                        console.log(receiveData[0][2][0].length)
                        /**@TODO 图片生成接口需要返回图片的image feature*/ 
                        const id = `create-${this.createNum++}`;
                        if (!this.voxelDataHistory.push(voxelData, id, fileName, emb, receiveData[0][2][0], -1)) {   // 如果队列满了则pop掉队首
                            this.voxelDataHistory.popHead();
                            this.voxelDataHistory.push(voxelData, id, fileName, emb, receiveData[0][2][0], -1);
                        }   
                        
                        this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                        this.onVoxelSelect(id, true);
                        // this.drawDetailInfoNode(emb);
                    // } catch (e) {
                    //     console.error('传送图片获取体素失败');
                    // }
                    
                }  
            };  
            xhr.send(formData);  
        });
        this.node.on(GET_VOXEL_FOR_EEGRAPH, this.onGetVoxelForEEGraph, this);

        if (this.isUseTestCase) {
            /************* test code *************/
            for (let i = 0; i < 1000; i++) { 3
                const typeStr = randomRangeInt(0, 10).toString();
                        
                if (!this.typeDict.has(typeStr)) {
                    this.typeDict.set(typeStr, this.typeDict.size);
                }
                const typeNum = this.typeDict.get(typeStr);
                this.data.push({
                    dataPos: new Vec2(randomRange(-10, 10), randomRange(-10, 10)),
                    screenPos: new Vec2(0, 0),
                    value: 0,
                    idx: i,
                    type: this.typeDict.get(typeStr),
                    name: i.toString()
                })
                if (this.type2Idx.has(typeNum))
                    this.type2Idx.get(typeNum).push(i);
                else
                    this.type2Idx.set(typeNum, [i]);

            }

            const scatterRange = {
                left: this.data[0].dataPos.x, 
                right: this.data[0].dataPos.x, 
                bottom: this.data[0].dataPos.y, 
                top: this.data[0].dataPos.y
            };

            this.data.forEach(value => {
                scatterRange.left = Math.min(scatterRange.left, value.dataPos.x);
                scatterRange.right = Math.max(scatterRange.right, value.dataPos.x);
                scatterRange.bottom = Math.min(scatterRange.bottom, value.dataPos.y);
                scatterRange.top = Math.max(scatterRange.top, value.dataPos.y);
            })
            this.scatterController.scatterRange = scatterRange;
            const toggleChildList = this.scatterController.togglesParentNode.children;
            toggleChildList[0].active = true;
            for (let i = 1; i <= this.typeDict.size; i++) {
                toggleChildList[i].active = true;
                const toggleSp = toggleChildList[i].getComponent(Sprite);
                toggleSp.color.fromHEX(type2Color[i - 1]);
                console.log(toggleSp.color);
            }
            this.scatterController.drawInitial();
            this.isInitialize = true;
            /************* test code *************/
        } else
            this.onInitializeButtonClick();

        this.drawContainerBg();
        this.DivideLineGraphic.strokeColor.fromHEX('#eeeeee');
        this.DivideLineGraphic.lineWidth = 2;
        this.DivideLineGraphic.moveTo(530, 720);
        this.DivideLineGraphic.lineTo(530, 0);
        this.DivideLineGraphic.moveTo(530, 320);
        this.DivideLineGraphic.lineTo(1280, 320);
        this.DivideLineGraphic.moveTo(790, 320);
        this.DivideLineGraphic.lineTo(790, 0);

        
        this.DivideLineGraphic.stroke();

    }

    onEnable () {
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);  
    }

    onDisable () {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    update(deltaTime: number) {

        if (this.isSnapShotReady !== SnapShotState.None) {
            if (this.isSnapShotReady === SnapShotState.wait1frame) {
                this.isSnapShotReady++;
            } else {
                this.node.emit(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotId);
                this.isSnapShotReady = SnapShotState.None;
            }
        }
    }

    public get isInitialize() {
        return this._isInitialize;
    }

    private set isInitialize(val: boolean) {
        if (!this._isInitialize)
            this._isInitialize = val;
    }

    // TODO:设置体素的颜色等?
    public createVoxel(): Node {
        const vc = instantiate(this.VoxelCube);
        vc.active = false;
        return vc;
    }

    private drawContainerBg() {
        // OutterUI history background
        // this.historyBgGraph.fillColor.fromHEX('#656565');
        // drawRoundRect(this.historyBgGraph, new Vec2(100, 210), 1080, 150, 50, true);
        // this.historyBgGraph.fill();

        // InnerUI history background
        // this.innerHistoryGraph.lineWidth = 3;
        // this.innerHistoryGraph.strokeColor.fromHEX('#aaaaaa');
        // drawRoundRect(this.innerHistoryGraph, new Vec2(-20, 240), 100, 570, 10, false);
        // this.innerHistoryGraph.stroke();

        // // InnerUI detail info background
        // this.innerHistoryGraph.fillColor.fromHEX('#eeeeee');
        // this.innerHistoryGraph.moveTo(100, -160);
        // this.innerHistoryGraph.lineTo(115, -175);
        // this.innerHistoryGraph.lineTo(275, -175);
        // this.innerHistoryGraph.lineTo(290, -160);
        // this.innerHistoryGraph.lineTo(290, 225);
        // this.innerHistoryGraph.lineTo(275, 240);
        // this.innerHistoryGraph.lineTo(115, 240);
        // this.innerHistoryGraph.lineTo(100, 225);
        // this.innerHistoryGraph.lineTo(100, -160);
        // this.innerHistoryGraph.arc(115, -160, 15, angle2radian(-90), angle2radian(-180), false);
        // this.innerHistoryGraph.arc(275, -160, 15, angle2radian(0), angle2radian(-90), false);
        // this.innerHistoryGraph.arc(275, 225, 15, angle2radian(90), angle2radian(0), false);
        // this.innerHistoryGraph.arc(115, 225, 15, angle2radian(180), angle2radian(90), false);
        // this.innerHistoryGraph.fill();
    }

    public onVoxelSelect(id: string, needSnapShot: boolean, snode: Node=null) {
        this.VoxelNodeSelect.setRotationFromEuler(new Vec3(30, 330, 330));
        let i = 0;
        const voxelData: Vec3[] = this.voxelDataHistory.getVoxelById(id);
        const childList = this.VoxelNodeSelect.children;
        for (; i < voxelData.length; i++) {
            if (i === childList.length) {
                const sv = this.createVoxel();
                this.VoxelNodeSelect.addChild(sv);
                // this.voxelList.Select.push(sv);
            } else if (i > childList.length) {
                console.error('SELECT记录的体素数量超过实际子节点体素数量！！');
            }
            const sv = childList[i];
            // sv.position = (new Vec3(voxelData[i].x, voxelData[i].y, voxelData[i].z)).multiplyScalar(voxelScale.Select);
            sv.position = voxelData[i];
            
            sv.active = true;
            const mr = (sv.getComponent(MeshRenderer) as RenderableComponent);
            mr.setMaterialInstance(this.voxelMatDefault, 0);
        }

        while (i < childList.length && childList[i].active) {
            childList[i++].active = false;
        }

        if (this.voxelDataHistory.isExist(this.curSelectVoxelId)) {
            this.voxelDataHistory.cancelSelect(this.curSelectVoxelId);
        }

        this.curSelectVoxelId = id;

        // 如果是选中历史队列中的snapshot节点需要显示选中框
        if (snode !== null) {
            this.voxelDataHistory.showSnapSelect(snode);
        }

        if (needSnapShot) {
            this.isSnapShotReady = SnapShotState.wait1frame;
            this.snapShotId = id;
        }
    }

    private snapShotVoxel = (id: string) => {
        const snapshot = new SpriteFrame();
        const rtData = this.selectRT.readPixels();
        
        const voxelTexture = new Texture2D();
        voxelTexture.reset({ width: this.selectRT.width, height: this.selectRT.height, format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 0 })
        voxelTexture.uploadData(rtData, 0, 0);
        voxelTexture.updateImage();
        snapshot.texture = voxelTexture;
        this.voxelDataHistory.setSnapShot(snapshot);
        this.curEENV?.setVoxelInfo(snapshot, id);
        this.curEENV = null;
    
        this.node.off(SNAPSHOT_FOR_NEW_VOXEL_EVENT);
    }

    public view2Voxel() {
        const snapshot = new SpriteFrame();
        const rtData = this.selectRT.readPixels();
        
        const voxelTexture = new Texture2D();
        voxelTexture.reset({ width: this.selectRT.width, height: this.selectRT.height, format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 0 })
        voxelTexture.uploadData(rtData, 0, 0);
        voxelTexture.updateImage();
        snapshot.texture = voxelTexture;
    }

    private keyDown(key: EventKeyboard) {
        if (key.keyCode === KeyCode.KEY_U) {
            // 显隐UI
            const innerUI = this.UICanvas.getChildByName('InnerUI');
            this.isInnerUI = !this.isInnerUI;
            innerUI.active = this.isInnerUI;
        } else if (this.isInnerUI) {
            if (key.keyCode === KeyCode.KEY_A) {
                const id = `blank${this.blankNum++}`;
                if (!this.voxelDataHistory.isExist(id)) {

                    if (this.voxelDataHistory.length() === this.historyMaxLength)
                        this.voxelDataHistory.popHead();
                    const vd = [];
                    // for (let i = randomRangeInt(100, 5000); i >= 0; i--)
                    //     vd.push(new Vec3(randomRangeInt(-32, 32), randomRangeInt(-32, 32), randomRangeInt(-32, 32)));
                    for (let x = -8; x < 8; x++) {
                        for (let y = -8; y < 8; y++) {
                            for (let z = -8; z < 8; z++) {
                                vd.push(new Vec3(x, y, z));
                            }
                        }
                    }
                    const emb = [0.046408578753471375,0.1299910843372345,-0.05709565803408623,-0.4654577374458313,0.9640616178512573,1.2251393795013428,0.42264729738235474,-0.1449238359928131,0.13472259044647217,0.08329255878925323,-0.4378288686275482,-0.4448590576648712,0.3434494733810425,1.2005075216293335,0.6205681562423706,0.1554761826992035,-1.525444746017456,-1.9303338527679443,0.2888311743736267,0.825538158416748,0.8960372805595398,-1.4977400302886963,-1.1900224685668945,0.4953117370605469,2.7216382026672363,-0.050605837255716324,1.1164931058883667,1.3104140758514404,-0.9651161432266235,3.166940927505493,-0.3273515999317169,4.66200065612793,0.8309621810913086,0.1482883095741272,-0.07999342679977417,0.47767794132232666,0.35074707865715027,-0.30998721718788147,3.3965556621551514,0.6455049514770508,-0.673679530620575,0.010111361742019653,0.23043528199195862,-0.3159293234348297,0.8093878626823425,0.36611905694007874,0.43059074878692627,1.238301157951355,-0.7439271211624146,0.46147727966308594,-0.24514058232307434,-0.23996128141880035,0.28146588802337646,5.5644917488098145,-2.2688663005828857,-0.0672692060470581,0.5803858041763306,-0.5518679022789001,0.5405962467193604,0.9395554661750793,1.0543742179870605,-0.79291832447052,0.3488030433654785,-4.642337799072266,-0.39394745230674744,0.1271403431892395,-3.359959602355957,0.3390505313873291,0.21817298233509064,0.17812618613243103,-0.04521254450082779,0.0630236342549324,1.1070332527160645,-0.0543753057718277,-0.5344977378845215,1.0041379928588867,0.04925447702407837,1.0052555799484253,0.026722528040409088,-2.53295636177063,0.5405471920967102,-0.022852113470435143,-0.5375044345855713,0.86555016040802,-0.31612154841423035,-0.17269670963287354,0.8462697267532349,-0.6180703639984131,-4.048862934112549,-0.6920191049575806,-0.09989648312330246,-0.274848073720932,-0.9751679301261902,-0.027049198746681213,0.6653702855110168,0.35132521390914917,-1.0255513191223145,0.9173023104667664,-0.21219174563884735,0.7127239108085632,-1.2450520992279053,-0.07957732677459717,-3.7841291427612305,0.4981483519077301,4.472257137298584,-0.7294455766677856,-1.9639827013015747,-0.10683143883943558,-5.8344316482543945,0.8349928855895996,0.48123201727867126,-0.011797439306974411,-0.24459730088710785,-2.6697514057159424,0.4365556836128235,1.1920667886734009,-0.18422842025756836,0.21733644604682922,-0.12541812658309937,-0.16774021089076996,-0.7357332110404968,1.0626137256622314,0.009034758433699608,0.1957768201828003,0.18625299632549286,-0.19347810745239258,-0.2231823205947876,0.743380069732666];
                    const clipFeature = new Array(512);
                    for (let i = 0; i < 512; i++) {
                        clipFeature[i] = randomRange(-1, 1);
                    }
                    console.log(emb.length);
                    this.voxelDataHistory.push(vd, id, id, emb, clipFeature, parseInt(id));
                    this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                    this.onVoxelSelect(id, true);
                }
            } else if (key.keyCode === KeyCode.DIGIT_1) {
                
                this.ScatterNode.active = true;
                this.ScatterImageNode.active = false;
                this.ScatterNode.getComponent(ScatterController).inistializeScatter();
            }  else if (key.keyCode === KeyCode.DIGIT_3) {
                this.ScatterNode.active = false;
                this.ScatterImageNode.active = true;
                this.ScatterImageNode.getComponent(ImageScatterController).drawImageScatter();
            }
        }
    }
 


    private onTouchStart(e: EventTouch) {
        if (this.isInnerUI) {
            const pos: Vec2 = e.touch.getUILocation();
            if (pos.x > this.quadPanelPos.left && pos.x < this.quadPanelPos.right && pos.y > this.quadPanelPos.bottom && pos.y < this.quadPanelPos.top) {
                this.clickState = ClickState.Panel;
            } else if (pos.x > this.quadShowSelect.left && pos.x < this.quadShowSelect.right && pos.y > this.quadShowSelect.bottom && pos.y < this.quadShowSelect.top) {
                this.clickState = ClickState.ShowSelect;
            }
        }
    }

    private onTouchMove(e: EventTouch) {
        if (this.isInnerUI) {              // ui交互事件
            const pos: Vec2 = e.touch.getUILocation();
            switch(this.clickState) {
                case ClickState.Panel:
                    const panelWidth = this.quadPanelPos.right - this.quadPanelPos.left
                    let uv: Vec2 = new Vec2((pos.x - this.quadPanelPos.left) / panelWidth, 
                        (pos.y - this.quadPanelPos.bottom) / panelWidth);   
                    uv.x = Math.max(0, Math.min(uv.x, 1));
                    uv.y = Math.max(0, Math.min(uv.y, 1));
                    const snNum = this.quadPanelNode.getComponent(QuadPanelGradient).snNum;
                    if (!this.panelPosBoard) {
                        this.panelPosBoard = this.quadPanelNode.getChildByPath('select2/clickPos').getComponent(Label);
                    }
                    
                    const touchIcon = this.quadPanelNode.getChildByPath('select2/touchIcon');
                    switch(snNum) {
                        case 2: {

                            this.panelClickPos = new Vec3(uv.x);
                            this.panelPosBoard.string = `k=${uv.x.toFixed(2)}`;
                            touchIcon.position = new Vec3(uv.x * panelWidth, 35, 0);
                            break;   
                        }
                        case 3: {
                            const triangleArea = (a: Vec2, b: Vec2, c: Vec2) => (0.5 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)));
                            const nodeA = new Vec2(0, 0);
                            const nodeB = new Vec2(1, 0);
                            const nodeC = new Vec2(0.5, 0.875);     // (√3)/2  ≈ 0.875
                            const areaABC = triangleArea(nodeA, nodeB, nodeC);
                            const areaClickBC = triangleArea(uv, nodeB, nodeC);
                            const areaClickCA = triangleArea(uv, nodeC, nodeA);
                            const areaClickAB = triangleArea(uv, nodeA, nodeB);

                            this.panelClickPos = new Vec3(areaClickBC / areaABC, areaClickCA / areaABC, areaClickAB / areaABC);
                            const sumxyz = this.panelClickPos.x + this.panelClickPos.y + this.panelClickPos.z;
                            assert(sumxyz >= 1 - 0.00001 && sumxyz <= 1 + 0.00001, 
                                `重心坐标计算错误 ${this.panelClickPos.x + this.panelClickPos.y + this.panelClickPos.z}`)
                            if (this.panelClickPos.x < 0) {
                                if (this.panelClickPos.y < 0) {
                                    this.panelClickPos = new Vec3(0, 0, 1);
                                } else if (this.panelClickPos.z < 0) {
                                    this.panelClickPos = new Vec3(0, 1, 0);
                                } else {
                                    this.panelClickPos.x = 0;
                                    const sumyz = this.panelClickPos.z + this.panelClickPos.y;
                                    this.panelClickPos.y /= sumyz;
                                    this.panelClickPos.z /= sumyz;
                                }
                            } else if (this.panelClickPos.y < 0) {
                                if (this.panelClickPos.z < 0) {
                                    this.panelClickPos = new Vec3(1, 0, 0);
                                } else {
                                    this.panelClickPos.y = 0;
                                    const sumxz = this.panelClickPos.x + this.panelClickPos.z;
                                    this.panelClickPos.x /= sumxz;
                                    this.panelClickPos.z /= sumxz;
                                }
                            } else if (this.panelClickPos.z < 0) {
                                this.panelClickPos.z = 0;
                                const sumxy = this.panelClickPos.x + this.panelClickPos.y;
                                this.panelClickPos.x /= sumxy;
                                this.panelClickPos.y /= sumxy;
                            }
                            this.panelPosBoard.string = `α=${this.panelClickPos.x.toFixed(2)}, β=${this.panelClickPos.y.toFixed(2)}, γ=${this.panelClickPos.z.toFixed(2)}`;
                            let barycentric = new Vec2();
                            barycentric.add(nodeA.multiplyScalar(this.panelClickPos.x));
                            barycentric.add(nodeB.multiplyScalar(this.panelClickPos.y));
                            barycentric.add(nodeC.multiplyScalar(this.panelClickPos.z));
                            touchIcon.position = new Vec3(barycentric.x * panelWidth, barycentric.y * panelWidth);
                            break;   
                        }
                        case 4: {
                            this.panelClickPos = new Vec3(uv.x, uv.y);
                            this.panelPosBoard.string = `x=${uv.x.toFixed(2)}, y=${uv.y.toFixed(2)}`;
                            touchIcon.position = new Vec3(uv.x * panelWidth, uv.y * panelWidth);
                            break;   
                        }
                    }
                    break;
                
                case ClickState.ShowSelect:
                    const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                    this.VoxelNodeSelect.rotate(Quat.fromEuler(new Quat(), -deltaMove.y, deltaMove.x, 0), 1);
                    break;
                
            }
        }
    }

    private onTouchEnd(e: EventTouch) {
        this.clickState = ClickState.None;
    }

    /*------------------------------------------- button触发事件 -------------------------------------------*/ 

    public onInitializeButtonClick() {    
        if (this.isInitialize)
            return;
        console.log('initializing');
        let xhr = new XMLHttpRequest();
        let url = SERVER_HOST + RequestName.InitializeOverview;
        
        xhr.open('GET', url, true);
        xhr.onreadystatechange = () => { // 当请求被发送到服务器时，我们需要执行一些动作  
            if (xhr.readyState === 4 && xhr.status === 200) { // 如果请求已完成，且响应状态码为200（即成功），则...  
                let response = JSON.parse(xhr.responseText); // 解析服务器响应的JSON数据  

                if (PREVIEW) {  // 将本次初始化数据保存到本地
                    // const textFileAsBlob = new Blob([xhr.responseText], { type: 'application/json' });
                    // this.voxelDownLoadLinkHTML.download = 'initializeData';
                    // if (window.webkitURL != null) {
                    //     this.voxelDownLoadLinkHTML.href = window.webkitURL.createObjectURL(textFileAsBlob);
                    // }
                    // this.voxelDownLoadLinkHTML.click();
                }
                
                if (PREVIEW)
                    console.log(response);

                let i = 0;
                const scatterRange = {
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    top: 0
                };
                response.forEach(d => {
                    // const typeStr = d[0].split(' ')[0];
                    // 不管type上是什么直接按照set统计，后续可以考虑保存type字符串打印在toggle下面
                    // const typeStr = d[1][1];
                    const typeStr = d[0];
                    
                    if (!this.typeDict.has(typeStr)) {
                        this.typeDict.set(typeStr, this.typeDict.size);
                    }
                    const typeNum = this.typeDict.get(typeStr);

                    const newDataPoint: DataPoint = {
                        dataPos: new Vec2(d[2][0][0], d[2][0][1]),
                        screenPos: new Vec2(0, 0),
                        value: 0,           // 待定
                        idx: i,
                        type: typeNum,
                        name: d[1],
                    }
                    console.log(newDataPoint.dataPos);
                    if (this.type2Idx.has(typeNum))
                        this.type2Idx.get(typeNum).push(i);
                    else 
                        this.type2Idx.set(typeNum, [i]);
                    
                    scatterRange.left = Math.min(scatterRange.left, newDataPoint.dataPos.x);
                    scatterRange.right = Math.max(scatterRange.right, newDataPoint.dataPos.x);
                    scatterRange.bottom = Math.min(scatterRange.bottom, newDataPoint.dataPos.y);
                    scatterRange.top = Math.max(scatterRange.top, newDataPoint.dataPos.y);
                    
                    this.data.push(newDataPoint);
                    i++;
                });
                this.scatterController.scatterRange = scatterRange;
                // 初始化toggles
                const toggleChildList = this.scatterController.togglesParentNode.children;
                toggleChildList[0].active = true;
                this.typeDict.forEach((value, key) => {
                    toggleChildList[value + 1].active = true;
                    toggleChildList[value + 1].name = key;
                });

                // 初始化散点图绘制
                
                this.scatterController.drawInitial();
                this.isInitialize = true;

                console.log('initializing finished')
            }  
        };  
        
        xhr.send();
    }

    private async waitUntilGetVoxelFnish() {
        return new Promise((resolve, reject) => {
            // 这里需要一个信号量以及一个事件来作等待，如果GET_VOXEL_FINISH_EVENT事件触发先于该函数执行，说明isGetVoxelFinished已经被置1，则返回；如果事件触发晚于该函数，则可通过监听触发事件返回；
            // 但如果promise中操作不是原子的话，依然存在一个情况导致阻塞，即：
            // waitUntilGetVoxelFnish先判断isGetVoxelFinished，
            // 然后onreadystatechange函数执行置1并触发GET_VOXEL_FINISH_EVENT，
            // 然后waitUntilGetVoxelFnish开始监听GET_VOXEL_FINISH_EVENT
            if (this.isGetVoxelFinished) {
                this.isGetVoxelFinished = false;
                resolve(null);
                return;
            }
            this.node.on(GET_VOXEL_FINISH_EVENT, () => {
                this.isGetVoxelFinished = false;
                resolve(null);
                this.node.off(GET_VOXEL_FINISH_EVENT);
            }, this);
        });
    }

    // id用来唯一标识这个体素
    // 调用此接口时思考一下id查重的问题
    // TODO：这里改成传回embedding，embedding在history里保存了，这样可以避免选的是自己生成的点
    private getVoxelFromServer(id: string, idx0: number, idx1: number = -1, idx2: number = -1, idx3: number = -1, xval: number = 0, yval: number = 0) {
        let xhr = new XMLHttpRequest();

        let url = SERVER_HOST + RequestName.GetVoxel + `/${idx0}-${idx1}-${idx2}-${idx3}/${xval.toFixed(3)}-${yval.toFixed(3)}`;
        
        xhr.open('GET', url, true);
        xhr.onreadystatechange = () => { 
            if (xhr.readyState === 4 && xhr.status === 200) { 
                const responseVoxel = JSON.parse(xhr.responseText);
                let rawVoxelData = responseVoxel[0];
                const emb = responseVoxel[1][0];
                for (let i = 0; i < emb.length; i++) {
                    emb[i] = parseFloat(emb[i]);
                }
                let voxelData: Vec3[] = [];

                for (let x = 0; x < 32; x++) {
                    for (let y = 0; y < 32; y++) {
                        for (let z = 0; z < 32; z++) {
                            if (rawVoxelData[z][y][x]) {
                                voxelData.push(new Vec3(x - 16, y - 16, z - 16));
                            }
                        }
                    }
                }
                if (!this.voxelDataHistory.push(voxelData, id, idx1 === -1 ? this.data[idx0].name : id, emb, responseVoxel[2][0], idx1 === -1 ? idx0 : -1)) {   // 如果队列满了则pop掉队首
                    this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push(voxelData, id, idx1 === -1 ? this.data[idx0].name : id, emb, responseVoxel[2][0], idx1 === -1 ? idx0 : -1);
                }   
                
                this.isGetVoxelFinished = true;
                this.node.emit(GET_VOXEL_FINISH_EVENT);
            }  
        };  

        xhr.send();
    }

    /**后端接受一个32*32*32的0 1矩阵 */
    public uploadVoxelToServer(voxelData: Vec3[]) {

        const xhr = new XMLHttpRequest();
        const url = SERVER_HOST + RequestName.UploadVoxel;
        const formData = new FormData();  
        formData.append('voxel', voxelData.toString());
        
        xhr.open('POST', url, true);
        xhr.onreadystatechange = () => { 
            if (xhr.readyState === 4 && xhr.status === 200) { 
                const emb = JSON.parse(xhr.response)[0];
                const id = `create-${this.createNum++}`;
                if (!this.voxelDataHistory.push(voxelData, id, id, emb, null, -1)) {
                    this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push(voxelData, id, id, emb, null, -1);
                }
                this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                this.onVoxelSelect(id, true);
            }  
        };
        xhr.send(formData);
    }

    public async onSingleGetVoxelButtonClick() {
        // TODO:这里的id最好还是用数据点的name
        const id = this.scatterController.getSelectListHead();     
        const needSnapShot = !this.voxelDataHistory.isExist(id.toString());
        if (needSnapShot) {
            this.getVoxelFromServer(id.toString(), id);
            await this.waitUntilGetVoxelFnish();
            this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
        }
        this.onVoxelSelect(id.toString(), needSnapShot);
    }

    public onGetVoxelForEEGraph(msg: EegMsg) {
        console.log(msg.emb);
        let formData = new FormData();  
        formData.append("embedding", msg.emb.toString());
        this.curEENV = msg.eenv;
    
        let xhr = new XMLHttpRequest();  
        xhr.open('POST', SERVER_HOST + RequestName.GetVoxelByEmbedding, true);  
        xhr.onload = () => {  
            if (xhr.status === 200) {  
                const receiveData = JSON.parse(xhr.response);
                const rawVoxelData = receiveData;  
                // 最好解决一下上传prompt重名的问题
                let voxelData: Vec3[] = [];

                for (let x = 0; x < 32; x++) {
                    for (let y = 0; y < 32; y++) {
                        for (let z = 0; z < 32; z++) {
                            if (rawVoxelData[z][y][x]) {
                                voxelData.push(new Vec3(x - 16, y - 16, z - 16));
                            }
                        }
                    }
                }

                const id = `create-${this.createNum++}`;
                // TODO: 这里需要思考当用户将自定义体素上传后加入整体数据列表后，如何修改voxelDataHistory中对应项的idx
                // 如果这里是插值生成一个原总数据列表中没有的体素点，默认不加入总数据列表中，idx赋为-1
                if (!this.voxelDataHistory.push(voxelData, id, id, msg.emb, msg.feature, -1)) {   // 如果队列满了则pop掉队首
                    this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push(voxelData, id, id, msg.emb, msg.feature, -1);
                }   
                
                this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                this.onVoxelSelect(id, true);
            }  
        };  
        xhr.send(formData);  
    }

    public onGetVoxelByTextButtonClick() {
        const textInputNode = director.getScene().getChildByPath('mainUI/InnerUI/textInput/TEXT_LABEL');
        const inStr = textInputNode.getComponent(Label).string;
        console.log(inStr);
        let formData = new FormData();  
        formData.append("prompt", inStr);
    
        let xhr = new XMLHttpRequest();  
        xhr.open('POST', SERVER_HOST + RequestName.SendPrompt, true);  
        xhr.onload = () => {  
            if (xhr.status === 200) {  
                const receiveData = JSON.parse(xhr.response);
                const fileName = receiveData[0];
                const rawVoxelData = receiveData[1];  
                const emb = receiveData[2][0];
                for (let i = 0; i < emb.length; i++) {
                    emb[i] = parseFloat(emb[i]);
                }
                // 最好解决一下上传prompt重名的问题
                let voxelData: Vec3[] = [];

                for (let x = 0; x < 32; x++) {
                    for (let y = 0; y < 32; y++) {
                        for (let z = 0; z < 32; z++) {
                            if (rawVoxelData[z][y][x]) {
                                voxelData.push(new Vec3(x - 16, y - 16, z - 16));
                            }
                        }
                    }
                }

                console.log(receiveData[3][0].length)
                /**@TODO text需要返回feature */
                const id = `create-${this.createNum++}`;
                if (!this.voxelDataHistory.push(voxelData, id, fileName, emb, receiveData[3][0], -1)) {   // 如果队列满了则pop掉队首
                    this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push(voxelData, id, fileName, emb, receiveData[3][0], -1);
                }   
                
                this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                this.onVoxelSelect(id, true);
            }  
        };  
        xhr.send(formData);  
    }



    // TODO: panel上的button点击之后如果sprite无引用要destroy掉，但是暂时没有找到安全的destroy的方法
    public onSingleAddToPanelButtonClick() {
        const childList = this.quadPanelNode.children;
        const gradientComp = this.quadPanelNode.getComponent(QuadPanelGradient);
        for (let i = 0; i < 3; i++) {
            if (this.curSelectVoxelId === childList[i].getComponent(PanelNode).vid)
                return;
        }
        let i = 0;
        for (; i < 3; i++) {
            if (!childList[i].active) {
                const qsp = childList[i].getComponent(Sprite);
                qsp.spriteFrame = this.voxelDataHistory.getSnapShotById(this.curSelectVoxelId);
                if (qsp.spriteFrame) {
                    childList[i].active = true;
                    childList[i].getComponent(PanelNode).vid = this.curSelectVoxelId;
                    console.log('name:' + this.voxelDataHistory.getNameById(this.curSelectVoxelId));
                    childList[i].getComponent(PanelNode).nameLabel.string = this.voxelDataHistory.getNameById(this.curSelectVoxelId);
                    gradientComp.snNum++;
                    break;
                } else
                    return;
            }
        }

        if (gradientComp.snNum >= 2) 
            this.quadPanelNode.getChildByName('select2').active = true;
    }


    public async onInterpolationButtonClick() {
        // this.panelClickPos.xy
        const childList = this.quadPanelNode.children;
        const getIdx = (i: number) => {
            return this.voxelDataHistory.getIdxInDataById(childList[i].getComponent(PanelNode).vid)
        }
        const idxList = [
            childList[0].active ? getIdx(0) : -1,
            childList[1].active ? getIdx(1) : -1,
            childList[2].active ? getIdx(2) : -1,
            childList[3].active ? getIdx(3) : -1];
        const id = this.data[idxList[0]].name + '-' 
            + (idxList[1] === -1 ? '' : (this.data[idxList[1]].name + '-')) 
            + (idxList[2] === -1 ? '' : (this.data[idxList[2]].name + '-')) 
            + (idxList[3] === -1 ? '' : (this.data[idxList[3]].name + '-')) 
            + this.panelClickPos.x.toString() + '-' + this.panelClickPos.y.toString();
        const needSnapShot = !this.voxelDataHistory.isExist(id);
        if (needSnapShot) {
            this.getVoxelFromServer(id, idxList[0], idxList[1], idxList[2], idxList[3], this.panelClickPos.x, this.panelClickPos.y);
            await this.waitUntilGetVoxelFnish();
            this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
        }
        this.onVoxelSelect(id, needSnapShot);
    }

    public onContourButtonClick() {
        // TODO: 要做显示当前数据点类别的颜色映射显示，以及提供选择查看不同分类的等高线
        if (this.isInitialize) {
            if (this.contourBg.active) {
                this.contourBg.active = false;
                return;
            }

            if (!this.scatterController.isSampleChange) {
                this.contourBg.active = true;
                return;
            }
            const xhr = new XMLHttpRequest();

            const url = SERVER_HOST + RequestName.GetContour;
            const formData = new FormData();  
            formData.append('sample', this.scatterController.downSampleList.toString());
            formData.append('centerType', this.scatterController.curToggle.toString());
            
            xhr.open('POST', url, true);
            xhr.onreadystatechange = () => { 
                if (xhr.readyState === 4 && xhr.status === 200) { 
                    const response = JSON.parse(xhr.response);
                    const encoded_image = 'data:image/png;base64,' + response.image;
                    this.contourData = response.levelInfo;
                    this.contourData.reverse();
                    // TODO:　让后端接上这个levelinfo
                    // for (let i = 0; i < levelInfo.length; i++) {
                    //     const col = new Color(levelInfo[i][0][0], levelInfo[i][0][1], levelInfo[i][0][2]);
                    //     const zVal = levelInfo[i][1];
                    // }

                    const image = new Image();
                    image.onload = () => {
                        const img = new ImageAsset(image);
                        const texture = new Texture2D();
                        texture.image = img;
                        const spf = new SpriteFrame();
                        spf.texture = texture;
                        this.contourBg.getComponent(Sprite).spriteFrame = spf;
                        this.contourBg.getComponent(UITransform).contentSize.set(580, 580);
                        this.contourBg.active = true;
                        this.scatterController.isSampleChange = false;
                    }
                    image.src = encoded_image;

                    this.drawDetailInfoContour();
                }  
            };
            xhr.send(formData);
        } 
    }


    public onLoadVoxel() {
        this.voxelReadHTML.click();
    }

    public onSendImage() {
        this.imageReadHTML.click();
    }

    public onSaveVoxelToFile(type: string) {
        const voxelData: Vec3[] = this.voxelDataHistory.getVoxelById(this.curSelectVoxelId);
        const jsonStr = JSON.stringify(voxelData);
        const textFileAsBlob = new Blob([jsonStr], { type: 'application/json' });
        this.voxelDownLoadLinkHTML.download = 'voxel' + (type === 'select' ? this.curSelectVoxelId : this.curEditVoxelId);
        if (window.webkitURL != null) {
            this.voxelDownLoadLinkHTML.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        this.voxelDownLoadLinkHTML.click();
    }


    

    private drawDetailInfoContour() {
        this.detailInfoNode.destroyAllChildren();
        const diGraph = this.detailInfoNode.getComponent(Graphics);
        diGraph.clear();

        const levelLabelNode = new Node();
        const levelLabel = levelLabelNode.addComponent(Label);
        const uiTrans = levelLabelNode.getComponent(UITransform);
        uiTrans.setAnchorPoint(0, 0.5);
        levelLabel.string = 'Contour Level';
        levelLabel.color.fromHEX('#333333');
        levelLabel.fontSize = 17;
        levelLabel.isItalic = true;
        this.detailInfoNode.addChild(levelLabelNode);
        levelLabelNode.setPosition(25, -15);
        levelLabelNode.layer = this.detailInfoNode.layer;
        
        const lineHeight = 360 / this.contourData.length;   
        diGraph.lineWidth = 3;
        for (let i = 0, y = -30 - lineHeight * 0.5; i < this.contourData.length; i++, y -= lineHeight) {
            diGraph.strokeColor = new Color(this.contourData[i][0][0] * 255, this.contourData[i][0][1] * 255, this.contourData[i][0][2] * 255);
            diGraph.moveTo(20, y);
            diGraph.lineTo(60, y);
            diGraph.stroke();
            const levelLabelNode = new Node();
            const levelLabel = levelLabelNode.addComponent(Label);
            const uiTrans = levelLabelNode.getComponent(UITransform);
            uiTrans.setAnchorPoint(0, 0.5);
            levelLabel.string = this.contourData[i][1].toFixed(2);
            levelLabel.color.fromHEX('#333333');
            levelLabel.fontSize = Math.min(15, lineHeight - 3);
            levelLabel.isItalic = true;
            this.detailInfoNode.addChild(levelLabelNode);
            levelLabelNode.setPosition(63, y);
            levelLabelNode.layer = this.detailInfoNode.layer;
        }
        diGraph.strokeColor.fromHEX('#555555');
        diGraph.moveTo(20, -10);
        diGraph.lineTo(20, -390);
        diGraph.stroke();
    }

    public onDetailInfoSelectClick(e: Event, customEventData: string) {
        console.log(customEventData);
        // switch(customEventData) {
        //     case 'node':
        //         this.drawDetailInfoNode(this.voxelDataHistory.getEmbById(this.curSelectVoxelId));
        //         break;
        //     case 'contour':
        //         this.drawDetailInfoContour();
        //         break;
        // }
    }

    public onSwitchScatterorImageButtonClick() {
        this.ScatterNode.active = !this.ScatterNode.active;
        this.ScatterImageNode.active = !this.ScatterImageNode.active;

        if (this.ScatterNode.active) {
            this.ScatterNode.getComponent(ScatterController).inistializeScatter();
        } else if (this.ScatterImageNode.active) {
            this.ScatterImageNode.getComponent(ImageScatterController).drawImageScatter();
        }
    }

    public clearSnapSelect() {
        this.voxelDataHistory.clearSnapSelect();
    }

    /* 外部访问主控模块属性函数 */
    public getVoxelEmbeddingById(id: string) {
        return this.voxelDataHistory.getEmbById(id);
    }
    
    public getClipEmbeddingById(id: string) {
        return this.voxelDataHistory.getClipFeatureById(id);
    }

    /**如果存在返回在数组中下标，不存在返回-1 */
    public isExistHistoryList(id: string) {
        return this.voxelDataHistory.isExist(id);
    }

    public getRawVoxelDataById(id: string) {
        return this.voxelDataHistory.getVoxelById(id);
    }

    public getVoxelSnapShotById(id: string) {
        return this.voxelDataHistory.getSnapShotById(id);
    }

    public getHistoryLength() {
        return this.voxelDataHistory.length();
    }

    public isOutUI() {
        return !this.isInnerUI;
    }

    public get curSelectVoxelId() {
        return this._curSelectVoxelId;
    }

    private set curSelectVoxelId(val: string) {
        this._curSelectVoxelId = val;
    }
}
