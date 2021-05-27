
import { IBaseMusicHandler, ISongData } from '../models/IBase';
import * as sc from 'soundcloud-downloader';

// TODO: SoundCloud doesn't work with some links, I think it's because we're determining opus, but may be in mp3

class SoundCloudMusicHandler implements IBaseMusicHandler {
    soundcloud: any = null;
    constructor() {
        this.soundcloud = sc.create({
            clientID: process.env.SOUNDCLOUD_API
        });
    }

    public getName(): string {
        return 'SoundCloud';
    }

    public isMatch(link): boolean {
        return link.indexOf('soundcloud.com') !== -1;
    }

    public async getSongs(link): Promise<ISongData[]> {
        let songs = [];

        let songInfo = await this.soundcloud.getInfo(link, process.env.SOUNDCLOUD_API);

        songs.push({
            title: songInfo.title,
            url: link,
            thumbnail: songInfo.artwork_url,
            artists: {
                [songInfo.user.full_name]: 1
            },
            type: this.getName()
        });

        return songs;
    }

    public async getStream(url) {
        let stream;
        let type;
        try {
            stream = await this.soundcloud.downloadFormat(url, sc.default.FORMATS.OPUS);
            type = 'ogg/opus';
        } catch (e)  {
            stream = await this.soundcloud.downloadFormat(url, sc.default.FORMATS.MP3);
            type = 'unknown';
        }

        return { stream: stream, type: type };
    }

    public getNext(url) {
        return 'Autoplay is not supported for SoundCloud';
    }
}

export default new SoundCloudMusicHandler();