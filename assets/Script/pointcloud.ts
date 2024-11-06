import { _decorator, Component, Node, Prefab, instantiate, loader, TextAsset, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('pointcloud')
export class pointcloud extends Component {
    
    @property(Prefab)
    public readonly VoxelCube: Prefab = null;

    @property(TextAsset)
    itemGiftText: TextAsset = null!;
    
    start() {
        const data = this.itemGiftText.text!.split('\r\n');
        for (let i = 0; i < data.length; i++) {
            const posstr = data[i].split(' ');
            const pos = new Vec3(parseFloat(posstr[0]) - 16, parseFloat(posstr[1]) - 16, parseFloat(posstr[2]) - 16);
            const vc = instantiate(this.VoxelCube);
            this.node.addChild(vc);
            // console.log(pos);
            vc.setPosition(pos);
            vc.active = true;
        }
        this.node.setScale(0.1, 0.1, 0.1);
    }

    update(deltaTime: number) {
        
    }
}


