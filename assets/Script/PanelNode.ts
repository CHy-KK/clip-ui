import { _decorator, Button, Component, director, EventHandler, Node, Sprite } from 'cc';
import { MainController } from './Controller';
import { QuadPanelGradient } from './QuadPanelGradient';
const { ccclass, property } = _decorator;

@ccclass('PanelNode')
export class PanelNode extends Component {
    @property()
    public readonly pid: number = 0;

    public vid: string = '';

    private controller: MainController = null;

    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        const button = this.node.getComponent(Button);
        button.target = this.node;
        const clickEvent = new EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = 'PanelNode';
        clickEvent.handler = 'onClick';
        button.clickEvents.push(clickEvent);
    }

    private onClick() {
        if (!this.controller)
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        // const tex2d = this.node.getComponent(Sprite).spriteFrame.texture;
        // tex2d.destroy();
        // this.node.getComponent(Sprite).spriteFrame = undefined;
        // if (!this.controller.isExistHistoryList(this.vid)) 
        //     sf.destroy();
        // this.node.getComponent(Sprite).spriteFrame.destroy();
        const childList = this.node.parent.children;
        let i = this.pid + 1;
        if (this.pid < 3 && childList[this.pid + 1].active) {
            for (; i < 4 && childList[i].active; i++) {
                console.log('switch sf');
                childList[i - 1].getComponent(Sprite).spriteFrame = childList[i].getComponent(Sprite).spriteFrame;
                childList[i - 1].getComponent(PanelNode).vid = childList[i].getComponent(PanelNode).vid;
            }
            
            console.log('deactive sf');
        } 
        childList[--i].active = false;
        childList[i].getComponent(PanelNode).vid = '';
        this.node.parent.getComponent(QuadPanelGradient).snNum -= 1;
    }
}


