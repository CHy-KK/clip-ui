import { _decorator, Component, Label, Mesh, MeshRenderer, Node, primitives, utils, Vec3, Graphics, director, Vec2 } from 'cc';
import { drawRoundRect } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('QuadPanelGradient')
export class QuadPanelGradient extends Component {

    /**记录当前选中点数量 */
    private _snNum: number = 0;
    private panelMesh: Mesh[] = [];
    private posBg: Graphics = null;
    private posLabel: Node = null;
    private touchIcon: Node = null;
    private getVoxelButton: Node = null;
    private mr: MeshRenderer = null;

    start() {
        // 选中两点时   
        const vertexs2 = [
            0, 98, 0, 
            200, 98, 0,
            0, 102, 0,
            200, 102, 0,
        ];

        const uvs2 = [
            0, 0,
            1, 0,
            0, 0,
            1, 0
        ];

        const triangles2 = [
            0, 1, 2, 
            2, 1, 3
        ];
        const hexmap2: primitives.IGeometry = {
            positions: vertexs2,
            indices: triangles2,
            uvs: uvs2,
        }
        this.panelMesh.push(utils.createMesh(hexmap2));

        // 选中三点时
        const vertexs3 = [
            0, 0, 0, 
            200, 0, 0,
            100, 175, 0,
        ];

        const uvs3 = [
            0, 0,
            1, 0,
            0, 1    // uv这里不是规则的等边三角形而是等腰直角，是为了方便三种情况公用一个
        ];

        // const color = []

        const triangles3 = [0, 1, 2];
        const hexmap3: primitives.IGeometry = {
            positions: vertexs3,
            indices: triangles3,
            uvs: uvs3,
        }
        this.panelMesh.push(utils.createMesh(hexmap3));

        // 选中四点时
        const vertexs4 = [
            0, 0, 0, 
            180, 0, 0,
            0, 180, 0,
            180, 180, 0
        ];

        const uvs4 = [
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ];

        // const color = []

        const triangles4 = [
            0, 1, 2, 
            2, 1, 3
        ];
        const hexmap4: primitives.IGeometry = {
            positions: vertexs4,
            indices: triangles4,
            uvs: uvs4,
        }
        this.panelMesh.push(utils.createMesh(hexmap4));
        this.posBg = this.node.getChildByPath('select2/posBg').getComponent(Graphics);
        this.posBg.strokeColor.fromHEX('#cccccc');
        this.posBg.lineWidth = 2;
        this.posLabel = this.node.getChildByPath('select2/posBg/clickPos');
        this.touchIcon = this.node.getChildByPath('select2/touchIcon');
        this.getVoxelButton = this.node.getChildByPath('select2/getInterpolation');
        this.mr = this.getComponent(MeshRenderer);
    }

    update(deltaTime: number) {
        
    }

    set snNum(val: number) {
        this._snNum = val;
        this.changePanelShape();
    }    
    
    get snNum() {
        return this._snNum;
    }

    /**节点的active状态由panelnode自己控制，这里只需要控制panel形状，以及panelnode的position */
    private changePanelShape() {
        const childList = this.node.children;
        // 因为交互组件是挂载childList[1]下的，所以最好不要改childList[1]的position
        switch(this.snNum) {
            case 1: 
                childList[0].setPosition(new Vec3(100, 100));
                this.mr.mesh = null;
                this.posBg.clear();
                break;

            case 2:
                childList[0].setPosition(new Vec3(0, 100));
                childList[1].setPosition(new Vec3(200, 100));
                this.touchIcon.setPosition(childList[0].position);
                this.mr.mesh = this.panelMesh[0];
                this.posLabel.setPosition(100, 83);
                this.posLabel.getComponent(Label).string = 'k=0.00';
                this.getVoxelButton.setPosition(100, 50);
                this.posBg.clear();
                drawRoundRect(this.posBg, new Vec2(70, 93), 60, 20, 5, false);
                this.posBg.stroke();
                break;

            case 3: {
                childList[0].setPosition(new Vec3(0, 0));
                childList[1].setPosition(new Vec3(200, 0));
                childList[2].setPosition(new Vec3(100, 175));
                this.touchIcon.setPosition(childList[0].position);
                this.mr.mesh = this.panelMesh[1];
                this.posLabel.setPosition(100, -17);
                this.posLabel.getComponent(Label).string = 'α=1.00, β=0.00, γ=0.00';
                this.getVoxelButton.setPosition(100, -50);
                this.posBg.clear();
                drawRoundRect(this.posBg, new Vec2(30, -7), 140, 20, 5, false);
                this.posBg.stroke();
                break;
            }

            case 4: {
                childList[1].setPosition(new Vec3(180, 0));
                childList[2].setPosition(new Vec3(0, 180));
                childList[3].setPosition(new Vec3(180, 180));
                this.touchIcon.setPosition(childList[0].position);
                this.mr.mesh = this.panelMesh[2];
                this.posLabel.setPosition(90, -17);
                this.posLabel.getComponent(Label).string = 'x=0.00, y=0.00';
                this.getVoxelButton.setPosition(90, -50);
                this.posBg.clear();
                drawRoundRect(this.posBg, new Vec2(40, -7), 100, 20, 5, false);
                this.posBg.stroke();
                break;
            }
        }
    }


}


