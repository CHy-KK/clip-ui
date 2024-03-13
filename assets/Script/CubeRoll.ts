import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CubeRoll')
export class CubeRoll extends Component {
    private angle = 0;
    start() {

    }

    update(deltaTime: number) {
        this.angle += deltaTime * 20;
        this.node.setRotationFromEuler(this.angle, 0, 0);
    }
}


