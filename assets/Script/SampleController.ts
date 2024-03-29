import { _decorator, Button, Component, director, EventHandler, Label, Node, Slider } from 'cc';
import { MainController } from './Controller';
const { ccclass } = _decorator;

@ccclass('SampleController')
export class SampleController extends Component {
    private controller: MainController = null;
    private backToTotal: Node = null;
    private btButton: Button = null;
    private totalSlider: Node = null;
    private slider: Slider = null;

    start() {
        this.controller = director.getScene().getChildByName('MainController').getComponent(MainController);
        this.totalSlider = this.node.getChildByName('TotalSlider');
        this.slider = this.totalSlider.getComponent(Slider);
        this.backToTotal = this.node.getChildByName('BackToTotal');
        this.btButton = this.backToTotal.getComponent(Button);

        console.log(this.slider);
        console.log(this.btButton);

        const sliderEvent = new EventHandler();
        sliderEvent.target = this.node;
        sliderEvent.component = 'SampleController';
        sliderEvent.handler = 'onSlide';
        this.slider.slideEvents.push(sliderEvent);

        const buttonEvent = new EventHandler();
        buttonEvent.target = this.node;
        buttonEvent.component = 'SampleController';
        buttonEvent.handler = 'onBackButtonClick';
        this.btButton.clickEvents.push(buttonEvent);
    }

    private onSlide() {
        const progress = Math.max(parseFloat(this.slider.progress.toFixed(2)), 0.01);
        this.slider.progress = progress;
        this.totalSlider.getChildByName('progress').getComponent(Label).string = (progress * 100).toFixed(0) + '%';
    }

    private onBackButtonClick() {
        this.totalSlider.active = true;
        this.backToTotal.active = false;
        this.checkProgress();
    }

    public checkProgress() {
        this.controller.onChangeSlide(this.slider.progress);
    }

    public onSampleRangeButtonClick() {
        this.totalSlider.active = false;
        this.backToTotal.active = true;
        this.controller.sampleRangeScatter();

    }


}


