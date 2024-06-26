import { Texture2D, Vec2, Node, instantiate, Graphics } from "cc";

export type DataPoint = {
    dataPos: Vec2;
    screenPos: Vec2;
    value: number;
    idx: number;    // 映射到原数组中的序号
    type: number;
    name: string;
};

export type RectSize = {
    left: number,
    right: number, 
    bottom: number, 
    top: number
};

export type VoxelBuffer = {
    Select: Node[],
    Edit: Node[]
};

export type cubeSize = {
    left: number,
    right: number, 
    bottom: number, 
    top: number,
    front: number,
    back: number
}

// export type 

export enum RequestName {
    InitializeOverview = '/initialize_overview',
    GetVoxel = '/get_voxel',
    GetMultiVoxel = '/get_multi_voxel',
    SendImage = '/get_embeddings_by_image',
    GetContour = '/get_contour_img',
    SendPrompt = '/get_embeddings_by_text_query',
    UploadVoxel = '/upload_voxel',
    GetVoxelByEmbedding = '/get_voxel_by_embedding',
    GetImageList = '/get_image_list',
    GetVoxelByFeature = '/get_voxel_by_feature'
};

export enum SelectingType {
    None = 0,
    Single = 1,
    Range = 2,
    Multi = 3,
    Two = 4
};

export enum SnapShotState {
    None = 0,   
    wait1frame = 1,     // 下一帧截图
    ready = 2,
};

export enum ClickState {
    None = 0,
    Scatter = 1,
    Panel = 2,
    ShowSelect = 3
}

export enum EditState {
    None = 0,
    Rotate = 1,
    MultiSelect = 2,
    Selecting = 3, 
    MultiDelete = 4,
    // key up dont change to none
    DirectionalAdd = 5,
    Copying = 6,
    DirectionalAddSelect = 7,
    DirectionalAddMove = 8,
    DirectionalSubstract = 9
}

export enum EditEmbeddingNodeType {
    Add = 1,
    BiDirAdd = 2,
    Multiply = 4,
    Divide = 8,
    Max = 16,
    Min = 32,
    Voxel = 64,  
    Number = 128,
    Threshold = 256
}

export const EENTypeWithDiffOperand = EditEmbeddingNodeType.BiDirAdd | EditEmbeddingNodeType.Multiply | EditEmbeddingNodeType.Divide | EditEmbeddingNodeType.Add;

export enum EditEmbeddingOutputType {
    /**Voxel embedding */ 
    VoxelEmbedding = 'Voxel',  
    ClipEmbedding = 'Clip',
    Number = 'Constant',
    /**当前节点输入类型不满足时 */
    None = ' '
}


export const type2Color = [
    'FF0000',
    '00FF00',
    'A7E3FF',

    'FFFF00',
    'FF00FF',
    'FF8705',

    'FDBBA0',
    'A055FF',
    '00F0F0',

    '88F088',
    'F08888',
    '8888F0',
    'BCAF6E',
    'CDFCAE',
    '7AC6ED',
    '34acds',
    '9fe4a5',
    'ba4390',
    '7384fa',
    '1188ee',
]

export const voxelScale = {
    Select: 0.05,
    Edit: 0.1
}

export function angle2radian(angle: number): number {
    return angle * Math.PI * 0.005555556;   // angle * pi / 180(0.005555556 = 1 / 179.999985600)
}  

export function isPosInQuad(pos: Vec2, quad: RectSize) {
    return pos.x >= quad.left && pos.x <= quad.right && pos.y >= quad.bottom && pos.y <= quad.top;
}

/**
 * 
 * @param g Graphic组件
 * @param startPoint 起始点坐标，起始点为矩形外圈左上角
 * @param width 矩形外圈宽度
 * @param height 矩形外圈高度
 * @param r 圆角半径
 * @param fillorStroke true：fill，false：stroke
 */
export function drawRoundRect(g: Graphics, startPoint: Vec2, width: number, height: number, r: number, fillorStroke: boolean) {
    
    g.moveTo(startPoint.x + r, startPoint.y);
    g.lineTo(startPoint.x + width - r, startPoint.y);
    if (fillorStroke)
        g.lineTo(startPoint.x + width, startPoint.y - r);
    else
        g.moveTo(startPoint.x + width, startPoint.y - r);
    g.lineTo(startPoint.x + width, startPoint.y - height + r);
    if (fillorStroke)
        g.lineTo(startPoint.x + width - r, startPoint.y - height);
    else
        g.moveTo(startPoint.x + width - r, startPoint.y - height);

    g.lineTo(startPoint.x + r, startPoint.y - height);
    if (fillorStroke)
        g.lineTo(startPoint.x, startPoint.y - height + r);
    else
        g.moveTo(startPoint.x, startPoint.y - height + r);
    g.lineTo(startPoint.x, startPoint.y - r);
    g.arc(startPoint.x + width - r, startPoint.y - r, r, angle2radian(90), angle2radian(0), false);
    g.arc(startPoint.x + width - r, startPoint.y - height + r, r, angle2radian(0), angle2radian(-90), false);
    g.arc(startPoint.x + r, startPoint.y - height + r, r, angle2radian(-90), angle2radian(-180), false);
    g.arc(startPoint.x + r, startPoint.y - r, r, angle2radian(-180), angle2radian(-270), false);
}

export function drawRect(g: Graphics, startPoint: Vec2, width: number, height: number) {
    
    g.moveTo(startPoint.x, startPoint.y);
    g.lineTo(startPoint.x + width, startPoint.y);
    g.lineTo(startPoint.x + width, startPoint.y - height);
    g.lineTo(startPoint.x, startPoint.y - height);
    g.lineTo(startPoint.x, startPoint.y);
}