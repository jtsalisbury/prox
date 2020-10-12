
import { IBaseMusicHandler, ISongData } from '../models/IBaseMusicHandler';
import scdl from 'soundcloud-downloader';

class SoundCloudMusicHandler implements IBaseMusicHandler {
    public getName(): string {
        return 'SoundCloud';
    }

    public isMatch(link): boolean {
        return link.indexOf('soundcloud.com') !== -1;
    }

    public async getSongs(link): Promise<ISongData[]> {
        let songs = [];

        let songInfo = await scdl.getInfo(link, process.env.SOUNDCLOUD_API);

        songs.push({
            title: songInfo.title,
            url: link,
            artists: [songInfo.user.full_name],
            type: this.getName()
        });

        return songs;
    }

    public async getStream(url) {
        let stream = await scdl.downloadFormat(url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_API);

        return { stream: stream, type: 'ogg/opus' };
    }

    public getNext(url) {
        return 'Autoplay is not supported for SoundCloud';
    }
}

export let SoundCloudHandler = new SoundCloudMusicHandler();