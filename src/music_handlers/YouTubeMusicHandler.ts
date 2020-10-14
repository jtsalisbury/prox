import { IBaseMusicHandler, ISongData } from '../models/IBase';
import ytdl from 'ytdl-core-discord';
import ytlist from 'youtube-playlist';
 
class YouTubeMusicHandler implements IBaseMusicHandler {
    public getName(): string {
        return 'YouTube';
    }

    public isMatch(link): boolean {
        return link.indexOf('youtube.com') !== -1;
    }

    public async getSongs(link): Promise<ISongData[]> {
        let links = [];
        let songs = [];

        // Determine whether we are dealing with a playlist or not
        if (link.indexOf('&list=') !== -1 || link.indexOf('playlist') !== -1) {
            // Query YouTube to get all the songs in the playlist
            let result = await ytlist(link, ['name', 'url']);
            result.data.playlist.forEach(songInfo => {
                links.push(songInfo.url);
            });
        } else {
            links.push(link);
        }
        
        for (let i = 0; i < links.length; i++) {
            let link = links[i];

            // Grab the info for our one song we want to add
            let songInfo = await ytdl.getInfo(link);
            let artists = {};

            // Get the artist
            if (songInfo.videoDetails.media.artist) {
                let newArtists = songInfo.videoDetails.media.artist.split(',');
                newArtists.forEach(artist => {
                    artist = artist.trim();

                    artists[artist] = artists[artist] ? artists[artist] + 1 : 1;
                })
            }

            songs.push({
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                artists: artists,
                type: this.getName()
            });
        };

        return songs;
    }

    public async getStream(url) {
        let stream = await ytdl(url, {
            highWaterMark: 2500000,
            filter: 'audioandvideo' 
        });

        return { stream: stream, type: 'opus' };
    }

    public async getNext(url) {
        let songInfo = await ytdl.getInfo(url);
            
        if (songInfo.related_videos.length > 0) {
            let related = songInfo.related_videos[0];

            let moreInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${related.id}`);
            let artists = {};

            // Get the artist
            if (moreInfo.videoDetails.media.artist) {
                let newArtists = moreInfo.videoDetails.media.artist.split(',');
                newArtists.forEach(artist => {
                    artist = artist.trim();

                    artists[artist] = artists[artist] ? artists[artist] + 1 : 1;
                })
            }

            return {
                title: related.title,
                url: `https://www.youtube.com/watch?v=${related.id}`,
                author: related.author,
                autoplay: true,
                artists: artists
            };
        } else {
            return 'No related videos available';
        }
    }
}

export default new YouTubeMusicHandler();