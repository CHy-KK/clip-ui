import { _decorator, Component, Node, Graphics } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Title')
export class Title extends Component {
    start() {
        const g = this.node.getChildByName('TitleOp ').getComponent(Graphics)
        g.circle(0, 0, 16);
        g.fillColor.fromHEX('#555555');
        g.fill();
    }
}


