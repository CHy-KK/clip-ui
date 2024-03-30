import { _decorator, Component, director, EventKeyboard, EventTouch, input, Input, KeyCode, Node, quat, Quat, Vec2, Vec3 } from 'cc';
import { MainController } from './Controller';
const { ccclass, property } = _decorator;

@ccclass('EditVoxel')
export class EditVoxel extends Component {
    
    private controller: MainController = null;
    private isRotating: boolean = false;

    onEnable () {
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.KEY_DOWN, this.onkeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onkeyUp, this);
    }

    onDisable () {
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.KEY_DOWN, this.onkeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onkeyUp, this);
    }
    
    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
    }

    update(deltaTime: number) {
        
    }

    private onTouchMove(e: EventTouch) {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        if (this.controller.isOutUI()) {
            if (this.isRotating) {
                const deltaMove: Vec2 = (e.getDelta()).multiplyScalar(0.5);
                this.node.rotate(Quat.fromEuler(new Quat(), -deltaMove.y, deltaMove.x, 0), 1);
            }
        }
    }

    private onkeyDown(key: EventKeyboard) {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        
        if (this.controller.isOutUI()) {
            if (key.keyCode === KeyCode.ALT_LEFT) {
                this.isRotating = true;
            }
        } 

    }

    private onkeyUp(key: EventKeyboard) {
        if (this.controller.isOutUI()) {
            if (key.keyCode === KeyCode.ALT_LEFT) {
                this.isRotating = false;
            }
        } 
    }
}


