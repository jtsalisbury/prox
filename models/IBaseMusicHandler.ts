export interface IBaseMusicHandler {
    getName(): string;
    isMatch(link: string): boolean;
    getSongs(link: string): Promise<ISongData[]>;
    getStream(url: string): any;
    getNext(url: string): any;
}

export interface ISongData {
    title: string;
    url: string;
    artists: [string];
    type: string;
    autoplay?: boolean;
    author?: string;
}