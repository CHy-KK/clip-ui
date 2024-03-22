import { _decorator, Component, CurveRange, director, EventKeyboard, EventTouch, Input, input, KeyCode, lerp, Vec2, Vec3, view } from 'cc';

import { PREVIEW } from 'cc/env';
import { MainController } from './Controller';


const { ccclass, property } = _decorator;

export const RECORD_START = 'record_start';
export const RECORD_STOP = 'record_stop';
export const DRAW_FINISH = 'drawfinish';

@ccclass('MaskSlide')
export class MaskSlide extends Component {
    @property({ tooltip: '拖动滑行速度', min: 1 })
    moveSpeed: number = 10;

    private controller: MainController = null;
    private originPos: Vec3 = null;
    private lastMoveTime: number = 0;
    private lastMoveOffset: number = 0;
    private totalMoveTime: number = 0;
    private totalMoveOffset: number = 0;
    private isInertia: boolean = false;
    private inertiaVelocity: number = 0;
    

    start() {
        // 当从龙尾巴开始的时候需要重新设置
        this.originPos = new Vec3(440, 0, 0);
    }
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

    lateUpdate(deltaTime: number) {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);

        if(this.isInertia) {
            const curmove = lerp(this.inertiaVelocity, 0, this.totalMoveTime / 1500);
            this.translateCamera(curmove, this.moveSpeed);
            this.totalMoveTime += Math.floor(deltaTime * 1000);
            if (this.totalMoveTime >= 1500) {
                this.isInertia = false;
                this.totalMoveOffset = 0;
                this.totalMoveTime = 0;
                this.inertiaVelocity = 0;
            }
        }
    }

    translateCamera(offset: number, speed: number) {
        const curX = this.node.position.x + speed * offset;
        const headDis = this.originPos.x;
        // tailDis 应该为最后一个记录在最左端边缘处时，记录队列最右端到mask区域最右端的距离 + 440=当前记录长度-mask区域长度+440\
        const hl = this.controller.getHistoryLength();
        console.log()
        const tailDis = Math.max(hl * 100 + (hl - 1) * 20 - 980, 0) + headDis;

        // 限定安全距离
        if ((curX <= tailDis && offset > 0) || (curX >= headDis && offset < 0)) {
            let xMove = speed * offset;
            this.node.translate(new Vec3(xMove, 0, 0));
        } else if (offset > 0 && curX > tailDis) {
            offset = tailDis - this.node.position.x;
            // 这里不要乘speed！
            let xMove = offset;
            this.node.translate(new Vec3(xMove, 0, 0));
        } else if (offset < 0 && curX < headDis) {
            offset = headDis - this.node.position.x;
            // 这里不要乘speed！
            let xMove = offset;
            this.node.translate(new Vec3(xMove, 0, 0));
        }
        
    }



    onTouchEnd(e: EventTouch) {
        const curTime = (new Date()).getMilliseconds();
        const dt = (curTime < this.lastMoveTime ? 1000 : 0) + curTime - this.lastMoveTime;      
        if (dt < 50) {
            this.isInertia = true;
            this.inertiaVelocity = this.totalMoveOffset / this.totalMoveTime;
        }
        this.totalMoveTime = 0;
        // this.isBouncing = false;
    }

    onTouchMove(e: EventTouch) {
        const offset = e.getDeltaX();
        this.translateCamera(offset * 0.01, this.moveSpeed);
        // getMilliseconds()的范围为0-1000
        const curMoveTime = (new Date()).getMilliseconds();  
        const dt = curMoveTime < this.lastMoveTime ? curMoveTime + 1000 - this.lastMoveTime : curMoveTime - this.lastMoveTime;
        // 上一次移动距离同向且滑动间隔小于50ms就积累滑动时间和距离
        if (dt < 50 && offset * this.lastMoveOffset > 0) {
            this.totalMoveOffset += offset;
            this.totalMoveTime += dt;
        } else {
            this.totalMoveOffset = 0;
            this.totalMoveTime = 0;
        }

    
        this.lastMoveOffset = offset;
        this.lastMoveTime = curMoveTime;
    }
    

    onTouchStart(e: EventTouch) {
        const pos: Vec2 = e.touch.getUILocation();
        // if ()
        this.isInertia = false;
    }
}


