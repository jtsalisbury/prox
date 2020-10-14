
import { IBaseMusicHandler, ISongData } from '../models/IBase';
import scdl from 'soundcloud-downloader';

// TODO: SoundCloud doesn't work with some links, I think it's because we're determining opus, but may be in mp3

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
            stream = await scdl.downloadFormat(url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_API);
            type = 'ogg/opus';
        } catch (e)  {
            stream = await scdl.downloadFormat(url, scdl.FORMATS.MP3, process.env.SOUNDCLOUD_API);
            type = 'unknown';
        }

        return { stream: stream, type: type };
    }

    public getNext(url) {
        return 'Autoplay is not supported for SoundCloud';
    }
}

export default new SoundCloudMusicHandler();