import { _decorator, Component, Label, Mesh, MeshRenderer, Node, primitives, utils, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('QuadPanelGradient')
export class QuadPanelGradient extends Component {

    /**记录当前选中点数量 */
    private _snNum: number = 0;
    private panelMesh: Mesh[] = [];

    start() {
        // 选中两点时   
        const vertexs2 = [
            0, 30, 0, 
            200, 30, 0,
            0, 40, 0,
            200, 40, 0,
        ];

        const uvs2 = [
            0, 1,
            1, 0,
            0, 1,
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
            200, 0, 0,
            0, 200, 0,
            200, 200, 0
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
        const mr = this.getComponent(MeshRenderer);
        const childList = this.node.children;
        const posLabel = this.node.getChildByPath('select2/clickPos').getComponent(Label);
        const touchIcon = this.node.getChildByPath('select2/touchIcon');
        // 因为交互组件是挂载childList[1]下的，所以最好不要改childList[1]的position
        switch(this.snNum) {
            case 1: 
                childList[0].setPosition(new Vec3(100, 30));
                mr.mesh = null;
                break;

            case 2:
                childList[0].setPosition(new Vec3(0, 35));
                childList[1].setPosition(new Vec3(200, 35));
                touchIcon.setPosition(childList[0].position);
                mr.mesh = this.panelMesh[0];
                posLabel.string = 'k=0.00';
                break;

            case 3: {
                childList[0].setPosition(new Vec3(0, 0));
                childList[1].setPosition(new Vec3(200, 0));
                childList[2].setPosition(new Vec3(100, 175));
                touchIcon.setPosition(childList[0].position);
                mr.mesh = this.panelMesh[1];
                posLabel.string = 'α=1.00, β=0.00, γ=0.00';
                break;
            }

            case 4: {
                childList[2].setPosition(new Vec3(0, 200));
                childList[3].setPosition(new Vec3(200, 200));
                touchIcon.setPosition(childList[0].position);
                mr.mesh = this.panelMesh[2];
                posLabel.string = 'x=0.00, y=0.00';
                break;
            }
        }
    }


}


