import { _decorator, Button, Component, director, EventHandler, Node, Sprite, Label } from 'cc';
import { MainController } from './Controller';
import { QuadPanelGradient } from './QuadPanelGradient';
const { ccclass, property } = _decorator;

@ccclass('PanelNode')
export class PanelNode extends Component {
    @property()
    public readonly pid: number = 0;

    public vid: string = '';
    public nameLabel: Label = null;

    private quadPanelGradient: QuadPanelGradient = null;

    onEnable() {
        this.nameLabel = this.node.getChildByName('Label').getComponent(Label);
    }

    start() {
        this.quadPanelGradient = this.node.getParent().getComponent(QuadPanelGradient);
        const button = this.node.getComponent(Button);
        button.target = this.node;
        const clickEvent = new EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = 'PanelNode';
        clickEvent.handler = 'onClick';
        button.clickEvents.push(clickEvent);
    }

    private onClick() {
   
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
        if (this.quadPanelGradient.snNum-- <= 2)
            this.node.getParent().getChildByName('select2').active = false;
    }
}


