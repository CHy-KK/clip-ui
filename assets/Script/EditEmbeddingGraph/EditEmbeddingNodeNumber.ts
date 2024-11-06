import { _decorator, Component, EditBox, EventHandler, instantiate, Label, Node, Vec2 } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
import { EditEmbeddingNodeType, EditEmbeddingOutputType } from '../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('EditEmbeddingNodeNumber')
export class EditEmbeddingNodeNumber extends EditEmbeddingNodeBase {

    private cinLabel: Label = null;

    start() {
        this.backgroundGraphic.clear();
        this.backgroundGraphic.fillColor.fromHEX('#666666');
        this.backgroundGraphic.moveTo(-32, 15);
        this.backgroundGraphic.lineTo(32, 15);
        this.backgroundGraphic.lineTo(32, -32);
        this.backgroundGraphic.lineTo(-32, -32);
        this.backgroundGraphic.lineTo(-32, 15);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        this.nodeBoundingBox = {
            left: -34, 
            right: 34,
            top: 15,
            bottom: -32 
        }

        /**name label bg */
        this.backgroundGraphic.fillColor.fromHEX('#888888');
        this.backgroundGraphic.moveTo(-32, 15);
        this.backgroundGraphic.lineTo(32, 15);
        this.backgroundGraphic.lineTo(32, 1);
        this.backgroundGraphic.lineTo(-32, 1);
        this.backgroundGraphic.lineTo(-32, 15);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        this.nameLabel.setPosition(0, 15);
        this.nameLabel.getComponent(Label).string = 'Constant';
        this.outputType = EditEmbeddingOutputType.Number;
        this.outputNode.getChildByName('outputType').getComponent(Label).string = this.outputType;
      
        /**input bg */
        this.backgroundGraphic.moveTo(-32, 0);
        this.backgroundGraphic.lineTo(0, 0);
        this.backgroundGraphic.lineTo(0, -15);
        this.backgroundGraphic.lineTo(-32, -15);
        this.backgroundGraphic.lineTo(-32, 0);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        this.outputNode.setPosition(32, -8);

        /**text input bg */
        this.backgroundGraphic.moveTo(-32, -16);
        this.backgroundGraphic.lineTo(32, -16);
        this.backgroundGraphic.lineTo(32, -32);
        this.backgroundGraphic.lineTo(-32, -32);
        this.backgroundGraphic.lineTo(-32, -16);
        // this.backgroundGraphic.fill();
        this.backgroundGraphic.stroke();
        const cin = instantiate(this.EEGController.ConstantInputPrefab);
        cin.layer = this.node.layer;
        this.node.addChild(cin);
        cin.setPosition(0, -18);
        this.cinLabel = cin.getChildByName('TEXT_LABEL').getComponent(Label);
        const cinEB = cin.getComponent(EditBox);
        
        const ebEvent = new EventHandler();
        ebEvent.target = this.node;
        ebEvent.component = 'EditEmbeddingNodeNumber';
        ebEvent.handler = 'onEditBoxDidEnd';
        cinEB.editingDidEnded.push(ebEvent);
        this.value = 0;
    }

    protected override set value(val: any) {
        this._value = val;
    }

    public override get value() {
        console.log('return value: ' + this._value);
        return this._value;
    }

    public onEditBoxDidEnd() {
        const inputConstant = this.cinLabel.string;
        const num = parseFloat(inputConstant);
        if (isNaN(num)) {
            this.cinLabel.string = this.value.toString();
        } else if (this.value !== num) {
            console.log('set num ' + num);
            this.value = num;
            console.log('set val ' + this.value);
            console.log('set _val ' + this._value);
            console.log('edit end');
            this.outputTo?.getParent().getParent().getComponent(EditEmbeddingNodeBase).changeInputValue(this.outputNode);
        }
    }
    
}


