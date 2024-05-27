import { _decorator, Component, Node } from 'cc';
import { EditEmbeddingNodeBase } from './EditEmbeddingNodeBase';
const { ccclass, property } = _decorator;

@ccclass('EditEmbeddingNodeOperation')
export class EditEmbeddingNodeOperation extends EditEmbeddingNodeBase {

    start() {
        console.log('EditEmbeddingNodeOperation');
    }

    update(deltaTime: number) {
        
    }
}


