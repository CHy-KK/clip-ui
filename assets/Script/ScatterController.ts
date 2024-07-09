import { _decorator, Component, director, EventKeyboard, input, Input, KeyCode, Node, EventTouch, Vec2, Graphics, Vec4, Color, Prefab, instantiate, Vec3, Label, randomRange } from 'cc';
import { MainController } from './Controller';
import { ClickState, DataPoint, drawRoundRect, RectSize, RequestName, SelectingType, type2Color } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('ScatterController')
export class ScatterController extends Component {

    @property({ type: Vec4, tooltip: '显示散点图区域x, y, z, w=>left, right, bottom, top' })
    public readonly scatterRectVec4: Vec4 = new Vec4(20, 600, 20, 600);
    
    @property({ tooltip: '一行/列分块数量，根据数据点数量动态变化' })
    public readonly tileNum: number = 5;
    
    @property(Prefab)
    public readonly SelectNode: Prefab = null;

    @property(Node)
    public readonly SelectSingleButtons: Node = null;

    @property(Node)
    public readonly SelectMultiButtons: Node = null;

    @property(Node)
    public readonly SelectRangeButtons: Node = null;
    
    @property(Node)
    public readonly togglesParentNode: Node = null;     // 控制当前生成等高线图的中心类别节点

    private controller: MainController = null;
    private isSelectCtrl: boolean = false;
    private clickState: ClickState = 0;
    private selectType: SelectingType = SelectingType.None;

    
    private SelectGraphic: Node = null;
    private selectGraph: Graphics;      // 选中区域绘制
    private ScatterGraphic: Node = null;
    private scatterGraph: Graphics;     // 散点图绘制（框选提供重绘接口）
    private axisLength: number = 0;
    private _tileLength: number = 0;
    private selectMovingPos: Vec2 =  new Vec2(0);
    private selectDataList: number[] = []   //  记录本次选中的点在原数据点列表中的下标
    public scatterRange: RectSize; // x-min, x-max, y-min, y-max
    public pointScatterRange: RectSize;
    private scatterWidth: number;
    private scatterHeight: number;
    public pointTree: DataPoint[][][] = [];    // pointTree的分块不随坐标轴刻度变化而变化，始终为10 * 10
    public curToggle: number = 0;     
    public downSampleList: number[] = [];      // 降采样列表
    public isSampleChange: boolean = true;     // 是否修改了采样数据范围，决定是否要重新获取等高线图
    private dataRatio: number = 1;
    
    private clickPos: Vec2 = new Vec2(0);
    public scatterRect: RectSize;
    private isMove: boolean = false;


    protected onEnable(): void {
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.KEY_UP, this.keyUp, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);  
    }

    protected onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.off(Input.EventType.KEY_UP, this.keyUp, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.SelectGraphic = this.node.getChildByName('SelectGrahpic');
        this.selectGraph = this.SelectGraphic.getComponent(Graphics);// 初始化绘图界面
        this.ScatterGraphic = this.node.getChildByName('ScatterGrahpic');
        this.scatterGraph = this.ScatterGraphic.getComponent(Graphics);
        this.scatterRect = {
            left: Math.min(this.scatterRectVec4.x, this.scatterRectVec4.y),
            right: Math.max(this.scatterRectVec4.x, this.scatterRectVec4.y),
            bottom: Math.min(this.scatterRectVec4.z, this.scatterRectVec4.w),
            top: Math.max(this.scatterRectVec4.z, this.scatterRectVec4.w),
        }
        this.axisLength = this.scatterRect.right - this.scatterRect.left;
        this.tileLength = this.axisLength / this.tileNum;
        
        this.selectGraph.lineWidth = 1;
        this.selectGraph.strokeColor.fromHEX('#0099aa');
        this.selectGraph.fillColor = new Color(0, 200, 200, 80);
        this.inistializeScatter();
    }

    update(deltaTime: number) {
        if (this.controller.isInitialize && this.clickState === ClickState.Scatter && this.isMove && !this.isSelectCtrl) {
            this.selectGraph.clear();
            this.selectGraph.moveTo(this.clickPos.x + this.scatterRect.left, this.clickPos.y + this.scatterRect.bottom);
            this.selectGraph.lineTo(this.selectMovingPos.x, this.clickPos.y + this.scatterRect.bottom);
            this.selectGraph.lineTo(this.selectMovingPos.x, this.selectMovingPos.y);
            this.selectGraph.lineTo(this.clickPos.x + this.scatterRect.left, this.selectMovingPos.y);
            this.selectGraph.lineTo(this.clickPos.x + this.scatterRect.left, this.clickPos.y + this.scatterRect.bottom);
            this.selectGraph.fill();
            this.selectGraph.stroke();
        }
    }

    public get tileLength() {
        return this._tileLength;
    }

    private set tileLength(val: number) {
        this._tileLength = val;
    }

    
    public getSelectListHead() {
        return this.selectDataList[0];
    }

    inistializeScatter() {
        const g = this.node.getChildByName('bgGraph').getComponent(Graphics);
        const sr = this.scatterRect;
        drawRoundRect(g, new Vec2(sr.left - 10, sr.top + 40), sr.right - sr.left + 20, sr.top - sr.bottom + 50, 10, true);
        g.fillColor.fromHEX('#dddddd');
        g.fill();

    }

    private keyDown(key: EventKeyboard) {
        if (key.keyCode === KeyCode.CTRL_LEFT && this.clickState === ClickState.None && this.selectType != SelectingType.Single && this.selectType != SelectingType.Range) {
            // 按住左ctrl多次选点
            this.isSelectCtrl = true;
        }
    }

    private keyUp(key: EventKeyboard) {
        if (key.keyCode === KeyCode.CTRL_LEFT) {
            this.isSelectCtrl = false;
        }
    }

    private onTouchStart(e: EventTouch) {
        const pos: Vec2 = Vec2.subtract(new Vec2(), e.touch.getUILocation(), new Vec2(this.node.worldPosition.x, this.node.worldPosition.y));
        if (pos.x > this.scatterRect.left && pos.x < this.scatterRect.right && pos.y > this.scatterRect.bottom && pos.y < this.scatterRect.top) {
            console.log('in sacatter');
            this.clickState = ClickState.Scatter;
            pos.subtract2f(this.scatterRect.left, this.scatterRect.bottom);
            this.clickPos = pos;

            if (this.selectType != SelectingType.Multi || !this.isSelectCtrl) {
                this.setSelectType(SelectingType.None);
            }
            // 这里也把数据点清空
            if (!this.isSelectCtrl) {
                this.SelectGraphic.destroyAllChildren();
                while (!this.isSelectCtrl && this.selectDataList.length > 0) {
                    this.selectDataList.pop();
                } 
            }
        
        }
    }

    private onTouchMove(e: EventTouch) {
        const pos: Vec2 = Vec2.subtract(new Vec2(), e.touch.getUILocation(), new Vec2(this.node.worldPosition.x, this.node.worldPosition.y));
        this.isMove = true;
        if (this.clickState === ClickState.Scatter)
            this.selectMovingPos = pos;
        
    }

    private onTouchEnd(e: EventTouch) {
        if (this.clickState === ClickState.Scatter) {
            const pos: Vec2 = Vec2.subtract(new Vec2(), e.touch.getUILocation(), new Vec2(this.node.worldPosition.x, this.node.worldPosition.y));
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
                    if (this.selectDataList.length === 1) 
                        this.setSelectType(SelectingType.Single)
                    else 
                        this.setSelectType(SelectingType.Range)
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
                        this.setSelectType(SelectingType.Single)
                    } else if (this.selectDataList.length === 2) {
                        this.setSelectType(SelectingType.Two)
                        this.controller.clearSnapSelect();
                    } 
                    else {
                        this.setSelectType(SelectingType.Multi) 
                    }
                }
            }
        }

        this.isMove = false;
        this.clickState = ClickState.None;
        this.selectGraph.clear();
    }

    private distanceVec2(v1: Vec2, v2: Vec2) {
        const n1: number = v2.x - v1.x;
        const n2: number = v2.y - v1.y;
        return Math.sqrt(n1 * n1 + n2 * n2);
    }

    public drawInitial () {
        this.scatterGraph.clear();
        this.drawScatter(this.scatterRect, this.scatterRange);
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

        for (let i = 0; i < this.controller.data.length; i++) {
            const d = this.controller.data[i];
            d.screenPos = new Vec2((d.dataPos.x - sr.left) * height / this.scatterWidth, 
                (d.dataPos.y - sr.bottom) * width / this.scatterHeight), // 缩放到0-width屏幕像素空间

            this.pointTree[Math.min(Math.floor(d.screenPos.x / this.tileLength), this.tileNum - 1)][Math.min(Math.floor(d.screenPos.y / this.tileLength), this.tileNum - 1)].push(d);
            
            this.scatterGraph.fillColor.fromHEX(type2Color[d.type]);
            this.scatterGraph.circle(d.screenPos.x + renderRect.left, d.screenPos.y + renderRect.bottom, 1.5);
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
            const d = this.controller.data[sampleIdxList[i]];
            d.screenPos = new Vec2((d.dataPos.x - sr.left) * height / this.scatterWidth, 
                (d.dataPos.y - sr.bottom) * width / this.scatterHeight), // 缩放到0-width屏幕像素空间

            this.pointTree[Math.min(Math.floor(d.screenPos.x / this.tileLength), this.tileNum - 1)][Math.min(Math.floor(d.screenPos.y / this.tileLength), this.tileNum - 1)].push(d);
            
            this.scatterGraph.fillColor.fromHEX(type2Color[d.type]);
            this.scatterGraph.circle(d.screenPos.x + renderRect.left, d.screenPos.y + renderRect.bottom, 1.5);
            this.scatterGraph.fill();
            this.scatterGraph.stroke();
        }
    }    
    
    
    public setSelectType(st: SelectingType) {
        this.selectType = st;
        this.SelectSingleButtons.active = false;
        this.SelectMultiButtons.active = false;
        this.SelectRangeButtons.active = false;
        switch(st) {
            case SelectingType.Single:
                this.SelectSingleButtons.active = true;
                break;
            case SelectingType.Multi:
                this.SelectMultiButtons.active = true;
                break;
            case SelectingType.Range:
                this.SelectRangeButtons.active = true;
                break;
        }
    }

    public onShowScatterButtonClick() {
        this.ScatterGraphic.active = !this.ScatterGraphic.active;
    }

    public onTypeToggleClick(e: Event, customEventData: string) {
        const idx = parseInt(customEventData);
        const childList = this.togglesParentNode.children;
        childList[0].setPosition(childList[idx].position);
        childList[0].children[0].getComponent(Label).string = childList[idx].name;
        // 再次点击类型选择button则选中所有该类型
        if (this.curToggle === idx - 1) {
            this.SelectGraphic.destroyAllChildren();
            // TODO 这里其实应该遍历的是downsamplelist，也就是当前散点显示范围的list，如果不是downsample状态才遍历data列表。然后在切换其他类型时要取消当前选中
            while (this.selectDataList.length)
                this.selectDataList.pop();
            this.controller.data.forEach((value: DataPoint, index: number) => {
                if (value.type === this.curToggle) {
                    const selectNode = instantiate(this.SelectNode);
                    this.ScatterGraphic.addChild(selectNode);
                    selectNode.setPosition(new Vec3(value.screenPos.x + this.scatterRect.left, value.screenPos.y + this.scatterRect.bottom, 0));
                    this.SelectGraphic.addChild(selectNode);
                    this.selectDataList.push(index);
                }

            })

            this.setSelectType(SelectingType.Range);
        }
        this.curToggle = idx - 1;
        this.controller.contourBg.active = false;
        this.isSampleChange = true;
    }

    private clearAllStates() {
        this.scatterGraph.clear();
        this.setSelectType(SelectingType.None);
        this.SelectGraphic.destroyAllChildren();
        while (!this.isSelectCtrl && this.selectDataList.length > 0) {
            this.selectDataList.pop();
        } 
    }

    public onChangeSlide(progress: number) {
        const data = this.controller.data;
        const dNum = Math.ceil(data.length * progress);
        this.downSampleList = new Array(dNum);
        if (this.dataRatio !== progress) {
            this.clearAllStates();
            this.dataRatio = progress;
            this.isSampleChange = true;
            if (progress < 1) {
                this.controller.contourBg.active = false;
                for (let i = 0; i < dNum; i++)
                    this.downSampleList[i] = Math.floor(randomRange(0, 0.99999999) * data.length);
                let sr: RectSize = {
                    left: data[this.downSampleList[0]].dataPos.x,
                    right: data[this.downSampleList[0]].dataPos.x,
                    bottom: data[this.downSampleList[0]].dataPos.y,
                    top: data[this.downSampleList[0]].dataPos.y
                }
                this.downSampleList.forEach(idx => {
                    if (idx >= data.length)
                        console.error('out of data!!!');
                    sr.left = Math.min(sr.left, data[idx].dataPos.x);
                    sr.right = Math.max(sr.right, data[idx].dataPos.x);
                    sr.bottom = Math.min(sr.bottom, data[idx].dataPos.y);
                    sr.top = Math.max(sr.top, data[idx].dataPos.y);
                })
                this.drawScatterIndex(this.scatterRect, sr, this.downSampleList);
            } else {
                this.controller.contourBg.active = false;
                this.downSampleList = [];
                this.drawScatter(this.scatterRect, this.scatterRange);
            }
        }
    }

    public sampleRangeScatter() {
        // TODO: 这里其实没做是否是框选全部数据点的安全措施
        const data = this.controller.data;
        this.isSampleChange = true;
        this.controller.contourBg.active = false;
        this.downSampleList = new Array(this.selectDataList.length);
        for (let i = 0; i < this.selectDataList.length; i++) {
            this.downSampleList[i] = this.selectDataList[i];
        }
        this.clearAllStates();
        this.dataRatio = -1; // 这里修改为0，返回全部采样点时直接调用onChangeSlide传入原来的progress就行

        this.pointScatterRange = {
            left: data[this.downSampleList[0]].dataPos.x,
            right: data[this.downSampleList[0]].dataPos.x,
            bottom: data[this.downSampleList[0]].dataPos.y,
            top: data[this.downSampleList[0]].dataPos.y
        }
        this.downSampleList.forEach(idx => {
            if (idx >= data.length)
                console.error('out of data!!!');
            this.pointScatterRange.left = Math.min(this.pointScatterRange.left, data[idx].dataPos.x);
            this.pointScatterRange.right = Math.max(this.pointScatterRange.right, data[idx].dataPos.x);
            this.pointScatterRange.bottom = Math.min(this.pointScatterRange.bottom, data[idx].dataPos.y);
            this.pointScatterRange.top = Math.max(this.pointScatterRange.top, data[idx].dataPos.y);
        })
        this.drawScatterIndex(this.scatterRect, this.pointScatterRange, this.downSampleList);
    }
}


