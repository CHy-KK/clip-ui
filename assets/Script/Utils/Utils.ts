import { Texture2D, Vec2, Node } from "cc";

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

// export type 

export enum RequestName {
    InitializeOverview = '/initialize_overview',
    GetVoxel = '/get_voxel',
};

export enum SelectingType {
    None = 0,
    Single = 1,
    Range = 2,

    Multi = 3
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

export const type2Color = [
    'ff0000',
    '00ff00',
    '0000ff',
    'ffff00',
    'ff00ff',
    '00ffff',
    'f0f000',
    'f000f0',
    '00f0f0',
    '88f088',
    'f08888',
    '8888f0',
    'bcaf6e',
    'cdfcae',
    '7ac6ed',
    '34acds',
    '9fe4a5',
    'ba4390',
    '7384fa',
    '1188ee',
    'ee8811',
]

export const voxelScale = {
    Select: 0.05,
    Edit: 0.1
}

export function angle2radian(angle: number): number {
    return angle * Math.PI * 0.005555556;   // angle * pi / 180(0.005555556 = 1 / 179.999985600)
}
