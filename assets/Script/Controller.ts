import { _decorator, Button, Component, director, EventHandler, EventKeyboard, EventTouch, Graphics, ImageAsset, Input, input, instantiate, KeyCode, Label, lerp, Node, Prefab, random, randomRange, randomRangeInt, RenderTexture, SpringJoint2D, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, ValueType, Vec2, Vec3, Vec4, Widget } from 'cc';
import { PREVIEW } from 'cc/env';
import { Queue, VoxelHistoryQueue } from './Utils/Queue';
import { SnapShotNode } from './SnapShotNode';
import { LockAsync } from './Utils/Lock';
import { PanelNode } from './PanelNode';
const { ccclass, property } = _decorator;

const SERVER_HOST = 'http://127.0.0.1:5001';    // 注意这里端口可能被占用
const GET_VOXEL_FINISH_EVENT = 'getvoxel-voxel-finish';
const SNAPSHOT_FOR_NEW_VOXEL_EVENT = 'snapshot-for-new-voxel';
export const DRAW_EDIT_VOXEL_EVENT = 'draw-edit-voxel';

type DataPoint = {
    pos: Vec2;
    value: number;
    idx: number;    // 映射到原数组中的序号
    type: number;
    name: string;
    img: Texture2D;
};

type rectSize = {
    left: number,
    right: number, 
    bottom: number, 
    top: number
};

type VoxelBuffer = {
    Select: Node[],
    Edit: Node[]
};

enum RequestName {
    InitializeOverview = '/initialize_overview',
    GetVoxel = '/get_voxel',
};

enum SelectingType {
    None = 0,
    Single = 1,
    Range = 2,
    Multi = 3
};

enum SnapShotState {
    None = 0,   
    wait1frame = 1,     // 下一帧截图
    ready = 2,
};

const type2Color = [
    'ff0000',
    '00ff00',
    '0000ff',
    'ffff00',
    'ff00ff',
    '00ffff',
    'f0f000',
    'f000f0',
    '00f0f0',
    '88f088',
    'f08888',
    '8888f0',
    'bcaf6e',
    'cdfcae',
    '7ac6ed',
    '34acds',
    '9fe4a5',
    'ba4390',
    '7384fa',
    '1188ee',
    'ee8811',
]

const voxelScale = {
    Select: 0.05,
    Edit: 0.1
}
// const voxelScale
// const voxelScale
// const voxelScale
export function angle2radian(angle: number): number {
    return angle * Math.PI * 0.005555556;   // angle * pi / 180(0.005555556 = 1 / 179.999985600)
}

@ccclass('MainController')
export class MainController extends Component {

    @property(Node)
    public ScatterGraphic: Node = null;

    @property(Node)
    public SelectGraphic: Node = null;

    @property(Node)
    public HistoryBgGraphic: Node = null;

    @property(Node)
    public HistoryBgMask: Node = null;

    @property(Node)
    public UICanvas: Node = null;

    @property(Prefab)
    public SelectNode: Prefab = null;

    @property(Node)
    public SelectSingleButtons: Node = null;

    @property(Node)
    public SelectMultiButtons: Node = null;

    @property(Node)
    public SelectRangeButtons: Node = null;

    @property(Prefab)
    public VoxelCube: Prefab = null;

    @property({ type: Node, tooltip: '挂载inner ui体素数据的节点' })
    public VoxelNodeSelect: Node = null;

    @property({ type: Node, tooltip: '挂载世界空间可编辑体素数据的节点' })
    public VoxelNodeEdit: Node = null;

    @property(RenderTexture)
    public selectRT: RenderTexture = null;

    @property()
    public historyMaxLength: number = 20;

    @property(SpriteFrame)
    public FUFUSF: SpriteFrame = null;

    @property(Node)
    public quadPanelNode: Node = null;


    private data: DataPoint[] = [];
    private typeDict: Map<string, number> = new Map();
    private pointTree: DataPoint[][][] = [];
    private canvasSize: Vec2 = new Vec2(0);
    private scatterGraph: Graphics;
    private selectGraph: Graphics;
    private historyBgGraph: Graphics;
    private scatterRange: rectSize; // x-min, x-max, y-min, y-max
    private scatterWidth: number;
    private scatterHeight: number;
    private isInnerUI: boolean = true;
    private selectNodeList: Node[] = [];
    private selectDataList: number[] = []
    private quadPanelPos: rectSize;
    private voxelList: VoxelBuffer = {
        Select: [],
        Edit: []
    }
    private isGetVoxelFinished: boolean = false;
    private voxelDataHistory: VoxelHistoryQueue;
    private panelPosBoard: Label = null;

    // 交互数据
    private isInitialize: boolean = false;
    private selectPos: Vec2 = new Vec2(0);
    private selectMovingPos: Vec2 =  new Vec2(0);
    private isMove: boolean = false;
    private isSelect: boolean = false;
    private isSelectCtrl: boolean = false;
    private selectType: SelectingType = SelectingType.None;
    private isSnapShotReady: SnapShotState = 0;
    private snapShotId: string = '';
    public drawEditVoxelIdBuffer: string = '';
    private panelClickPos: Vec2 = new Vec2(0);
    // private drawEditLock: LockAsync = new LockAsync();

    // private isSelectingOne: boolean = false;
    // private isSelectingRange: boolean = false;
    // private isSelectingMulti: boolean = false;

    start() {
        // Initialize
        this.canvasSize.x = this.UICanvas.getComponent(UITransform).contentSize.x;
        this.canvasSize.y = this.UICanvas.getComponent(UITransform).contentSize.y;
        const quadPanel = this.UICanvas.getChildByName('InnerUI').getChildByName('quadPanel');
        this.quadPanelPos = {
            right: this.canvasSize.x - quadPanel.getComponent(Widget).right,
            top: this.canvasSize.y - quadPanel.getComponent(Widget).top,
            left: 0,
            bottom: 0
        };
        this.quadPanelPos.left = this.quadPanelPos.right - quadPanel.getComponent(UITransform).contentSize.x;
        this.quadPanelPos.bottom = this.quadPanelPos.top - quadPanel.getComponent(UITransform).contentSize.y;
        this.voxelDataHistory = new VoxelHistoryQueue(this.historyMaxLength, this.HistoryBgMask);
        this.panelPosBoard = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPos').getComponent(Label);
        
        // test code
        // for (let i = 0; i < 1000; i++) {
        //     this.data.push(new Vec3(randomRange(-10, 10), randomRange(-10, 10), randomRange(-10, 10)));
        // }

        // if (this.data.length > 0) {
        //     this.scatterRange = {
        //         left: this.data[0].x, 
        //         right: this.data[0].x, 
        //         bottom: this.data[0].y, 
        //         top: this.data[0].y
        //     };
        // }
        // this.data.forEach(value => {
        //     this.scatterRange.left = Math.min(this.scatterRange.left, value.x);
        //     this.scatterRange.right = Math.max(this.scatterRange.right, value.x);
        //     this.scatterRange.bottom = Math.min(this.scatterRange.bottom, value.y);
        //     this.scatterRange.top = Math.max(this.scatterRange.top, value.y);
        // })

        // this.drawAxis();
        // this.drawScatter();

        this.scatterGraph = this.ScatterGraphic.getComponent(Graphics);
        this.selectGraph = this.SelectGraphic.getComponent(Graphics);
        this.historyBgGraph = this.HistoryBgGraphic.getComponent(Graphics);

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

        this.selectGraph.lineWidth = 2;
        this.selectGraph.strokeColor.fromHEX('ee0000');

        // 对每个体素列表预生成32 * 32 * 32个cube
        for (let i = 32 * 32 * 32; i >= 0; i--) {
            const sv = this.createVoxel(voxelScale.Select);
            this.voxelList.Select.push(sv);
            this.VoxelNodeSelect.addChild(sv);
            
            const ev = this.createVoxel(voxelScale.Edit);
            this.voxelList.Edit.push(ev);
            this.VoxelNodeEdit.addChild(ev);
        }
    }

    onEnable () {
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.KEY_PRESSING, this.keyPressing, this);
        input.on(Input.EventType.KEY_UP, this.keyUp, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);  
        // this.node.on(DRAW_EDIT_VOXEL_EVENT, this.onDrawEditVoxel, this);
    }

    onDisable () {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.off(Input.EventType.KEY_PRESSING, this.keyPressing, this);
        input.off(Input.EventType.KEY_UP, this.keyUp, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        // this.node.off(DRAW_EDIT_VOXEL_EVENT, this.onDrawEditVoxel, this);
    }

    update(deltaTime: number) {
        if (this.isInitialize && this.isSelect && this.isMove && !this.isSelectCtrl) {
            this.selectGraph.clear();
            // selectMovingPos没有做-20 -60校正处理
            this.selectGraph.moveTo(this.selectPos.x + 20, this.selectPos.y + 60);
            this.selectGraph.lineTo(this.selectMovingPos.x, this.selectPos.y + 60);
            this.selectGraph.lineTo(this.selectMovingPos.x, this.selectMovingPos.y);
            this.selectGraph.lineTo(this.selectPos.x + 20, this.selectMovingPos.y);
            this.selectGraph.lineTo(this.selectPos.x + 20, this.selectPos.y + 60);
            this.selectGraph.stroke();
        }

        if (this.isSnapShotReady !== SnapShotState.None) {
            console.log("this.snapShot===================");
            if (this.isSnapShotReady === SnapShotState.wait1frame) {
                this.isSnapShotReady++;
            } else {
                this.node.emit(SNAPSHOT_FOR_NEW_VOXEL_EVENT, { id: this.snapShotId });
                this.isSnapShotReady = SnapShotState.None;
                // this.voxelDataHistory.setSnapShotReadyById(this.snapShotId);
            }
        }
    }

   

    private drawAxis() {
        // 原点(-320, 0)
        // scattergraph的ui坐标被放在了屏幕中心，后面放到左下角可以统一0-1280/0-720坐标
        this.scatterGraph.lineWidth = 2;
        this.scatterGraph.strokeColor.fromHEX('#eeeeee');
        // x-axis
        this.scatterGraph.moveTo(-620, 0);
        this.scatterGraph.lineTo(-20, 0);
        this.scatterGraph.lineTo(-30, 5);
        this.scatterGraph.moveTo(-30, -5);
        this.scatterGraph.lineTo(-20, 0);

        // y-axis
        this.scatterGraph.moveTo(-320, -300);
        this.scatterGraph.lineTo(-320, 300);
        this.scatterGraph.lineTo(-325, 290);
        this.scatterGraph.moveTo(-320, 300);
        this.scatterGraph.lineTo(-315, 290);

        // origin-label
        const scaleLabel = new Node();
        const sl = scaleLabel.addComponent(Label);
        this.ScatterGraphic.addChild(scaleLabel);
        sl.string = `(${((this.scatterRange.left + this.scatterRange.right) * 0.5).toFixed(1)}, ${((this.scatterRange.top + this.scatterRange.bottom) * 0.5).toFixed(1)})`;
        sl.fontSize = 10;
        sl.lineHeight = sl.fontSize;
        sl.color.fromHEX('#eeeeee');
        scaleLabel.setPosition(new Vec3(-320, -10, 0));
        scaleLabel.layer = this.ScatterGraphic.layer;

        const scaleLabelListX = [-560, -500, -440, -380, -260, -200, -140, -80];
        const scaleLabelListY = [-240, -180, -120, -60, 60, 120, 180, 240];

        for (let i = 0; i < 8; i++) {
            this.scatterGraph.moveTo(scaleLabelListX[i], -5);
            this.scatterGraph.lineTo(scaleLabelListX[i], 5);
            this.scatterGraph.moveTo(-315, scaleLabelListY[i]);
            this.scatterGraph.lineTo(-325, scaleLabelListY[i]);
            const scaleLabelX = new Node();
            const scaleLabelY = new Node();
            const slx = scaleLabelX.addComponent(Label);
            const sly = scaleLabelY.addComponent(Label);
            this.ScatterGraphic.addChild(scaleLabelX);
            this.ScatterGraphic.addChild(scaleLabelY);
            slx.string = lerp(this.scatterRange.left, this.scatterRange.right, (scaleLabelListX[i] + 620) / 600.0).toFixed(2).toString();   

            sly.string = lerp(this.scatterRange.bottom, this.scatterRange.top, (scaleLabelListY[i] + 300) / 600.0).toFixed(2).toString();   
            slx.fontSize = 10;
            sly.fontSize = 10;
            slx.lineHeight = 10;
            sly.lineHeight = 10;
            slx.color.fromHEX('#eeeeee');
            sly.color.fromHEX('#eeeeee');
            scaleLabelX.setPosition(new Vec3(scaleLabelListX[i], -10, 0));
            scaleLabelY.setPosition(new Vec3(-340, scaleLabelListY[i], 0));
            scaleLabelX.layer = this.ScatterGraphic.layer;
            scaleLabelY.layer = this.ScatterGraphic.layer;
        }

        // this.graph.close();
        this.scatterGraph.stroke();
    }

    private drawScatter() {
        this.scatterGraph.lineWidth = 0;
        this.scatterWidth = this.scatterRange.right - this.scatterRange.left;
        this.scatterHeight = this.scatterRange.top - this.scatterRange.bottom;

        for (let i = 0; i < 10; i++) {
            this.pointTree[i] = [];
            for (let j = 0; j < 10; j++) {
                this.pointTree[i][j] = [];
            }
        }

        for (let i = 0; i < this.data.length; i++) {
            const d = this.data[i];
            d.pos = new Vec2((d.pos.x - this.scatterRange.left) * 600 / this.scatterWidth, 
                (d.pos.y - this.scatterRange.bottom) * 600 / this.scatterHeight), // 缩放到0-600屏幕像素空间


            this.pointTree[Math.min(Math.floor(d.pos.x / 60), 9)][Math.min(Math.floor(d.pos.y / 60), 9)].push(d);
            
            this.scatterGraph.fillColor.fromHEX(type2Color[d.type]);
            this.scatterGraph.circle(d.pos.x - 620, d.pos.y - 300, 2);
            this.scatterGraph.fill();
            this.scatterGraph.stroke();
        }
    }

    // TODO:设置体素的颜色等
    private createVoxel(scale: number): Node {
        const vc = instantiate(this.VoxelCube);
        vc.scale.multiplyScalar(scale);
        vc.active = false;
        return vc;
    }

    private renderVoxelSelect(id: string) {
        let i = 0;
        const voxelData: Vec3[] = this.voxelDataHistory.getVoxelById(id);
        for (; i < voxelData.length; i++) {
            if (i >= this.voxelList.Select.length) {
                const sv = this.createVoxel(voxelScale.Select);
                this.VoxelNodeSelect.addChild(sv);
                this.voxelList.Select.push(sv);
            }
            const sv = this.voxelList.Select[i];
            sv.position = (new Vec3(voxelData[i].x, voxelData[i].y, voxelData[i].z)).multiplyScalar(voxelScale.Select);
            sv.active = true;
        }

        while (i < this.voxelList.Select.length && this.voxelList.Select[i].active) {
            this.voxelList.Select[i++].active = false;
        }

        this.isSnapShotReady = SnapShotState.wait1frame;
        this.snapShotId = id;
    }

    private snapShotVoxel = (msg) => {
        console.log('shnap shot id is ' + msg.id);
        const snapshot = new SpriteFrame();
        const rtData = this.selectRT.readPixels();
        const voxelTexture = new Texture2D();
        voxelTexture.reset({ width: this.selectRT.width, height: this.selectRT.height, format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 0 })
        voxelTexture.uploadData(rtData, 0, 0);
        voxelTexture.updateImage();
        snapshot.texture = voxelTexture;
        this.voxelDataHistory.setSnapShot(snapshot);
        
        // const spriteNode = new Node();
        // const ssn = spriteNode.addComponent(SnapShotNode);
        // ssn.vid = msg.id;
        // spriteNode.layer = this.HistoryBgMask.layer;
        // spriteNode.setScale(new Vec3(1, -1, 1));

        // const sp = spriteNode.addComponent(Sprite);
        // sp.spriteFrame = snapshot;
        // const idLabel = new Node();
        // idLabel.layer = this.HistoryBgMask.layer;
        // const il = idLabel.addComponent(Label);
        // il.string = msg.id;
        // il.fontSize = 20;
        // spriteNode.addChild(idLabel);
        // idLabel.setPosition(new Vec3(0, 70, 0));
        // idLabel.setScale(new Vec3(1, -1, 1));

        
        // this.HistoryBgMask.addChild(spriteNode);
        // spriteNode.getComponent(UITransform).contentSize.set(100, 100);
        // const childList = this.HistoryBgMask.children;
        // if (childList.length > this.historyMaxLength) {
        //     const chtail = childList[0];
        //     this.HistoryBgMask.removeChild(childList[0]);
        //     const sp = chtail.getComponent(Sprite).spriteFrame;
        //     if (sp.refCount <= 1) {
        //         sp.destroy();
        //     }
        //     chtail.destroy();
        // }
        // let xpos = 0;   
        // for (let i = childList.length - 1; i >= 0; i--, xpos -= 120) {
        //     childList[i].position = new Vec3(xpos, 15, 0);
        // }
        // this.HistoryBgMask.setPosition(new Vec3(440, 0, 0));
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
            const op = this.UICanvas.getChildByName('InnerUI').getComponent(UIOpacity);
            this.isInnerUI = !this.isInnerUI;
            op.opacity = this.isInnerUI ? 255 : 0;
        } else if (this.isInnerUI) {
            if (key.keyCode === KeyCode.CTRL_LEFT && !this.isSelect && this.selectType != SelectingType.Single && this.selectType != SelectingType.Range) {
                // 按住左ctrl多次选点
                this.isSelectCtrl = true;
            }
            // TODO:test code!!连上服务器测试没问题就删掉
            else if (key.keyCode === KeyCode.KEY_A) {
                const id = randomRangeInt(0, 10000).toString();
                if (this.voxelDataHistory.isExist(id) === -1) {
                    if (this.voxelDataHistory.length() === this.historyMaxLength)
                        this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push([new Vec3(0, 0, 0)], id, parseInt(id));
                    this.snapShotVoxel({id: id});
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
        // screen 1280 * 720
        // pos range: (0, 0) - (1280, 720)
        const pos: Vec2 = e.touch.getUILocation();
        if (this.isInnerUI) {
            if (pos.x > 20 && pos.x < 620 && pos.y > 60 && pos.y < 660) {
                this.isSelect = true;
                pos.subtract2f(20, 60);
                this.selectPos = pos;

                // 只要点击散点界面就取消所有选中状态
                // this.isSelectingOne = false;
                // this.isSelectingRange = false;
                // if (!this.isSelectCtrl) {
                //     this.isSelectingMulti = false;
                // }
                if (this.selectType != SelectingType.Multi || !this.isSelectCtrl) {
                    this.selectType = SelectingType.None;
                    this.SelectMultiButtons.active = false;
                    this.SelectRangeButtons.active = false;
                    this.SelectSingleButtons.active = false;
                }
                // 这里也把数据点清空
                while (!this.isSelectCtrl && this.selectNodeList.length > 0) {
                    this.selectNodeList[this.selectNodeList.length - 1].destroy();
                    this.selectNodeList.pop();
                    this.selectDataList.pop();
                } 
            }
        }
        
    }

    private onTouchMove(e: EventTouch) {
        const pos: Vec2 = e.touch.getUILocation();
        if (this.isInnerUI) {              // ui交互事件
            if (PREVIEW)
                console.log('moving');
            this.isMove = true;
            if (this.isSelect) {
                this.selectMovingPos = pos;
            }
        } else {                        // 3d体素交互事件
            
        }
    }

    private onTouchEnd(e: EventTouch) {
        const pos: Vec2 = e.touch.getUILocation();
        if (this.isInnerUI) {
            if (this.isSelect) {
                if (this.isMove && !this.isSelectCtrl) {
                    pos.subtract2f(20, 60);
                    pos.x = Math.min(Math.max(0, pos.x), 600);
                    pos.y = Math.min(Math.max(0, pos.y), 600);
                    const selectRange: rectSize = {
                        left: Math.min(pos.x, this.selectPos.x),
                        right: Math.max(pos.x, this.selectPos.x),
                        bottom: Math.min(pos.y, this.selectPos.y),
                        top: Math.max(pos.y, this.selectPos.y),
                    }
                    const selectZone: rectSize = {
                        left: Math.floor(selectRange.left / 60),
                        right: Math.min(Math.floor(selectRange.right / 60), 9),
                        bottom: Math.floor(selectRange.bottom / 60),
                        top: Math.min(Math.floor(selectRange.top / 60), 9),
                    }
                    // while (this.selectNodeList.length > 0) {
                    //     this.selectNodeList[this.selectNodeList.length - 1].destroy();
                    //     this.selectNodeList.pop();

                    // } 
                    for (let x = selectZone.left; x <= selectZone.right; x++) {
                        for (let y = selectZone.bottom; y <= selectZone.top; y++) {
                            if (x == selectZone.left || x == selectZone.right || y == selectZone.bottom || y == selectZone.top) {
                                const pointList = this.pointTree[x][y];
                                for (let i = 0; i < pointList.length; i++) {
                                    const pointPos = pointList[i].pos;
                                    if (pointPos.x >= selectRange.left && pointPos.x <= selectRange.right && pointPos.y >= selectRange.bottom && pointPos.y <= selectRange.top) {
                                        const selectNode = instantiate(this.SelectNode);
                                        this.UICanvas.getChildByName('InnerUI').addChild(selectNode);
                                        selectNode.setPosition(new Vec3(pointPos.x - 620, pointPos.y - 300, 0));
                                        this.selectNodeList.push(selectNode);
                                        this.selectDataList.push(pointList[i].idx);
                                    }
                                }
                            } else {
                                const pointList = this.pointTree[x][y];
                                for (let i = 0; i < pointList.length; i++) {
                                    const selectNode = instantiate(this.SelectNode);
                                    this.UICanvas.getChildByName('InnerUI').addChild(selectNode);
                                    selectNode.setPosition(new Vec3(pointList[i].pos.x - 620, pointList[i].pos.y - 300, 0));
                                    this.selectNodeList.push(selectNode);
                                    this.selectDataList.push(pointList[i].idx);
                                    
                                }
                            }
                        }
                    }
                    if (this.selectNodeList.length > 0) {
                        if (this.selectNodeList.length === 1) {
                            this.selectType = SelectingType.Single;
                            this.SelectSingleButtons.active = true;
                        }
                        else {
                            this.selectType = SelectingType.Range;
                            this.SelectRangeButtons.active = true;
                        }
                    }
                } else {
                    const tileX = Math.floor((pos.x - 20) / 60);
                    const tileY = Math.floor((pos.y - 60) / 60);
                    const pointList = this.pointTree[tileX][tileY];
                    pos.subtract2f(20, 60);
                    for (let i = 0; i < pointList.length; i++) {
                        if (this.distanceVec2(pos, pointList[i].pos) < 3) {
                           
                            const selectNode = instantiate(this.SelectNode);
                            this.UICanvas.getChildByName('InnerUI').addChild(selectNode);
                            selectNode.setPosition(new Vec3(pointList[i].pos.x - 620, pointList[i].pos.y - 300, 0));
                            this.selectNodeList.push(selectNode);
                            this.selectDataList.push(pointList[i].idx);
                            
                            if (PREVIEW) {
                                console.log('shot on node!' + pointList[i].pos);
                                console.log(pos);
                            }
                            break;
                        }
                    }
                    if (this.selectNodeList.length > 0) {
                        if (!this.isSelectCtrl || this.selectNodeList.length === 1) {
                            this.selectType = SelectingType.Single;
                            this.SelectSingleButtons.active = true;
                        } else {
                            this.selectType = SelectingType.Multi;
                            this.SelectMultiButtons.active = true;      
                        }
                    }
                    // else
                } 
            } else if (pos.x > this.quadPanelPos.left && pos.x < this.quadPanelPos.right && pos.y > this.quadPanelPos.bottom && pos.y < this.quadPanelPos.top) {

                let uv: Vec2 = new Vec2((pos.x - this.quadPanelPos.left) / (this.quadPanelPos.right - this.quadPanelPos.left), 
                    (pos.y - this.quadPanelPos.bottom) / (this.quadPanelPos.top - this.quadPanelPos.bottom));
                uv.x = Math.max(0, Math.min(uv.x, 1));
                uv.y = Math.max(0, Math.min(uv.y, 1));
                this.panelClickPos = uv;
                if (!this.panelPosBoard)
                    this.panelPosBoard = director.getScene().getChildByPath('mainUI/InnerUI/quadPanel/clickPos').getComponent(Label);
                this.panelPosBoard.string = `x=${uv.x}\ny=${uv.y}`;
                
                if (PREVIEW)
                    console.log('panel uv:' + uv);
            }
        }

        this.isMove = false;
        this.isSelect = false;
        this.selectGraph.clear();
    }

    /*------------------------------------------- button触发事件 -------------------------------------------*/ 

    public onInitializeButtonClick() {    
        let xhr = new XMLHttpRequest();
        let url = SERVER_HOST + RequestName.InitializeOverview;
        
        xhr.open('GET', url, true);
        xhr.onreadystatechange = () => { // 当请求被发送到服务器时，我们需要执行一些动作  
            if (xhr.readyState === 4 && xhr.status === 200) { // 如果请求已完成，且响应状态码为200（即成功），则...  
                let response = JSON.parse(xhr.responseText); // 解析服务器响应的JSON数据  
                
                if (PREVIEW)
                    console.log(response); // 在控制台打印响应数据  
                let i = 0;
                this.scatterRange = {
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    top: 0
                };
                response.forEach(d => {
                    const typeStr = d[0].split(' ')[0];
                    
                    if (PREVIEW)
                        console.log(typeStr);
                    if (!this.typeDict.has(typeStr)) {
                        this.typeDict.set(typeStr, this.typeDict.size);
                        
                        if (PREVIEW)
                            console.log(this.typeDict.get(typeStr));
                    }

                    const newDataPoint: DataPoint = {
                        pos: new Vec2(d[1][0][0], d[1][0][1]),
                        value: 0,           // 待定
                        idx: i,
                        type: this.typeDict.get(typeStr),
                        name: d[0],
                        img: null
                    }
                    
                    this.scatterRange.left = Math.min(this.scatterRange.left, newDataPoint.pos.x);
                    this.scatterRange.right = Math.max(this.scatterRange.right, newDataPoint.pos.x);
                    this.scatterRange.bottom = Math.min(this.scatterRange.bottom, newDataPoint.pos.y);
                    this.scatterRange.top = Math.max(this.scatterRange.top, newDataPoint.pos.y);
                    
                    this.data.push(newDataPoint);
                    i++;
                });
                this.scatterGraph.clear();
                this.drawAxis();
                this.drawScatter();
                this.isInitialize = true;
                
            }  
        };  
        
        console.log(url);
        xhr.send();
        console.log('send end');
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
                
                if (PREVIEW) 
                    console.log(rawVoxelData); 

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
                if (!this.voxelDataHistory.push(voxelData, id, idx1 === -1 ? -1 : idx0)) {   // 如果队列满了则pop掉队首
                    this.voxelDataHistory.popHead();
                    this.voxelDataHistory.push(voxelData, id, idx1 === -1 ? -1 : idx0);
                }   
                
                this.isGetVoxelFinished = true;
                this.node.emit(GET_VOXEL_FINISH_EVENT);
            }  
        };  

        console.log(url);
        xhr.send();
    }

    public async onSingleGetVoxelButtonClick() {
        // TODO:这里的id最好还是用数据点的name
        // this.data[this.selectDataList[0]].name;
        const id = this.selectDataList[0].toString();
        if (this.voxelDataHistory.isExist(id) === -1) {
            this.getVoxelFromServer(id, this.selectDataList[0]);
            await this.waitUntilGetVoxelFnish();
            console.log('get voxel finished');
            this.node.on(SNAPSHOT_FOR_NEW_VOXEL_EVENT, this.snapShotVoxel, this);
        }
        this.renderVoxelSelect(id);
    }

    public async onDrawEditVoxel(vid: string) {
        console.log('draw id: ' + vid);
        // await this.drawEditLock.acquire();
        console.log('origin id: ' + vid + ', now id: ' + this.drawEditVoxelIdBuffer);

        if (vid === this.drawEditVoxelIdBuffer) {
            const voxelData = this.voxelDataHistory.getVoxelById(vid);
            let i = 0;
            console.log(voxelData);
            for (; i < voxelData.length; i++) {
                if (i >= this.voxelList.Edit.length) {
                    const ev = this.createVoxel(voxelScale.Edit);
                    this.VoxelNodeEdit.addChild(ev);
                    this.voxelList.Edit.push(ev);
                }
                const ev = this.voxelList.Edit[i];
                ev.position = (new Vec3(voxelData[i].x, voxelData[i].y, voxelData[i].z)).multiplyScalar(voxelScale.Edit);
                ev.active = true;
            }
    
            while (i < this.voxelList.Edit.length && this.voxelList.Edit[i].active) {
                this.voxelList.Edit[i++].active = false;
            }

        } 

        // this.drawEditLock.release();
    }

    // TODO: panel上的button点击之后如果sprite无引用要destroy掉，但是暂时没有找到安全的destroy的方法
    public onSingleAddToPanelButtonClick() {
        const id = this.selectDataList[0].toString();
        const childList = this.quadPanelNode.children;

        for (let i = 0; i < 4; i++) {
            if (id === childList[i].getComponent(PanelNode).vid)
                return;
        }
        let i = 0;
        console.log(childList);
        for (; i < 4; i++) {
            if (!childList[i].active) {
                const qsp = childList[i].getComponent(Sprite);
                qsp.spriteFrame = this.voxelDataHistory.getSnapShotById(id);
                if (qsp.spriteFrame) {
                    childList[i].active = true;
                    childList[i].getComponent(PanelNode).vid = id;
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

    public onInterpolationButtonClick() {
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
        
        this.getVoxelFromServer(id, idxList[0], idxList[1], idxList[2], idxList[3], this.panelClickPos.x, this.panelClickPos.y);
    }
}