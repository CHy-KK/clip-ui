import { _decorator, Button, Component, director, EventHandler, input, Label, Node, Sprite } from 'cc';
import { DRAW_EDIT_VOXEL_EVENT, MainController } from './Controller';
import { EditVoxel } from './EditVoxel';
const { ccclass, property } = _decorator;

export enum InOrOut {
    In = 0,
    Out = 1,
}

@ccclass('SnapShotNode')
export class SnapShotNode extends Component {
    public vid: string = '';
    public inout: InOrOut = InOrOut.In;   // false: Inner UI, true: Out UI
    private controller: MainController = null;
    private editVoxelController: EditVoxel = null;
    private button: Button = null;

    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.editVoxelController = director.getScene().getChildByPath('Main Camera/EditVoxel').getComponent(EditVoxel);
        this.button = this.node.addComponent(Button);
        this.button.target = this.node;
        const clickEvent = new EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = 'SnapShotNode';
        clickEvent.handler = 'onClick';
        this.button.clickEvents.push(clickEvent);

    }


    private onClick() {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        if (this.inout) {
            if (this.controller.isOutUI()) {
                this.editVoxelController.onDrawEditVoxel(this.vid);
            }
        } else {
            this.controller.renderVoxelSelect(this.vid, false);
        }
    }
}


