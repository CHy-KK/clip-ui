import { _decorator, Component, EventKeyboard, EventTouch, Graphics, Input, input, KeyCode, Label, lerp, Node, random, randomRange, Texture2D, UIOpacity, ValueType, Vec2, Vec3, Vec4 } from 'cc';
const { ccclass, property } = _decorator;

const SERVER_HOST = 'http://localhost:5000/';
const INITIALIZE_OVERVIEW = 'initialize_overview';
type dataPoint = {
    pos: Vec2;
    img: Texture2D;
    value: number;
    idx: number;    // 映射到原数组中的序号
}

@ccclass('test')
export class test extends Component {

    @property(Node)
    public graphics: Node = null;

    @property(Node)
    public UICanvas: Node = null;

    private data: Vec3[] = [];
    // private dataTile:  
    private pointTree: dataPoint[][][] = [  ];
    private graph: Graphics;
    private scatterRange: Vec4 = new Vec4(0, 0, 0, 0); // x-min, x-max, y-min, y-max
    private scatterWidth: number;
    private scatterHeight: number;
    private isShow: boolean = true;

    start() {
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
            this.scatterRange = new Vec4(this.data[0].x, this.data[0].x, this.data[0].y, this.data[0].y);
        }
        this.data.forEach(value => {
            this.scatterRange.x = Math.min(this.scatterRange.x, value.x);
            this.scatterRange.y = Math.max(this.scatterRange.y, value.x);
            this.scatterRange.z = Math.min(this.scatterRange.z, value.y);
            this.scatterRange.w = Math.max(this.scatterRange.w, value.y);
        })

        this.graph = this.graphics.getComponent(Graphics);
        this.drawAxis();
        this.drawScatter();
    }

    onEnable () {
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.TOUCH_START, this.onClick, this);
    }

    onDisable () {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.off(Input.EventType.TOUCH_START, this.onClick, this);
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
            slx.string = lerp(this.scatterRange.x, this.scatterRange.y, (scaleLabelListX[i] + 620) / 600.0).toFixed(2).toString();   

            sly.string = lerp(this.scatterRange.z, this.scatterRange.w, (scaleLabelListY[i] + 300) / 600.0).toFixed(2).toString();   
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
        this.scatterWidth = this.scatterRange.y - this.scatterRange.x;
        this.scatterHeight = this.scatterRange.w - this.scatterRange.z;

        for (let i = 0; i < 10; i++) {
            this.pointTree[i] = [];
            for (let j = 0; j < 10; j++) {
                this.pointTree[i][j] = [];
            }
        }

        for (let i = 0; i < this.data.length; i++) {
            const d = this.data[i];
            const point: dataPoint = {
                pos: new Vec2((d.x - this.scatterRange.x) / this.scatterWidth, (d.y - this.scatterRange.z) / this.scatterHeight),
                img: null,
                value: d.z,
                idx: i
            };

            this.pointTree[Math.floor(10 * point.pos.x)][Math.floor(10 * point.pos.y)].push(point);
            console.log(point.pos.x * 600 - 620, point.pos.y - 300);
            
            this.graph.fillColor.fromHEX('#cccccc');
            this.graph.circle(point.pos.x * 600 - 620, point.pos.y * 600 - 300, 2);
            this.graph.fill();
            this.graph.stroke();
        }
    }



    private keyDown(key: EventKeyboard) {
        if (key.keyCode === KeyCode.KEY_U) {
            // 显隐UI
            const op = this.UICanvas.getComponent(UIOpacity);
            this.isShow = !this.isShow;
            op.opacity = this.isShow ? 255 : 0;
        } else if (this.isShow) {
            if (key.keyCode === KeyCode.KEY_A) {
                // .....
            }
        }
    }

    private onClick(e: EventTouch) {
        const pos: Vec2 = e.touch.getUILocation();
        if (this.isShow && pos.x > 20 && pos.x < 620 && pos.y > 60 && pos.y < 660) {
            // for ()
        }
        
    }
}


