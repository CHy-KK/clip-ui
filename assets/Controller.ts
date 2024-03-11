import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

const SERVER_HOST = 'http://localhost:5000/';
const INITIALIZE_OVERVIEW = 'initialize_overview';

@ccclass('test')
export class test extends Component {
    start() {
        let xhr = new XMLHttpRequest();
        let url = SERVER_HOST + INITIALIZE_OVERVIEW;

        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () { // 当请求被发送到服务器时，我们需要执行一些动作  
            if (xhr.readyState === 4 && xhr.status === 200) { // 如果请求已完成，且响应状态码为200（即成功），则...  
                let response = JSON.parse(xhr.responseText); // 解析服务器响应的JSON数据  
                console.log(response); // 在控制台打印响应数据  
            }  
        };  

        console.log('try to get flask backend');
        xhr.send();
        console.log('send end');
    }

    update(deltaTime: number) {
        
    }
}


