import { _decorator, Component, director, EventKeyboard, input, Input, KeyCode, Node } from 'cc';
import { MainController } from './Controller';
import { ClickState, SelectingType } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('InnerUIController')
export class InnerUIController extends Component {
    private controller: MainController = null;

    // protected onEnable(): void {
    //     input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    //     input.on(Input.EventType.KEY_UP, this.keyUp, this);
    //     input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    //     input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    //     input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);  
    // }

    // protected onDisable(): void {
    //     input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    //     input.off(Input.EventType.KEY_UP, this.keyUp, this);
    //     input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    //     input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    //     input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    // }

    // start() {
    //     this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);

    // }

    // update(deltaTime: number) {
        
    // }

    // private keyDown(key: EventKeyboard) {
    //     if (key.keyCode === KeyCode.CTRL_LEFT && this.clickState === ClickState.None && this.selectType != SelectingType.Single && this.selectType != SelectingType.Range) {
    //         // 按住左ctrl多次选点
    //         this.isSelectCtrl = true;
    //     }
        

    // }
}


