import { _decorator, Button, Color, Component, director, EventHandler, EventKeyboard, EventTouch, Graphics, ImageAsset, Input, input, instantiate, KeyCode, Label, lerp, Node, Overflow, Prefab, Quat, quat, random, randomRange, randomRangeInt, renderer, RenderTexture, SpringJoint2D, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, ValueType, Vec2, Vec3, Vec4, Widget } from 'cc';
// import `native` from 'cc'
import { PREVIEW, NATIVE } from 'cc/env';
import { Queue, VoxelHistoryQueue } from './Utils/Queue';
import { SnapShotNode } from './SnapShotNode';
import { LockAsync } from './Utils/Lock';
import { PanelNode } from './PanelNode';
import { DataPoint, RectSize, VoxelBuffer, SelectingType, SnapShotState, voxelScale, type2Color, RequestName, angle2radian, ClickState } from './Utils/Utils';
const { ccclass, property } = _decorator;

const SERVER_HOST = 'http://127.0.0.1:5000';    // 注意这里端口可能被占用
const GET_VOXEL_FINISH_EVENT = 'getvoxel-voxel-finish';
const SNAPSHOT_FOR_NEW_VOXEL_EVENT = 'snapshot-for-new-voxel';
export const DRAW_EDIT_VOXEL_EVENT = 'draw-edit-voxel';

// TODO: innerui绘制历史页，绘制生成体素页

@ccclass('MainController')
export class MainController extends Component {

    /******************* 可外部编辑参数 *******************/
    @property()
    public readonly historyMaxLength: number = 20;

    @property({ type: Vec4, tooltip: '显示散点图区域x, y, z, w=>left, right, bottom, top' })
    public readonly scatterRectVec4: Vec4 = new Vec4(20, 620, 60, 660);

    @property({ tooltip: '坐标轴刻度数量' })
    public scaleSegNum: number = 10;

    @property({ tooltip: '一行/列分块数量，根据数据点数量动态变化' })
    public readonly tileNum: number = 10;

    
    /******************* 场景数据 *******************/
    @property(Node)
    public readonly AxisGraphic: Node = null;

    @property(Node)
    public readonly ScaleGraphic: Node = null;

    @property(Node)
    public readonly ScatterGraphic: Node = null;

    @property({ type: Node, tooltip: '下挂载选中的点创建的高亮图片节点' })
    public readonly SelectGraphic: Node = null;

    @property(Node)
    public readonly HistoryBgGraphic: Node = null;

    @property(Node)
    public readonly InnerHistoryGraphic: Node = null;

    @property(Node)
    public readonly UICanvas: Node = null;

    @property(Prefab)
    public readonly SelectNode: Prefab = null;

    @property(Node)
    public readonly SelectSingleButtons: Node = null;

    @property(Node)
    public readonly SelectMultiButtons: Node = null;

    @property(Node)
    public readonly SelectRangeButtons: Node = null;

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

    private data: DataPoint[] = [];
    private dataRatio: number = 1;
    private typeDict: Map<string, number> = new Map();
    private pointTree: DataPoint[][][] = [];    // pointTree的分块不随坐标轴刻度变化而变化，始终为10 * 10
    private canvasSize: Vec2 = new Vec2(0);
    private axisGraph: Graphics;         // 绘制坐标轴（只需绘制一次）
    private scaleGraph: Graphics;       // 坐标轴刻度绘制（提供调整接口）
    private scatterGraph: Graphics;     // 散点图绘制（框选提供重绘接口）
    private selectGraph: Graphics;      // 选中区域绘制
    private historyBgGraph: Graphics;       // 外UI历史选中列表
    private innerHistoryGraph: Graphics;    // 内UI历史选中列表
    private contourBg: Node;          // 散点图下等高线图
    private scatterRange: RectSize; // x-min, x-max, y-min, y-max
    private scatterWidth: number;
    private scatterHeight: number;
    private isInnerUI: boolean = true;
    // private selectNodeList: Node[] = [];
    private selectDataList: number[] = []   //  记录本次选中的点在原数据点列表中的下标
    private quadPanelPos: RectSize;
    private quadShowSelect: RectSize;
    // TODO: 这个voxelList完全没有存在的必要啊，直接用两个节点的children就可以了
    // private voxelList: VoxelBuffer = {
    //     Select: [],
    //     Edit: []
    // }
    private isGetVoxelFinished: boolean = false;
    private voxelDataHistory: VoxelHistoryQueue;
    private panelPosBoardX: Label = null;
    private panelPosBoardY: Label = null;
    private scatterRect: RectSize;
    private axisLength: number;
    private tileLength: number;
    private voxelReadHTML: HTMLInputElement = null;
    private voxelDownLoadLinkHTML: HTMLAnchorElement = null;
    private imageReadHTML: HTMLInputElement = null;

    // 交互数据
    private isInitialize: boolean = false;
    private clickPos: Vec2 = new Vec2(0);
    private selectMovingPos: Vec2 =  new Vec2(0);
    private isMove: boolean = false;
    private isSelectCtrl: boolean = false;
    private selectType: SelectingType = SelectingType.None;
    private isSnapShotReady: SnapShotState = 0;
    private snapShotId: string = '';
    private panelClickPos: Vec2 = new Vec2(0);
    // private isSelect: boolean = false;
    // private isPanel: boolean = false;
    // private isRotateSelectVoxel: boolean = false;
    private clickState: ClickState = 0;
    private curSelectVoxelId: string = '';  //  当前innerUI显示在select区域的体素id
    private curEditVoxelId: string = '';    //  当亲outUI显示在编辑区域的体素id 
    // private drawEditLock: LockAsync = new LockAsync();

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
        this.panelPosBoardX = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPosX').getComponent(Label);
        this.panelPosBoardY = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPosY').getComponent(Label);
        this.contourBg = director.getScene().getChildByPath('mainUI/InnerUI/ScatterNode/Contour');

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

        // 初始化绘图界面
        this.axisGraph = this.AxisGraphic.getComponent(Graphics);
        this.scaleGraph = this.ScaleGraphic.getComponent(Graphics);
        this.scatterGraph = this.ScatterGraphic.getComponent(Graphics);
        this.selectGraph = this.SelectGraphic.getComponent(Graphics);
        this.historyBgGraph = this.HistoryBgGraphic.getComponent(Graphics);
        this.innerHistoryGraph = this.InnerHistoryGraphic.getComponent(Graphics);
        this.scatterRect = {
            left: Math.min(this.scatterRectVec4.x, this.scatterRectVec4.y),
            right: Math.max(this.scatterRectVec4.x, this.scatterRectVec4.y),
            bottom: Math.min(this.scatterRectVec4.z, this.scatterRectVec4.w),
            top: Math.max(this.scatterRectVec4.z, this.scatterRectVec4.w),
        }
        this.axisLength = this.scatterRect.right - this.scatterRect.left;
        this.tileLength = this.axisLength / this.tileNum;
        

        this.selectGraph.lineWidth = 1;
        this.selectGraph.strokeColor.fromHEX('0099aa');
        this.selectGraph.fillColor = new Color(0, 200, 200, 80);

        // 初始化体素，对每个体素列表预生成32 * 32 * 32个cube
        this.VoxelNodeSelect.setScale(new Vec3(voxelScale.Select, voxelScale.Select, voxelScale.Select));
        this.VoxelNodeEdit.setScale(new Vec3(voxelScale.Edit, voxelScale.Edit, voxelScale.Edit));
        // for (let i = 32 * 32 * 32; i >= 0; i--) {
        //     const sv = this.createVoxel();
        //     this.VoxelNodeSelect.addChild(sv);
            
        //     const ev = this.createVoxel();
        //     this.VoxelNodeEdit.addChild(ev);
        // }
        
        // 体素文件读取HTML元素初始化
        this.voxelDownLoadLinkHTML = document.createElement("a");
        this.voxelReadHTML = document.createElement('input');
        this.voxelReadHTML.setAttribute('type', 'file');
        this.voxelReadHTML.addEventListener('change', (event) => {  
            console.log('file input!!');
            const file = (event.target as HTMLInputElement).files[0]
            console.log(file);  
            const reader = new FileReader();  
            reader.onload = (e) => {  
                const fileData = e.target.result; 
                console.log(fileData);
                const vd = [new Vec3()];
                this.sendVoxelToServer(vd);
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
                    try {
                        const receiveData = JSON.parse(xhr.response);
                        const rawVoxelData = receiveData[1];  
                        const fileName = receiveData[0][0];
                        console.log(receiveData);
                        console.log(fileName);  
                        console.log(rawVoxelData);  
                        let voxelData: Vec3[] = [];
    
                        for (let x = 0; x < 64; x++) {
                            for (let y = 0; y < 64; y++) {
                                for (let z = 0; z < 64; z++) {
                                    if (rawVoxelData[z][y][x]) {
                                        voxelData.push(new Vec3(x - 32, y - 32, z - 32));
                                    }
                                }
                            }
                        }
    
                        // TODO: 这里需要思考当用户将自定义体素上传后加入整体数据列表后，如何修改voxelDataHistory中对应项的idx
                        // 如果这里是插值生成一个原总数据列表中没有的体素点，默认不加入总数据列表中，idx赋为-1
                        if (!this.voxelDataHistory.push(voxelData, fileName, -1)) {   // 如果队列满了则pop掉队首
                            this.voxelDataHistory.popHead();
                            this.voxelDataHistory.push(voxelData, fileName, -1);
                        }   
                        
                        this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                        this.renderVoxelSelect(fileName, true);
                    } catch (e) {
                        console.error('传送图片获取体素失败');
                    }
                    
                }  
            };  
            xhr.send(formData);  
        });

        /************* test code *************/
        for (let i = 0; i < 1000; i++) {
            this.data.push({
                dataPos: new Vec2(randomRange(-10, 10), randomRange(-10, 10)),
                screenPos: new Vec2(0, 0),
                value: 0,
                idx: i,
                type: randomRangeInt(0, 10),
                name: i.toString()
            })
        }

        if (this.data.length > 0) {
            this.scatterRange = {
                left: this.data[0].dataPos.x, 
                right: this.data[0].dataPos.x, 
                bottom: this.data[0].dataPos.y, 
                top: this.data[0].dataPos.y
            };
        }
        this.data.forEach(value => {
            this.scatterRange.left = Math.min(this.scatterRange.left, value.dataPos.x);
            this.scatterRange.right = Math.max(this.scatterRange.right, value.dataPos.x);
            this.scatterRange.bottom = Math.min(this.scatterRange.bottom, value.dataPos.y);
            this.scatterRange.top = Math.max(this.scatterRange.top, value.dataPos.y);
        })
        this.drawAxis(this.scatterRect);
        this.drawAxisScale(this.scatterRect, this.scatterRange);
        this.drawScatter(this.scatterRect, this.scatterRange);
        this.isInitialize = true;
        /************* test code *************/
        this.drawHistoryBg();

    }

    onEnable () {
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.KEY_PRESSING, this.keyPressing, this);
        input.on(Input.EventType.KEY_UP, this.keyUp, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);  
    }

    onDisable () {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.off(Input.EventType.KEY_PRESSING, this.keyPressing, this);
        input.off(Input.EventType.KEY_UP, this.keyUp, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    update(deltaTime: number) {
        if (this.isInitialize && this.clickState === ClickState.Scatter && this.isMove && !this.isSelectCtrl) {
            this.selectGraph.clear();
            this.selectGraph.moveTo(this.clickPos.x + this.scatterRect.left, this.clickPos.y + this.scatterRect.bottom);
            this.selectGraph.lineTo(this.selectMovingPos.x, this.clickPos.y + this.scatterRect.bottom);
            this.selectGraph.lineTo(this.selectMovingPos.x, this.selectMovingPos.y);
            this.selectGraph.lineTo(this.clickPos.x + this.scatterRect.left, this.selectMovingPos.y);
            this.selectGraph.lineTo(this.clickPos.x + this.scatterRect.left, this.clickPos.y + this.scatterRect.bottom);
            this.selectGraph.fill();
            this.selectGraph.stroke();
        }

        if (this.isSnapShotReady !== SnapShotState.None) {
            if (this.isSnapShotReady === SnapShotState.wait1frame) {
                this.isSnapShotReady++;
            } else {
                this.node.emit(SNAPSHOT_FOR_NEW_VOXEL_EVENT, { id: this.snapShotId });
                this.isSnapShotReady = SnapShotState.None;
            }
        }
    }

    // TODO:设置体素的颜色等?
    public createVoxel(): Node {
        const vc = instantiate(this.VoxelCube);
        vc.active = false;
        return vc;
    }

    private drawHistoryBg() {
        // OutterUI history background
        this.historyBgGraph.fillColor.fromHEX('656565');
        this.historyBgGraph.moveTo(150, 210);
        this.historyBgGraph.lineTo(1130, 210);
        this.historyBgGraph.lineTo(1180, 160);
        this.historyBgGraph.lineTo(1180, 110);
        this.historyBgGraph.lineTo(1130, 60);
        this.historyBgGraph.lineTo(150, 60);
        this.historyBgGraph.lineTo(100, 110);
        this.historyBgGraph.lineTo(100, 160);
        this.historyBgGraph.lineTo(150, 210);
        this.historyBgGraph.arc(1130, 160, 50, angle2radian(90), angle2radian(0), false);
        this.historyBgGraph.arc(1130, 110, 50, angle2radian(0), angle2radian(-90), false);
        this.historyBgGraph.arc(150, 110, 50, angle2radian(-90), angle2radian(-180), false);
        this.historyBgGraph.arc(150, 160, 50, angle2radian(-180), angle2radian(-270), false);
        this.historyBgGraph.fill();

        // InnerUI history background
        this.innerHistoryGraph.fillColor.fromHEX('656565');
        this.innerHistoryGraph.moveTo(-20, -300);
        this.innerHistoryGraph.lineTo(10, -330);
        this.innerHistoryGraph.lineTo(50, -330);
        this.innerHistoryGraph.lineTo(80, -300);
        this.innerHistoryGraph.lineTo(80, 210);
        this.innerHistoryGraph.lineTo(50, 240);
        this.innerHistoryGraph.lineTo(10, 240);
        this.innerHistoryGraph.lineTo(-20, 210);
        this.innerHistoryGraph.lineTo(-20, -300);
        this.innerHistoryGraph.arc(10, -300, 30, angle2radian(-90), angle2radian(-180), false);
        this.innerHistoryGraph.arc(50, -300, 30, angle2radian(0), angle2radian(-90), false);
        this.innerHistoryGraph.arc(50, 210, 30, angle2radian(90), angle2radian(0), false);
        this.innerHistoryGraph.arc(10, 210, 30, angle2radian(180), angle2radian(90), false);
        this.innerHistoryGraph.fill();
    }

   

    // TODO：限制renderRect必须为正方形
    private drawAxis(renderRect: RectSize) {
        if (renderRect.right - renderRect.left != renderRect.top - renderRect.bottom) {
            console.error('坐标轴范围不等！');
            return;
        }
        const originPos = new Vec2(lerp(renderRect.left, renderRect.right, 0.5), lerp(renderRect.bottom, renderRect.top, 0.5));

        this.axisGraph.lineWidth = 2;
        this.axisGraph.strokeColor.fromHEX('#eeeeee');
        // x-axis
        this.axisGraph.moveTo(renderRect.left, originPos.y);
        this.axisGraph.lineTo(renderRect.right, originPos.y);
        this.axisGraph.lineTo(renderRect.right - 10, originPos.y + 5);
        this.axisGraph.moveTo(renderRect.right - 10, originPos.y - 5);
        this.axisGraph.lineTo(renderRect.right, originPos.y);

        // y-axis
        this.axisGraph.moveTo(originPos.x, renderRect.bottom);
        this.axisGraph.lineTo(originPos.x, renderRect.top);
        this.axisGraph.lineTo(originPos.x - 5, renderRect.top - 10);
        this.axisGraph.moveTo(originPos.x, renderRect.top);
        this.axisGraph.lineTo(originPos.x + 5, renderRect.top - 10);
        this.axisGraph.stroke();
    }

    private drawAxisScale(renderRect: RectSize, sr: RectSize) {
        this.ScaleGraphic.destroyAllChildren();
        const originPos = new Vec2(lerp(renderRect.left, renderRect.right, 0.5), lerp(renderRect.bottom, renderRect.top, 0.5));
        
        this.scaleGraph.lineWidth = 2;
        this.scaleGraph.strokeColor.fromHEX('#eeeeee');
        // origin-label
        const originLabel = new Node();
        const sl = originLabel.addComponent(Label);
        this.ScaleGraphic.addChild(originLabel);
        sl.string = `(${((sr.left + sr.right) * 0.5).toFixed(1)}, ${((sr.top + sr.bottom) * 0.5).toFixed(1)})`;
        sl.fontSize = 10;
        sl.lineHeight = sl.fontSize;
        sl.color.fromHEX('#eeeeee');
        originLabel.setPosition(new Vec3(originPos.x, originPos.y - 10, 0));
        originLabel.layer = this.ScaleGraphic.layer;

        const scaleLength = (renderRect.right - renderRect.left) / this.scaleSegNum;
    
        let scaleLabelListX = [];
        let scaleLabelListY = [];
        for (let xpos = renderRect.left + scaleLength, ypos = renderRect.bottom + scaleLength, i = 0;
                 i < this.scaleSegNum - 1; i++, xpos += scaleLength, ypos += scaleLength) {
            if (i === ((this.scaleSegNum - 2) / 2))
                continue;
            scaleLabelListX.push(xpos);
            scaleLabelListY.push(ypos);
        }
        
        for (let i = 0; i < scaleLabelListX.length; i++) {
            this.scaleGraph.moveTo(scaleLabelListX[i], originPos.y - 5);
            this.scaleGraph.lineTo(scaleLabelListX[i], originPos.y + 5);
            this.scaleGraph.moveTo(originPos.x - 5, scaleLabelListY[i]);
            this.scaleGraph.lineTo(originPos.x + 5, scaleLabelListY[i]);
            const scaleLabelX = new Node();
            const scaleLabelY = new Node();
            const slx = scaleLabelX.addComponent(Label);
            const sly = scaleLabelY.addComponent(Label);
            this.ScaleGraphic.addChild(scaleLabelX);
            this.ScaleGraphic.addChild(scaleLabelY);
            slx.string = lerp(sr.left, sr.right, (scaleLabelListX[i] - renderRect.left) / this.axisLength).toFixed(2).toString();   

            sly.string = lerp(sr.bottom, sr.top, (scaleLabelListY[i] - renderRect.bottom) / this.axisLength).toFixed(2).toString();   
            slx.fontSize = 10;
            sly.fontSize = 10;
            slx.lineHeight = 10;
            sly.lineHeight = 10;
            slx.color.fromHEX('#eeeeee');
            sly.color.fromHEX('#eeeeee');
            scaleLabelX.setPosition(new Vec3(scaleLabelListX[i], originPos.y - 10, 0));
            scaleLabelY.setPosition(new Vec3(originPos.x - 20, scaleLabelListY[i], 0));
            scaleLabelX.layer = this.ScaleGraphic.layer;
            scaleLabelY.layer = this.ScaleGraphic.layer;
        }

        this.scaleGraph.stroke();
    }

    private drawScatter(renderRect: RectSize, sr: RectSize) {
        this.scatterGraph.lineWidth = 0;
        this.scatterWidth = sr.right - sr.left;
        this.scatterHeight = sr.top - sr.bottom;

        for (let i = 0; i < this.tileNum; i++) {
            this.pointTree[i] = [];
            for (let j = 0; j < this.tileNum; j++) {
                this.pointTree[i][j] = [];
            }
        }

        const height = Math.abs(renderRect.top - renderRect.bottom);
        const width = height;

        for (let i = 0; i < this.data.length; i++) {
            const d = this.data[i];
            d.screenPos = new Vec2((d.dataPos.x - sr.left) * height / this.scatterWidth, 
                (d.dataPos.y - sr.bottom) * width / this.scatterHeight), // 缩放到0-width屏幕像素空间

            this.pointTree[Math.min(Math.floor(d.screenPos.x / this.tileLength), this.tileNum - 1)][Math.min(Math.floor(d.screenPos.y / this.tileLength), this.tileNum - 1)].push(d);
            
            this.scatterGraph.fillColor.fromHEX(type2Color[d.type]);
            this.scatterGraph.circle(d.screenPos.x + renderRect.left, d.screenPos.y + renderRect.bottom, 2);
            this.scatterGraph.fill();
            this.scatterGraph.stroke();
        }
    }

    private drawScatterIndex(renderRect: RectSize, sr: RectSize, sampleIdxList: number[]) {
        this.scatterGraph.lineWidth = 0;
        this.scatterWidth = sr.right - sr.left;
        this.scatterHeight = sr.top - sr.bottom;

        for (let i = 0; i < this.tileNum; i++) {
            this.pointTree[i] = [];
            for (let j = 0; j < this.tileNum; j++) {
                this.pointTree[i][j] = [];
            }
        }

        const height = Math.abs(renderRect.top - renderRect.bottom);
        const width = height;

        for (let i = 0; i < sampleIdxList.length; i++) {
            const d = this.data[sampleIdxList[i]];
            d.screenPos = new Vec2((d.dataPos.x - sr.left) * height / this.scatterWidth, 
                (d.dataPos.y - sr.bottom) * width / this.scatterHeight), // 缩放到0-width屏幕像素空间

            this.pointTree[Math.min(Math.floor(d.screenPos.x / this.tileLength), this.tileNum - 1)][Math.min(Math.floor(d.screenPos.y / this.tileLength), this.tileNum - 1)].push(d);
            
            this.scatterGraph.fillColor.fromHEX(type2Color[d.type]);
            this.scatterGraph.circle(d.screenPos.x + renderRect.left, d.screenPos.y + renderRect.bottom, 2);
            this.scatterGraph.fill();
            this.scatterGraph.stroke();
        }
    }

 

    // 标识当前
    public renderVoxelSelect(id: string, needSnapShot: boolean) {
        this.VoxelNodeSelect.setRotationFromEuler(new Vec3(0, 0, 0));
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
        }

        while (i < childList.length && childList[i].active) {
            childList[i++].active = false;
        }

        this.curSelectVoxelId = id;
        if (needSnapShot) {
            this.isSnapShotReady = SnapShotState.wait1frame;
            this.snapShotId = id;
        }
    }

    private snapShotVoxel = (msg) => {
        console.log('shnap shot id is ' + msg.id);
        const snapshot = new SpriteFrame();
        const rtData = this.selectRT.readPixels();
        
        console.log(rtData);
        console.log(this.selectRT.width);
        console.log(this.selectRT.height);
        const voxelTexture = new Texture2D();
        voxelTexture.reset({ width: this.selectRT.width, height: this.selectRT.height, format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 0 })
        voxelTexture.uploadData(rtData, 0, 0);
        voxelTexture.updateImage();
        snapshot.texture = voxelTexture;
        this.voxelDataHistory.setSnapShot(snapshot);
    
        this.node.off(SNAPSHOT_FOR_NEW_VOXEL_EVENT);
    }

    public getHistoryLength() {
        return this.voxelDataHistory.length();
    }

    public isOutUI() {
        return !this.isInnerUI;
    }

    private keyDown(key: EventKeyboard) {
        if (key.keyCode === KeyCode.KEY_U) {
            // 显隐UI
            const innerUI = this.UICanvas.getChildByName('InnerUI');
            this.isInnerUI = !this.isInnerUI;
            innerUI.active = this.isInnerUI;
        } else if (this.isInnerUI) {
            if (key.keyCode === KeyCode.CTRL_LEFT && this.clickState === ClickState.None && this.selectType != SelectingType.Single && this.selectType != SelectingType.Range) {
                // 按住左ctrl多次选点
                this.isSelectCtrl = true;
            }
            // TODO:test code!!连上服务器测试没问题就删掉
            else if (key.keyCode === KeyCode.KEY_A) {
                const id = randomRangeInt(0, 10000).toString();
                if (this.voxelDataHistory.isExist(id) === -1) {
                    if (this.voxelDataHistory.length() === this.historyMaxLength)
                        this.voxelDataHistory.popHead();
                    const vd = [];
                    // for (let i = randomRangeInt(100, 5000); i >= 0; i--)
                    //     vd.push(new Vec3(randomRangeInt(-32, 32), randomRangeInt(-32, 32), randomRangeInt(-32, 32)));
                    if (random() < 0.5) {
                        for (let x = -8; x < 8; x++) {
                            for (let y = -8; y < 8; y++) {
                                for (let z = -8; z < 8; z++) {
                                    vd.push(new Vec3(x, y, z));
                                }
                            }
                        }
                    } else {
                        for (let x = -20; x < -10; x++) {
                            for (let y = -20; y < -10; y++) {
                                for (let z = -20; z < -10; z++) {
                                    vd.push(new Vec3(x, y, z));
                                }
                            }
                        }
                    }
                    this.voxelDataHistory.push(vd, id, parseInt(id));
                    this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
                    this.renderVoxelSelect(id, true);
                }
            }
        } 

    }

    private keyPressing(key: EventKeyboard) {
        // if (key.keyCode === KeyCode.CTRL_LEFT) {
        // }
    }

    private keyUp(key: EventKeyboard) {
        if (key.keyCode === KeyCode.CTRL_LEFT) {
            this.isSelectCtrl = false;
        }
    }
 
    private distanceVec2(v1: Vec2, v2: Vec2) {
      const n1: number = v2.x - v1.x;
      const n2: number = v2.y - v1.y;
      return Math.sqrt(n1 * n1 + n2 * n2);
    }

    private onTouchStart(e: EventTouch) {
        
        if (this.isInnerUI) {
            const pos: Vec2 = e.touch.getUILocation();
            if (pos.x > this.scatterRect.left && pos.x < this.scatterRect.right && pos.y > this.scatterRect.bottom && pos.y < this.scatterRect.top) {
                this.clickState = ClickState.Scatter;
                pos.subtract2f(this.scatterRect.left, this.scatterRect.bottom);
                this.clickPos = pos;

                if (this.selectType != SelectingType.Multi || !this.isSelectCtrl) {
                    this.selectType = SelectingType.None;
                    this.SelectMultiButtons.active = false;
                    this.SelectRangeButtons.active = false;
                    this.SelectSingleButtons.active = false;
                }
                // 这里也把数据点清空
                if (!this.isSelectCtrl) {
                    this.SelectGraphic.destroyAllChildren();
                    while (!this.isSelectCtrl && this.selectDataList.length > 0) {
                        this.selectDataList.pop();
                    } 
                }
            
            } else if (pos.x > this.quadPanelPos.left && pos.x < this.quadPanelPos.right && pos.y > this.quadPanelPos.bottom && pos.y < this.quadPanelPos.top) {
                this.clickState = ClickState.Panel;
            } else if (pos.x > this.quadShowSelect.left && pos.x < this.quadShowSelect.right && pos.y > this.quadShowSelect.bottom && pos.y < this.quadShowSelect.top) {
                this.clickState = ClickState.ShowSelect;
            }
        }
        
    }

    private onTouchMove(e: EventTouch) {
        
        if (this.isInnerUI) {              // ui交互事件
            const pos: Vec2 = e.touch.getUILocation();
            this.isMove = true;
            switch(this.clickState) {
                case ClickState.Scatter: 
                    this.selectMovingPos = pos;
                    break;

                case ClickState.Panel:
                    const panelWidth = (this.quadPanelPos.right - this.quadPanelPos.left);
                    let uv: Vec2 = new Vec2((pos.x - this.quadPanelPos.left) / panelWidth, 
                        (pos.y - this.quadPanelPos.bottom) / panelWidth);
                    uv.x = Math.max(0, Math.min(uv.x, 1));
                    uv.y = Math.max(0, Math.min(uv.y, 1));
                    this.panelClickPos = uv;
                    if (!this.panelPosBoardX || !this.panelPosBoardY) {
                        this.panelPosBoardX = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPosX').getComponent(Label);
                        this.panelPosBoardY = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPosY').getComponent(Label);
                    }
                    this.panelPosBoardX.string = `x=${uv.x}`;
                    this.panelPosBoardY.string = `y=${uv.y}`;
                    const touchIcon = this.quadPanelNode.getChildByName('touchIcon');
                    touchIcon.position = new Vec3(uv.x * panelWidth, uv.y * panelWidth, 0);
                    break;
                
                case ClickState.ShowSelect:
                    const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                    this.VoxelNodeSelect.rotate(Quat.fromEuler(new Quat(), -deltaMove.y, deltaMove.x, 0), 1);
                    break;
                
            }
        }
    }

    private onTouchEnd(e: EventTouch) {
        if (this.isInnerUI) {
            const pos: Vec2 = e.touch.getUILocation();
            if (this.clickState === ClickState.Scatter) {
                if (this.isMove && !this.isSelectCtrl) {    // 框选
                    pos.subtract2f(this.scatterRect.left, this.scatterRect.bottom);
                    pos.x = Math.min(Math.max(0, pos.x), this.axisLength);
                    pos.y = Math.min(Math.max(0, pos.y), this.axisLength);
                    const selectRange: RectSize = {
                        left: Math.min(pos.x, this.clickPos.x),
                        right: Math.max(pos.x, this.clickPos.x),
                        bottom: Math.min(pos.y, this.clickPos.y),
                        top: Math.max(pos.y, this.clickPos.y),
                    }
                    const selectZone: RectSize = {
                        left: Math.floor(selectRange.left / this.tileLength),
                        right: Math.min(Math.floor(selectRange.right / this.tileLength), this.tileNum - 1),
                        bottom: Math.floor(selectRange.bottom / this.tileLength),
                        top: Math.min(Math.floor(selectRange.top / this.tileLength), this.tileNum - 1),
                    }
                    for (let x = selectZone.left; x <= selectZone.right; x++) {
                        for (let y = selectZone.bottom; y <= selectZone.top; y++) {
                            if (x == selectZone.left || x == selectZone.right || y == selectZone.bottom || y == selectZone.top) {
                                const pointList = this.pointTree[x][y];
                                for (let i = 0; i < pointList.length; i++) {
                                    const pointPos = pointList[i].screenPos;
                                    if (pointPos.x >= selectRange.left && pointPos.x <= selectRange.right && pointPos.y >= selectRange.bottom && pointPos.y <= selectRange.top) {
                                        const selectNode = instantiate(this.SelectNode);
                                        this.ScatterGraphic.addChild(selectNode);
                                        selectNode.setPosition(new Vec3(pointPos.x + this.scatterRect.left, pointPos.y + this.scatterRect.bottom, 0));
                                        // this.selectNodeList.push(selectNode);
                                        this.SelectGraphic.addChild(selectNode);
                                        this.selectDataList.push(pointList[i].idx);
                                    }   
                                }
                            } else {
                                const pointList = this.pointTree[x][y];
                                for (let i = 0; i < pointList.length; i++) {
                                    const selectNode = instantiate(this.SelectNode);
                                    this.ScatterGraphic.addChild(selectNode);
                                    selectNode.setPosition(new Vec3(pointList[i].screenPos.x + this.scatterRect.left, pointList[i].screenPos.y + this.scatterRect.bottom, 0));
                                    // this.selectNodeList.push(selectNode);
                                    this.SelectGraphic.addChild(selectNode);
                                    this.selectDataList.push(pointList[i].idx);
                                    
                                }
                            }
                        }
                    }
                    if (this.selectDataList.length > 0) {
                        if (this.selectDataList.length === 1) {
                            this.selectType = SelectingType.Single;
                            this.SelectSingleButtons.active = true;
                        }
                        else {
                            // TODO: 框选重绘scatter
                            this.selectType = SelectingType.Range;
                            this.SelectRangeButtons.active = true;
                        }
                    }
                } else {    // 点选
                    const tileX = Math.floor((pos.x - this.scatterRect.left) / this.tileLength);
                    const tileY = Math.floor((pos.y - this.scatterRect.bottom) / this.tileLength);
                    const pointList = this.pointTree[tileX][tileY];
                    pos.subtract2f(this.scatterRect.left, this.scatterRect.bottom);
                    for (let i = 0; i < pointList.length; i++) {
                        if (this.distanceVec2(pos, pointList[i].screenPos) < 3) {
                            
                            const selectNode = instantiate(this.SelectNode);
                            this.ScatterGraphic.addChild(selectNode);
                            selectNode.setPosition(new Vec3(pointList[i].screenPos.x + this.scatterRect.left, pointList[i].screenPos.y + this.scatterRect.bottom, 0));
                            // this.selectNodeList.push(selectNode);
                            this.SelectGraphic.addChild(selectNode);
                            this.selectDataList.push(pointList[i].idx);
                            
                            break;
                        }
                    }
                    if (this.selectDataList.length > 0) {
                        if (!this.isSelectCtrl || this.selectDataList.length === 1) {
                            this.selectType = SelectingType.Single;
                            this.SelectSingleButtons.active = true;
                        } else {
                            this.selectType = SelectingType.Multi;
                            this.SelectMultiButtons.active = true;      
                        }
                    }
                    // else
                } 
            } else if (this.clickState === ClickState.Panel) {
                const panelWidth = this.quadPanelPos.right - this.quadPanelPos.left
                let uv: Vec2 = new Vec2((pos.x - this.quadPanelPos.left) / panelWidth, 
                    (pos.y - this.quadPanelPos.bottom) / panelWidth);
                uv.x = Math.max(0, Math.min(uv.x, 1));
                uv.y = Math.max(0, Math.min(uv.y, 1));
                this.panelClickPos = uv;
                if (!this.panelPosBoardX || !this.panelPosBoardY) {
                    this.panelPosBoardX = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPosX').getComponent(Label);
                    this.panelPosBoardY = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPosY').getComponent(Label);
                }
                this.panelPosBoardX.string = `x=${uv.x}`;
                this.panelPosBoardY.string = `y=${uv.y}`;
                const touchIcon = this.quadPanelNode.getChildByName('touchIcon');
                touchIcon.position = new Vec3(uv.x * panelWidth, uv.y * panelWidth, 0);
                
            }
        }

        this.isMove = false;
        // this.isSelect = false;
        // this.isPanel = false;
        // this.isRotateSelectVoxel = false;
        this.clickState = ClickState.None;
        this.selectGraph.clear();
    }

    /*------------------------------------------- button触发事件 -------------------------------------------*/ 

    public onInitializeButtonClick() {    
        if (this.isInitialize)
            return;
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
                this.scatterRange = {
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    top: 0
                };
                response.forEach(d => {
                    const typeStr = d[0].split(' ')[0];
                    
                    if (!this.typeDict.has(typeStr)) {
                        this.typeDict.set(typeStr, this.typeDict.size);
                    }

                    const newDataPoint: DataPoint = {
                        dataPos: new Vec2(d[1][0][0], d[1][0][1]),
                        screenPos: new Vec2(0, 0),
                        value: 0,           // 待定
                        idx: i,
                        // type: this.typeDict.get(typeStr),
                        type: d[1][1],
                        name: d[0],
                    }
                    
                    this.scatterRange.left = Math.min(this.scatterRange.left, newDataPoint.dataPos.x);
                    this.scatterRange.right = Math.max(this.scatterRange.right, newDataPoint.dataPos.x);
                    this.scatterRange.bottom = Math.min(this.scatterRange.bottom, newDataPoint.dataPos.y);
                    this.scatterRange.top = Math.max(this.scatterRange.top, newDataPoint.dataPos.y);
                    
                    this.data.push(newDataPoint);
                    i++;
                });
                this.scatterGraph.clear();
                this.drawAxis(this.scatterRect);
                this.drawAxisScale(this.scatterRect, this.scatterRange);
                this.drawScatter(this.scatterRect, this.scatterRange);
                this.isInitialize = true;
                
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
    private getVoxelFromServer(id: string, idx0: number, idx1: number = -1, idx2: number = -1, idx3: number = -1, xval: number = 0, yval: number = 0) {
        let xhr = new XMLHttpRequest();

        let url = SERVER_HOST + RequestName.GetVoxel + `/${idx0}-${idx1}-${idx2}-${idx3}/${xval}${xval == 0 ? '.0' : ''}-${yval}${yval == 0 ? '.0' : ''}`;
        
        xhr.open('GET', url, true);
        xhr.onreadystatechange = () => { 
            if (xhr.readyState === 4 && xhr.status === 200) { 
                const rawVoxelData = JSON.parse(xhr.responseText);
                let voxelData: Vec3[] = [];
                
                // if (PREVIEW) 
                //     console.log(rawVoxelData); 

                for (let x = 0; x < 64; x++) {
                    for (let y = 0; y < 64; y++) {
                        for (let z = 0; z < 64; z++) {
                            if (rawVoxelData[z][y][x]) {
                                voxelData.push(new Vec3(x - 32, y - 32, z - 32));
                            }
                        }
                    }
                }

                // TODO: 这里需要思考当用户将自定义体素上传后加入整体数据列表后，如何修改voxelDataHistory中对应项的idx
                // 如果这里是插值生成一个原总数据列表中没有的体素点，默认不加入总数据列表中，idx赋为-1
                if (!this.voxelDataHistory.push(voxelData, id, idx1 === -1 ? idx0 : -1)) {   // 如果队列满了则pop掉队首
                    this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push(voxelData, id, idx1 === -1 ? idx0 : -1);
                }   
                
                this.isGetVoxelFinished = true;
                this.node.emit(GET_VOXEL_FINISH_EVENT);
            }  
        };  

        xhr.send();
    }

    public async onSingleGetVoxelButtonClick() {
        // TODO:这里的id最好还是用数据点的name
        // this.data[this.selectDataList[0]].name;
        const id = this.selectDataList[0].toString();
        const needSnapShot = this.voxelDataHistory.isExist(id) === -1;
        if (needSnapShot) {
            this.getVoxelFromServer(id, this.selectDataList[0]);
            await this.waitUntilGetVoxelFnish();
            console.log('get voxel finished');
            this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
        }
        this.renderVoxelSelect(id, needSnapShot);
    }



    // TODO: panel上的button点击之后如果sprite无引用要destroy掉，但是暂时没有找到安全的destroy的方法
    public onSingleAddToPanelButtonClick() {
        const childList = this.quadPanelNode.children;
        console.log(this.curSelectVoxelId);
        for (let i = 0; i < 4; i++) {
            if (this.curSelectVoxelId === childList[i].getComponent(PanelNode).vid)
                return;
        }
        console.log('next');
        let i = 0;
        for (; i < 4; i++) {
            if (!childList[i].active) {
                const qsp = childList[i].getComponent(Sprite);
                qsp.spriteFrame = this.voxelDataHistory.getSnapShotById(this.curSelectVoxelId);
                if (qsp.spriteFrame) {
                    childList[i].active = true;
                    childList[i].getComponent(PanelNode).vid = this.curSelectVoxelId;
                    console.log('set sp');
                    break;
                } else
                    return;
            }
        }

        if (i > 4) {
            childList[4].getComponent(Label).string = "请先点击图片删除一个节点";
            childList[4].active = true;
            this.scheduleOnce(() => {
                childList[4].active = false;
            }, 2000);
        }
    }

    public isExistHistoryList(id: string) {
        return this.voxelDataHistory.isExist(id);
    }

    public getRawVoxelData(id: string) {
        return this.voxelDataHistory.getVoxelById(id);
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
        console.log('idxlist = ' + idxList);
        console.log('total data length: ' + this.data.length);
        console.log(getIdx(0));
        console.log(getIdx(1));
        const id = this.data[idxList[0]].name + '-' 
            + (idxList[1] === -1 ? '' : (this.data[idxList[1]].name + '-')) 
            + (idxList[2] === -1 ? '' : (this.data[idxList[2]].name + '-')) 
            + (idxList[3] === -1 ? '' : (this.data[idxList[3]].name + '-')) 
            + this.panelClickPos.x.toString() + '-' + this.panelClickPos.y.toString();
        
        const needSnapShot = this.voxelDataHistory.isExist(id) === -1;
        if (needSnapShot) {
            this.getVoxelFromServer(id, idxList[0], idxList[1], idxList[2], idxList[3], this.panelClickPos.x, this.panelClickPos.y);
            await this.waitUntilGetVoxelFnish();
            console.log('get voxel finished');
            this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
        }
        this.renderVoxelSelect(id, needSnapShot);
    }

    private clearAllStates() {
        this.scaleGraph.clear();
        this.scatterGraph.clear();
        this.selectType = SelectingType.None;
        this.SelectMultiButtons.active = false;
        this.SelectRangeButtons.active = false;
        this.SelectSingleButtons.active = false;
        this.SelectGraphic.destroyAllChildren();
        while (!this.isSelectCtrl && this.selectDataList.length > 0) {
            this.selectDataList.pop();
        } 
    }

    public onChangeSlide(progress: number) {
        const dNum = Math.ceil(this.data.length * progress);
        let downSampleList = new Array(dNum);
        if (this.dataRatio != progress) {
            this.clearAllStates();
            this.dataRatio = progress;
            if (progress < 1) {

                for (let i = 0; i < dNum; i++)
                    downSampleList[i] = Math.floor(randomRange(0, 0.99999999) * this.data.length);
                let sr: RectSize = {
                    left: this.data[downSampleList[0]].dataPos.x,
                    right: this.data[downSampleList[0]].dataPos.x,
                    bottom: this.data[downSampleList[0]].dataPos.y,
                    top: this.data[downSampleList[0]].dataPos.y
                }
                downSampleList.forEach(idx => {
                    if (idx >= this.data.length)
                        console.error('out of data!!!');
                    sr.left = Math.min(sr.left, this.data[idx].dataPos.x);
                    sr.right = Math.max(sr.right, this.data[idx].dataPos.x);
                    sr.bottom = Math.min(sr.bottom, this.data[idx].dataPos.y);
                    sr.top = Math.max(sr.top, this.data[idx].dataPos.y);
                })
                this.drawAxisScale(this.scatterRect, sr);
                this.drawScatterIndex(this.scatterRect, sr, downSampleList);
            } else {
                this.drawAxisScale(this.scatterRect, this.scatterRange);
                this.drawScatter(this.scatterRect, this.scatterRange);
            }
        }

    }

    public sampleRangeScatter() {
        let sampleList = new Array(this.selectDataList.length);
        for (let i = 0; i < this.selectDataList.length; i++) {
            sampleList[i] = this.selectDataList[i];
        }
        this.clearAllStates();
        this.dataRatio = -1; // 这里修改为0，返回全部采样点时直接调用onChangeSlide传入原来的progress就行

        let sr: RectSize = {
            left: this.data[sampleList[0]].dataPos.x,
            right: this.data[sampleList[0]].dataPos.x,
            bottom: this.data[sampleList[0]].dataPos.y,
            top: this.data[sampleList[0]].dataPos.y
        }
        sampleList.forEach(idx => {
            if (idx >= this.data.length)
                console.error('out of data!!!');
            sr.left = Math.min(sr.left, this.data[idx].dataPos.x);
            sr.right = Math.max(sr.right, this.data[idx].dataPos.x);
            sr.bottom = Math.min(sr.bottom, this.data[idx].dataPos.y);
            sr.top = Math.max(sr.top, this.data[idx].dataPos.y);
        })
        this.drawAxisScale(this.scatterRect, sr);
        this.drawScatterIndex(this.scatterRect, sr, sampleList);
    }

    public onLoadVoxel() {
        this.voxelReadHTML.click();
    }

    public onSendImage() {
        this.imageReadHTML.click();
    }

    private sendVoxelToServer(voxel: Vec3[]) {
        return 0;
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

    public onContourButtonClick() {
        if (this.isInitialize) {
            this.contourBg.active = !this.contourBg.active;
            if (!this.contourBg.active)
                return;
            let xhr = new XMLHttpRequest();

            let url = SERVER_HOST + RequestName.GetContour;
            
            xhr.open('GET', url, true);
            xhr.onreadystatechange = () => { 
                if (xhr.readyState === 4 && xhr.status === 200) { 
                    const data = JSON.parse(xhr.response);
                    const encoded_image = 'data:image/png;base64,' + data.image;

                    const image = new Image();
                    image.onload = () => {
                        const img = new ImageAsset(image);
                        const texture = new Texture2D();
                        texture.image = img;
                        const spf = new SpriteFrame();
                        spf.texture = texture;
                        this.contourBg.getComponent(Sprite).spriteFrame = spf;
                        this.contourBg.getComponent(UITransform).contentSize.set(580, 580);
                    }
                    image.src = encoded_image;
                }  
            };
            xhr.send();
        }
        
    }

    public onShowScatterButtonClick() {
        this.ScatterGraphic.active = !this.ScatterGraphic.active;
    }
}
