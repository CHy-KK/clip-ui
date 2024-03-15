import { _decorator, Component, EventKeyboard, EventTouch, Graphics, Input, input, instantiate, KeyCode, Label, lerp, Node, Prefab, random, randomRange, Texture2D, UIOpacity, UITransform, ValueType, Vec2, Vec3, Vec4, Widget } from 'cc';
const { ccclass, property } = _decorator;

const SERVER_HOST = 'http://localhost:5000/';
const INITIALIZE_OVERVIEW = 'initialize_overview';
type DataPoint = {
    pos: Vec2;
    img: Texture2D;
    value: number;
    idx: number;    // 映射到原数组中的序号
};
type rectSize = {
    left: number,
    right: number, 
    bottom: number, 
    top: number
};

@ccclass('test')
export class test extends Component {

    @property(Node)
    public graphics: Node = null;

    @property(Node)
    public UICanvas: Node = null;

    @property(Prefab)
    public SelectNode: Prefab = null;

    private data: Vec3[] = [];
    private pointTree: DataPoint[][][] = [  ];
    private canvasSize: Vec2 = new Vec2(0);
    private graph: Graphics;
    private scatterRange: rectSize; // x-min, x-max, y-min, y-max
    private scatterWidth: number;
    private scatterHeight: number;
    private isShow: boolean = true;
    private selectNodeList: Node[] = [];
    private selectPanelPos: rectSize;

    // 交互数据
    private selectPos: Vec2 = new Vec2(0);
    private isMove: boolean = false;
    private isSelect: boolean = false;
    private isSelectingOne: boolean = false;
    private isSelectingAny: boolean = false;

    start() {
        // Initialize
        this.canvasSize.x = this.UICanvas.getComponent(UITransform).contentSize.x;
        this.canvasSize.y = this.UICanvas.getComponent(UITransform).contentSize.y;
        const selectPanel = this.UICanvas.getChildByName('BackUI').getChildByName('selectPanel');
        this.selectPanelPos = {
            right: this.canvasSize.x - selectPanel.getComponent(Widget).right,
            top: this.canvasSize.y - selectPanel.getComponent(Widget).top,
            left: 0,
            bottom: 0
        };
        this.selectPanelPos.left = this.selectPanelPos.right - selectPanel.getComponent(UITransform).contentSize.x;
        this.selectPanelPos.bottom = this.selectPanelPos.top - selectPanel.getComponent(UITransform).contentSize.y;


        let xhr = new XMLHttpRequest();
        let url = SERVER_HOST + INITIALIZE_OVERVIEW;

        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () { // 当请求被发送到服务器时，我们需要执行一些动作  
            if (xhr.readyState === 4 && xhr.status === 200) { // 如果请求已完成，且响应状态码为200（即成功），则...  
                let response = JSON.parse(xhr.responseText); // 解析服务器响应的JSON数据  
                console.log(response); // 在控制台打印响应数据  
            }  
        };  

        console.log('try to get flask backend');
        xhr.send();
        console.log('send end');

        // test code
        for (let i = 0; i < 1000; i++) {
            this.data.push(new Vec3(randomRange(-10, 10), randomRange(-10, 10), randomRange(-10, 10)));
        }

        if (this.data.length > 0) {
            this.scatterRange = {
                left: this.data[0].x, 
                right: this.data[0].x, 
                bottom: this.data[0].y, 
                top: this.data[0].y
            };
        }
        this.data.forEach(value => {
            this.scatterRange.left = Math.min(this.scatterRange.left, value.x);
            this.scatterRange.right = Math.max(this.scatterRange.right, value.x);
            this.scatterRange.bottom = Math.min(this.scatterRange.bottom, value.y);
            this.scatterRange.top = Math.max(this.scatterRange.top, value.y);
        })

        this.graph = this.graphics.getComponent(Graphics);
        this.drawAxis();
        this.drawScatter();
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
        
    }

    private drawAxis() {
        // 原点(-320, 0)
        this.graph.lineWidth = 3;
        this.graph.strokeColor.fromHEX('#eeeeee');
        // x-axis
        this.graph.moveTo(-620, 0);
        this.graph.lineTo(-20, 0);
        this.graph.lineTo(-30, 5);
        this.graph.moveTo(-30, -5);
        this.graph.lineTo(-20, 0);

        // y-axis
        this.graph.moveTo(-320, -300);
        this.graph.lineTo(-320, 300);
        this.graph.lineTo(-325, 290);
        this.graph.moveTo(-320, 300);
        this.graph.lineTo(-315, 290);

        // origin-label
        const scaleLabel = new Node();
        const sl = scaleLabel.addComponent(Label);
        this.graphics.addChild(scaleLabel);
        sl.string = '0';
        sl.fontSize = 10;
        sl.lineHeight = sl.fontSize;
        sl.color.fromHEX('#eeeeee');
        scaleLabel.setPosition(new Vec3(-330, -10, 0));
        scaleLabel.layer = this.graphics.layer;

        const scaleLabelListX = [-560, -500, -440, -380, -260, -200, -140, -80];
        const scaleLabelListY = [-240, -180, -120, -60, 60, 120, 180, 240];

        for (let i = 0; i < 8; i++) {
            this.graph.moveTo(scaleLabelListX[i], -5);
            this.graph.lineTo(scaleLabelListX[i], 5);
            this.graph.moveTo(-315, scaleLabelListY[i]);
            this.graph.lineTo(-325, scaleLabelListY[i]);
            const scaleLabelX = new Node();
            const scaleLabelY = new Node();
            const slx = scaleLabelX.addComponent(Label);
            const sly = scaleLabelY.addComponent(Label);
            this.graphics.addChild(scaleLabelX);
            this.graphics.addChild(scaleLabelY);
            slx.string = lerp(this.scatterRange.left, this.scatterRange.right, (scaleLabelListX[i] + 620) / 600.0).toFixed(2).toString();   

            sly.string = lerp(this.scatterRange.bottom, this.scatterRange.top, (scaleLabelListY[i] + 300) / 600.0).toFixed(2).toString();   
            slx.fontSize = 10;
            sly.fontSize = 10;
            slx.lineHeight = 10;
            sly.lineHeight = 10;
            slx.color.fromHEX('#eeeeee');
            sly.color.fromHEX('#eeeeee');
            scaleLabelX.setPosition(new Vec3(scaleLabelListX[i], -10, 0));
            scaleLabelY.setPosition(new Vec3(-335, scaleLabelListY[i], 0));
            scaleLabelX.layer = this.graphics.layer;
            scaleLabelY.layer = this.graphics.layer;
        }

        // this.graph.close();
        this.graph.stroke();
    }

    private drawScatter() {
        this.graph.lineWidth = 0;
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
            const point: DataPoint = {
                pos: new Vec2((d.x - this.scatterRange.left) * 600 / this.scatterWidth, (d.y - this.scatterRange.bottom) * 600 / this.scatterHeight), // 缩放到0-600屏幕像素空间
                img: null,
                value: d.z,
                idx: i
            };

            this.pointTree[Math.min(Math.floor(point.pos.x / 60), 9)][Math.min(Math.floor(point.pos.y / 60), 9)].push(point);
            // console.log(point.pos.x * 600 - 620, point.pos.y - 300);
            
            this.graph.fillColor.fromHEX('#9999dd');
            this.graph.circle(point.pos.x - 620, point.pos.y - 300, 2);
            this.graph.fill();
            this.graph.stroke();
        }
    }



    private keyDown(key: EventKeyboard) {
        if (key.keyCode === KeyCode.KEY_U) {
            // 显隐UI
            const op = this.UICanvas.getChildByName('BackUI').getComponent(UIOpacity);
            this.isShow = !this.isShow;
            op.opacity = this.isShow ? 255 : 0;
        } else if (this.isShow) {
            if (key.keyCode === KeyCode.KEY_A) {
                // .....
            }
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
        if (this.isShow) {
            if (pos.x > 20 && pos.x < 620 && pos.y > 60 && pos.y < 660) {
                this.isSelect = true;
                pos.subtract2f(20, 60);
                this.selectPos = pos;

                this.isSelectingOne = false;
                this.isSelectingAny = false;
                while (this.selectNodeList.length > 0) {
                    this.selectNodeList[this.selectNodeList.length - 1].destroy();
                    this.selectNodeList.pop();
                } 
            }
        }
        
    }

    private onTouchMove(e: EventTouch) {
        const pos: Vec2 = e.touch.getUILocation();
        if (this.isShow) {              // ui交互事件
            console.log('moving');
            this.isMove = true;
            if (this.isSelect) {

            }
        } else {                        // 3d体素交互事件
            
        }
    }

    private onTouchEnd(e: EventTouch) {
        const pos: Vec2 = e.touch.getUILocation();
        if (this.isShow) {
            if (this.isSelect) {
                if (this.isMove) {
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
                    while (this.selectNodeList.length > 0) {
                        this.selectNodeList[this.selectNodeList.length - 1].destroy();
                        this.selectNodeList.pop();
                    } 
                    for (let x = selectZone.left; x <= selectZone.right; x++) {
                        for (let y = selectZone.bottom; y <= selectZone.top; y++) {
                            if (x == selectZone.left || x == selectZone.right || y == selectZone.bottom || y == selectZone.top) {
                                const pointList = this.pointTree[x][y];
                                for (let i = 0; i < pointList.length; i++) {
                                    const pointPos = pointList[i].pos;
                                    if (pointPos.x >= selectRange.left && pointPos.x <= selectRange.right && pointPos.y >= selectRange.bottom && pointPos.y <= selectRange.top) {
                                        const selectNode = instantiate(this.SelectNode);
                                        this.UICanvas.getChildByName('BackUI').addChild(selectNode);
                                        selectNode.setPosition(new Vec3(pointPos.x - 620, pointPos.y - 300, 0));
                                        this.selectNodeList.push(selectNode);
                                    }
                                }
                            } else {
                                const pointList = this.pointTree[x][y];
                                for (let i = 0; i < pointList.length; i++) {
                                    const selectNode = instantiate(this.SelectNode);
                                    this.UICanvas.getChildByName('BackUI').addChild(selectNode);
                                    selectNode.setPosition(new Vec3(pointList[i].pos.x - 620, pointList[i].pos.y - 300, 0));
                                    this.selectNodeList.push(selectNode);
                                    
                                }
                            }
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
                            this.UICanvas.getChildByName('BackUI').addChild(selectNode);
                            selectNode.setPosition(new Vec3(pointList[i].pos.x - 620, pointList[i].pos.y - 300, 0));
                            this.selectNodeList.push(selectNode);
                            console.log('shot on node!' + pointList[i].pos);
                            console.log(pos);
                            console.log(this.UICanvas.getChildByName('BackUI').children);
                            this.isSelectingOne = true;
                            break;
                        }
                    }
                } 
            } else if (pos.x > this.selectPanelPos.left && pos.x < this.selectPanelPos.right && pos.y > this.selectPanelPos.bottom && pos.y < this.selectPanelPos.top) {
                console.log('in panel');
            }
        }

        this.isMove = false;
        this.isSelect = false;
    }
}


