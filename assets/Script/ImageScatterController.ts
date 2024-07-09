import { _decorator, Component, Node, director, randomRangeInt, Prefab, instantiate, Graphics, Vec2, UITransform, ImageAsset, Texture2D, SpriteFrame, Sprite, Vec3, Label, Button } from 'cc';
import { MainController, SERVER_HOST } from './Controller';
import { ScatterController } from './ScatterController';
import { drawRoundRect, RectSize, RequestName } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('ImageScatterController')
export class ImageScatterController extends Component {

    @property(Prefab)
    public readonly imageNodePrefab: Prefab = null;

    private isInitialize: boolean = false;
    private scatterController: ScatterController = null;
    private controller: MainController = null;
    private imageNodeList: Node = null;
    private imageCluster: Node = null;
    private clusterList: Node[] = []
    private scatterRect: RectSize;

    public drawImageScatter() {
        if (!this.isInitialize) {
            this.scatterController = director.getScene().getChildByPath('mainUI/InnerUI/ScatterNode').getComponent(ScatterController);
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
            this.scatterRect = this.scatterController.scatterRect;
            this.imageNodeList = this.node.getChildByName('ImageNodes');
            this.imageCluster = this.node.getChildByName('ImageCluster');
            for (let i = 0; i < this.imageCluster.children.length; i++) {
                this.clusterList.push(this.imageCluster.children[i]);
            }
            this.isInitialize = true;
        }
        this.imageNodeList = this.node.getChildByName('ImageNodes');
        const g = this.node.getChildByName('bgGraph').getComponent(Graphics);
        const innerBorder = 40;
        drawRoundRect(g, new Vec2(this.scatterRect.left - 10, this.scatterRect.top + 40), this.scatterRect.right - this.scatterRect.left + 20, this.scatterRect.top - this.scatterRect.bottom + 50, 10, true);
        g.fillColor.fromHEX('#dddddd');
        g.fill();

        this.imageNodeList.destroyAllChildren();
        // TODO: 
        // 1. 按照scatter controller当前的sample list找坐标，（可以每隔几个tile放一个，即pointtree中的）
        // 2. 后端整理数据后发送图片以及对应名称给前端
        // 3. 点击图片获取体素放到historylist中
        console.log(this.scatterController);
        const sampleList = [];
        const inList = [];
        for (let i = 0; i < this.controller.type2Idx.size; i++) {
            const typeIdxList = this.controller.type2Idx.get(i);
            const randomIdx = randomRangeInt(0, typeIdxList.length);
            const d = this.controller.data[typeIdxList[randomIdx]];
            sampleList.push(d.idx);
            const imageNode = instantiate(this.imageNodePrefab);
            this.imageNodeList.addChild(imageNode);
            inList.push(imageNode);
            imageNode.layer = this.node.layer;
            
            const nameLabel = imageNode.getChildByName('nameLabel');
            const labelNode = nameLabel.getChildByName('Label');
            const labelWidth = d.name.length * 6;
            nameLabel.getComponent(UITransform).contentSize.set(labelWidth, 13);
            labelNode.getComponent(UITransform).contentSize.set(labelWidth, 13);
            labelNode.getComponent(Label).string = d.name;
            
            const imageNodeAreaWidth = this.scatterRect.right - this.scatterRect.left - innerBorder * 2;
            const screenPos = new Vec2((d.dataPos.x - this.scatterController.scatterRange.left) * imageNodeAreaWidth / (this.scatterController.scatterRange.right - this.scatterController.scatterRange.left), 
            (d.dataPos.y - this.scatterController.scatterRange.bottom) * imageNodeAreaWidth / (this.scatterController.scatterRange.top - this.scatterController.scatterRange.bottom)); // 缩放到0-width屏幕像素空间
            
            imageNode.setPosition(screenPos.x + innerBorder, screenPos.y + innerBorder);
        }

        
        let formData = new FormData();  
        formData.append('sampleList', sampleList.toString());

        const xhr = new XMLHttpRequest();
        const url = SERVER_HOST + RequestName.GetImageList;
        xhr.open('POST', url, true);
        xhr.onreadystatechange = () => { 
            if (xhr.readyState === 4 && xhr.status === 200) { 
                const response = JSON.parse(xhr.response);
                for (let i = 0; i < sampleList.length; i++) {
                    const encoded_image = 'data:image/png;base64,' + response[i];

                    const image = new Image();
                    image.onload = () => {
                        const img = new ImageAsset(image);
                        const texture = new Texture2D();
                        texture.image = img;
                        const spf = new SpriteFrame();
                        spf.texture = texture;
                        inList[i].getComponent(Sprite).spriteFrame = spf;
                        inList[i].getComponent(UITransform).contentSize.set(30, 30);
                    }
                    image.src = encoded_image;
                }
                

            }  
        };
        xhr.send(formData);
    }


    // 后端在比较embedding距离时要记录当前查找到的最小距离以及对应簇的序号，每个簇下最终到叶节点都会记录序号，然后按照序号就可以拿到对应voxel的image之类的
    // 每次收到的图片应该为16张，即4个显示的节点以及每个节点都有三个隐藏节点，然后每次展开一个节点都要重新获取下属节点
    // 坐标可以按照四个cluster的平均值坐标然后计算偏移方向，但是偏移距离都一致
    // 后端还需要返回每个clu在embs list中的下标，方便在这里调用getvoxel接口
    // 所以最终数据格式应为：{image: ['******' * 16], idx: [k * 16], pos: [[x, y] * 16]}
    // 输入当前选中的体素在data列表中的下标，如果有则直接在层次聚类表中查找，没有则为-1，需要在层次聚类表中计算相似度
    private getHierarchyImageNode(dataIdx: number = -1) {
        if (!this.isInitialize) {
            this.scatterController = director.getScene().getChildByPath('mainUI/InnerUI/ScatterNode').getComponent(ScatterController);
            this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
            this.scatterRect = this.scatterController.scatterRect;
            this.imageNodeList = this.node.getChildByName('ImageNodes');
            this.imageCluster = this.node.getChildByName('ImageCluster');
            for (let i = 0; i < this.imageCluster.children.length; i++) {
                this.clusterList.push(this.imageCluster.children[i]);
            }
            this.isInitialize = true;
        }
        this.imageNodeList = this.node.getChildByName('ImageNodes');
        const g = this.node.getChildByName('bgGraph').getComponent(Graphics);
        g.clear();
        const innerBorder = 40;
        drawRoundRect(g, new Vec2(this.scatterRect.left - 10, this.scatterRect.top + 40), this.scatterRect.right - this.scatterRect.left + 20, this.scatterRect.top - this.scatterRect.bottom + 50, 10, true);
        g.fillColor.fromHEX('#dddddd');
        g.fill();

        let formData = new FormData(); 
        const curId = this.controller.curSelectVoxelId;
        const curEmb = this.controller.getVoxelEmbeddingById(curId);
        formData.append('voxelEmbedding', curEmb.toString());
        formData.append('idx', dataIdx.toString());
        const xhr = new XMLHttpRequest();
        const url = SERVER_HOST + RequestName.GetImageList;
        xhr.open('POST', url, true);
        xhr.onreadystatechange = () => { 
            if (xhr.readyState === 4 && xhr.status === 200) { 
                const response = JSON.parse(xhr.response);
                const cluPos = response.pos;
                const cluImage = response.image;
                const cluIdx = response.idx;
                const showRange: RectSize = {
                    left: cluPos[0][0],
                    right: cluPos[0][0],
                    bottom: cluPos[0][1],
                    top: cluPos[0][1]
                };
                for (let i = 1; i < 16; i++) {
                    showRange.left = Math.min(showRange.left, cluPos[i][0]);
                    showRange.right = Math.max(showRange.right, cluPos[i][0]);
                    showRange.bottom = Math.min(showRange.bottom, cluPos[i][1]);
                    showRange.top = Math.max(showRange.top, cluPos[i][1]);
                }
                const innerBorder = 40;
                const imageNodeAreaWidth = this.scatterRect.right - this.scatterRect.left - innerBorder * 2;
                const showWidth = showRange.right - showRange.left;
                const showHeight = showRange.top - showRange.bottom;
                const faCluPos = new Array<Vec2>(4);
                for (let i = 0; i < 4; i++) {
                    const x = imageNodeAreaWidth * (cluPos[i * 4][0] - showRange.left) / showWidth + innerBorder;
                    const y = imageNodeAreaWidth * (cluPos[i * 4][1] - showRange.bottom) / showHeight + innerBorder;
                    faCluPos[i] = new Vec2(x, y);
                }


                for (let i = 0; i < 4; i++) {
                    const clusterNode = this.clusterList[i];
                    let lastOrgPos = new Vec2();
                    let lastUiPos = new Vec2();
                    clusterNode.setPosition(faCluPos[i].x, faCluPos[i].y);
                    for (let k = 3; k >= 0; k--) {
                        const ccluIdx = i * 4 + k;
                        const encoded_image = 'data:image/png;base64,' + cluImage[ccluIdx];
                        const orgPos = new Vec2(cluPos[ccluIdx][0], cluPos[ccluIdx][1]);
                        const idx = cluIdx[ccluIdx];
                        
                        const image = new Image();

                        const cluNode = this.clusterList[i].children[k];
                        image.onload = () => {
                            const img = new ImageAsset(image);
                            const texture = new Texture2D();
                            texture.image = img;
                            const spf = new SpriteFrame();
                            spf.texture = texture;
                            if (k === 3) 
                                cluNode.getComponent(Button).normalSprite = spf;
                            cluNode.getComponent(Button).hoverSprite = spf;
                            cluNode.getComponent(UITransform).contentSize.set(50, 50);
                        }
                        image.src = encoded_image;
                        
                        if (k === 3) 
                            lastUiPos = new Vec2(0, 0);
                        else    // uipos = orgpos的偏移量归一化后*25 + lastuipos 
                            lastUiPos = Vec2.subtract(new Vec2(), orgPos, lastOrgPos).normalize().multiplyScalar(25).add(lastUiPos);
                        
                        cluNode.setPosition(lastUiPos.x, lastUiPos.y);
                        cluNode.getComponent(Button).clickEvents[0].customEventData = idx.toString();
                        lastOrgPos = cluPos[ccluIdx];
                    }
                }
                

            }  
        };
        xhr.send(formData);
    }

    public onClusterButtonClick(e) {
        const cluster = e.target;
        const fatherClu = cluster.getParent();
        fatherClu.removeChild(cluster);
        fatherClu.addChild(cluster);
        const button:Button = cluster.getComponent(Button);

        button.normalSprite = button.hoverSprite;
        for (let i = 0; i < 3; i++) {
            fatherClu.children[i].getComponent(Button).normalSprite = fatherClu.children[i].getComponent(Button).pressedSprite;
        }
    }

    /**@TODO 双击节点进入下一层级和回到上一层级的button */
}


