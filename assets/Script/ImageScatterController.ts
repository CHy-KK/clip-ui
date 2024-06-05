import { _decorator, Component, Node, director, randomRangeInt, Prefab, instantiate, Graphics, Vec2, UITransform, ImageAsset, Texture2D, SpriteFrame, Sprite, Vec3, Label } from 'cc';
import { MainController, SERVER_HOST } from './Controller';
import { ScatterController } from './ScatterController';
import { drawRoundRect, RequestName } from './Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('ImageScatterController')
export class ImageScatterController extends Component {

    @property(Prefab)
    public readonly imageNodePrefab: Prefab = null;

    private scatterController: ScatterController = null;
    private controller: MainController = null;
    private imageNodeList: Node = null;

    start() {
        this.scatterController = director.getScene().getChildByPath('mainUI/InnerUI/ScatterNode').getComponent(ScatterController);
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.drawImageScatter();
        this.imageNodeList = this.node.getChildByName('ImageNodes');

    }

    public drawImageScatter() {
        this.imageNodeList = this.node.getChildByName('ImageNodes');
        const g = this.node.getChildByName('bgGraph').getComponent(Graphics);
        const sr = this.scatterController.scatterRect;
        const innerBorder = 40;
        drawRoundRect(g, new Vec2(sr.left - 10, sr.top + 40), sr.right - sr.left + 20, sr.top - sr.bottom + 50, 10, true);
        g.fillColor.fromHEX('#dddddd');
        g.fill();

        this.imageNodeList.destroyAllChildren();
        console.log(this.scatterController.scatterRange);
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
            
            const imageNodeAreaWidth = sr.right - sr.left - innerBorder * 2;
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
}


