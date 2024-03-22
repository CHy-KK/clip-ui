import { _decorator, Button, Component, director, EventHandler, input, Label, Node, Sprite } from 'cc';
import { DRAW_EDIT_VOXEL_EVENT, MainController } from './Controller';
const { ccclass, property } = _decorator;

@ccclass('SnapShotNode')
export class SnapShotNode extends Component {
    public vid: string = '';
    public controller: MainController = null;
    private button: Button = null;

    start() {
        this.button = this.node.addComponent(Button);
        this.button.target = this.node;
        const clickEvent = new EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = 'SnapShotNode';
        clickEvent.handler = 'onClick';
        this.button.clickEvents.push(clickEvent);
    }


    private onClick() {
        if (this.controller.isOutUI()) {
            console.log('button ' + this.vid + ' is clicked');
            this.controller.drawEditVoxelIdBuffer = this.vid;
            this.controller.onDrawEditVoxel(this.vid);
            // this.controller.node.emit(DRAW_EDIT_VOXEL_EVENT, this.vid);
        }
    }
}


