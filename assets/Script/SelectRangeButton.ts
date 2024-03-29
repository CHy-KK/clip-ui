    import { _decorator, Button, Component, director, EventHandler, Node } from 'cc';
import { MainController } from './Controller';
const { ccclass, property } = _decorator;

@ccclass('SelectRangeButton')
export class SelectRangeButton extends Component {
    private backToTotal: Node = null;
    private controller: MainController = null;
    start() {
        this.backToTotal = director.getScene().getChildByPath('mainUI/InnerUI/BackToTotal');
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        const button = this.node.getComponent(Button);
        button.target = this.node;
        const clickEvent = new EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = 'SelectRangeButton';
        clickEvent.handler = 'onClick';
        button.clickEvents.push(clickEvent);
    }

    update(deltaTime: number) {
        
        // this.controller.onRangeSamepleButtonClick();
    }
}


