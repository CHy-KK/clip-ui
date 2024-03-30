import { _decorator, Component, CurveRange, director, EventKeyboard, EventTouch, Input, input, KeyCode, lerp, UITransform, Vec2, Vec3, Vec4, view } from 'cc';

import { PREVIEW } from 'cc/env';
import { MainController } from './Controller';
import { InOrOut } from './SnapShotNode';
import { RectSize } from './Utils/Utils';


const { ccclass, property } = _decorator;

export const RECORD_START = 'record_start';
export const RECORD_STOP = 'record_stop';
export const DRAW_FINISH = 'drawfinish';

@ccclass('MaskSlide')
export class MaskSlide extends Component {
    @property({ tooltip: '拖动滑行速度', min: 1 })
    public readonly moveSpeed: number = 10;

    @property({ type: Vec2, tooltip: '右上为xy方向正方向'})
    public moveDir: Vec2 = new Vec2();

    @property(Vec2)
    public readonly originPos: Vec2 = new Vec2();

    @property(Vec2)
    public readonly tailPos: Vec2 = new Vec2();

    @property({tooltip: '0: innerUI, 1: outUI'})
    public readonly inout: InOrOut = InOrOut.In;

    @property(Vec4)
    public readonly maskZoneVec: Vec4 = new Vec4();

    private controller: MainController = null;
    private lastMoveTime: number = 0;
    private lastMoveOffset: Vec2 = new Vec2();
    private totalMoveTime: number = 0;
    private totalMoveOffset: Vec2 = new Vec2();
    private isInertia: boolean = false;
    private inertiaVelocity: Vec2 = new Vec2();
    private isClickIn: boolean = false;
    private isMove: boolean = false;
    private maskLength: number = 0;
    private sliderLength: number = 0;
    private historyListHeadToTail: Vec2 = new Vec2();
    private maskZone: RectSize;
    
    onEnable () {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);  
    }

    onDisable () {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    start() {
        this.moveDir = this.moveDir.normalize();
        this.maskLength = Math.max(this.node.getParent().getComponent(UITransform).contentSize.x, this.node.getParent().getComponent(UITransform).contentSize.y);
        this.sliderLength = Vec2.distance(this.originPos, this.tailPos);
        this.maskZone = {
            left: this.maskZoneVec.x,
            right: this.maskZoneVec.y,
            bottom: this.maskZoneVec.z,
            top: this.maskZoneVec.w
        }
    }

    lateUpdate(deltaTime: number) {

        if(this.isInertia) {
            const curmove = Vec2.lerp(new Vec2(), this.inertiaVelocity, Vec2.ZERO, this.totalMoveTime / 1500);
            this.translateCamera(curmove);
            this.totalMoveTime += Math.floor(deltaTime * 1000);
            if (this.totalMoveTime >= 1500) {
                this.isInertia = false;
                this.totalMoveOffset = new Vec2(0, 0);
                this.totalMoveTime = 0;
                this.inertiaVelocity = new Vec2(0, 0);
            }
        }
    }

    translateCamera(offset: Vec2) {
        const thisPos = new Vec2(this.node.position.x, this.node.position.y);
        const curPos = Vec2.add(new Vec2(), thisPos, Vec2.multiplyScalar(new Vec2(), offset, this.moveSpeed));
        const childList = this.node.children;
        console.log(childList);
        if (childList.length == 0)
            return;
        // const chdTail = new Vec2(childList[0].position.x, childList[0].position.y);
        const curTailPos = Vec2.add(new Vec2(), this.historyListHeadToTail, curPos);
        if (this.historyListHeadToTail.length() < this.sliderLength) 
            return;
        // 列表第一个节点距离headpos距离，以head child pos - head pos > 0为正方向
        const headDis = Vec2.distance(this.originPos, curPos) * (Vec2.dot(this.moveDir, Vec2.subtract(new Vec2(), curPos, this.originPos)) > 0 ? 1 : -1);
        // 列表最后一个节点距离tailpos距离，以tail pos - tail child pos> 0为正方向
        const tailDis = Vec2.distance(this.tailPos, curTailPos) * (Vec2.dot(this.moveDir, Vec2.subtract(new Vec2(), this.tailPos, curTailPos)) > 0 ? 1 : -1);
        const dir = Vec2.dot(offset, this.moveDir);
        console.log(headDis.toFixed(5), tailDis.toFixed(5));
        // 限定安全距离
        if ((tailDis >= 0 && dir > 0) || (headDis > 0 && dir < 0)) {
            // let move: Vec2 = this.moveSpeed * offset;
            offset.multiplyScalar(this.moveSpeed);
            console.log('正常：' + offset);
            this.node.translate(new Vec3(offset.x, offset.y, 0));
        } else if (dir > 0 && tailDis < 0) {
            offset = Vec2.subtract(new Vec2(), this.tailPos, Vec2.add(new Vec2(), this.historyListHeadToTail, thisPos));
            console.log('超出tail：' + offset);
            // 这里不要乘speed！
            this.node.translate(new Vec3(offset.x, offset.y, 0));
        } else if (dir < 0 && headDis < 0) {
            offset = Vec2.subtract(new Vec2(), thisPos, this.originPos);
            console.log('超出head：' + offset);
            // 这里不要乘speed！
            this.node.position = new Vec3(this.originPos.x, this.originPos  .y, 0);
        }
        
    }

    onTouchEnd(e: EventTouch) {
        if (this.isClickIn) {
            if (this.isMove) {
                const curTime = (new Date()).getMilliseconds();
                const dt = (curTime < this.lastMoveTime ? 1000 : 0) + curTime - this.lastMoveTime;      
                if (dt < 50) {
                    this.isInertia = true;
                    this.inertiaVelocity = Vec2.multiplyScalar(new Vec2(), this.totalMoveOffset, 1 / this.totalMoveTime);
                }
                this.totalMoveTime = 0;
            }
        }
        this.isClickIn = false;
    }

    onTouchMove(e: EventTouch) {
        if (this.isClickIn) {
            console.log('movedir: ' + this.moveDir);
            const offset = Vec2.multiplyScalar(new Vec2, this.moveDir, Vec2.dot(e.getDelta(), this.moveDir));
            console.log('offset: ' + offset);
            this.translateCamera(Vec2.multiplyScalar(new Vec2(), offset, 0.1));
            // getMilliseconds()的范围为0-1000
            const curMoveTime = (new Date()).getMilliseconds();  
            const dt = curMoveTime < this.lastMoveTime ? curMoveTime + 1000 - this.lastMoveTime : curMoveTime - this.lastMoveTime;
            // 上一次移动距离同向且滑动间隔小于50ms就积累滑动时间和距离
            if (dt < 50 && Vec2.dot(offset, this.lastMoveOffset) > 0) {
                this.totalMoveOffset.add(offset);
                this.totalMoveTime += dt;
            } else {
                this.totalMoveOffset = new Vec2(0, 0);
                this.totalMoveTime = 0;
            }

            this.isMove = true;
            this.lastMoveOffset = offset;
            this.lastMoveTime = curMoveTime;
        }
    }
    

    onTouchStart(e: EventTouch) {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        const pos: Vec2 = e.touch.getUILocation();
        if ((this.controller?.isOutUI() ? 0 : 1 ^ this.inout) && pos.x >= this.maskZone.left && pos.x <= this.maskZone.right && pos.y >= this.maskZone.bottom && pos.y <= this.maskZone.top) {
            const childList = this.node.children;
            const posChdHead = new Vec2(childList[childList.length - 1].position.x, childList[childList.length - 1].position.y);
            const posChdTail = new Vec2(childList[0].position.x, childList[0].position.y);
            Vec2.subtract(this.historyListHeadToTail, posChdTail, posChdHead);
            this.isClickIn = true;
            console.log('命中');
        } 
        this.isInertia = false;
    }
}


