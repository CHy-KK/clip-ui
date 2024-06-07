import { _decorator, Component, Node, Graphics, UITransform, Vec2 } from 'cc';
import { drawRoundRect } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('textInputBg')
export class textInputBg extends Component {
    start() {
        const g = this.getComponent(Graphics);
        const contentSize = this.getComponent(UITransform).contentSize;
        g.strokeColor.fromHEX('#bbbbbb');
        g.lineWidth = 2;
        drawRoundRect(g, new Vec2(-contentSize.x * 0.5, contentSize.y * 0.5), contentSize.x, contentSize.y, 5, false);
        g.stroke();

    }
}


