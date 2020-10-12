import { IBaseMusicHandler, ISongData } from '../models/IBaseMusicHandler';
import SpotifyWebApi from 'spotify-web-api-node';
import YoutubeMusicApi from 'youtube-music-api';
import { YouTubeHandler } from './YouTubeMusicHandler';

//https://open.spotify.com/album/3JfSxDfmwS5OeHPwLSkrfr?si=2HTRJzihRS6soTaYDP2XkA
class SpotifyMusicHandler implements IBaseMusicHandler {
    private spotify = null;
    private youtubeMusic = null;
    private accessTokenExpiry: Date = null;
    
    constructor() {
        this.spotify = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });

        this.youtubeMusic = new YoutubeMusicApi()
        this.youtubeMusic.initialize();

        this.accessTokenExpiry = null;

        this.auth();
    }

    public getName(): string {
        return 'Spotify';
    }

    public isMatch(link): boolean {
        return link.indexOf('spotify.com') !== -1;
    }

    private async auth() {
        let data = await this.spotify.clientCredentialsGrant();

        let now = Date.now();
        let expireTime = new Date(now + (1000 * data.body.expires_in));

        this.accessTokenExpiry = expireTime;
        this.spotify.setAccessToken(data.body.access_token);

        console.log('Received new Spotify token. Expires at: ' + expireTime + ', currently it is ' + new Date());
    }

    private validateAuth(): boolean {
        if (this.accessTokenExpiry.getTime() < Date.now()) {
            return false;
        }

        return true;
    }

    public async getSongs(link: string): Promise<ISongData[]> {
        if (!this.validateAuth()) {
            await this.auth();
        }

        let linkParts = link.split('/');
        let id = linkParts[linkParts.length - 1];
        let descriptor = null;

        if (link.indexOf('album') !== -1) {
            let data = await this.spotify.getAlbumTracks(id);

            let artist = data.body.artists[0].name;
            let album = data.body.name;

            descriptor = `${album} by ${artist} - Album Playlist`;

            let result = await this.youtubeMusic.search(descriptor);
    
            if (result.length == 0) {
                return [];
            }
    
            return [{
                title: result.content[0].name,
                url: `http://www.youtube.com/watch?v=${result.content[0].videoId}`,
                artists: [result.content[0].author],
                type: YouTubeHandler.getName()
            }];
        }

        if (link.indexOf('playlist') !== -1) {
            let data = await this.spotify.getPlaylistTracks(id);
            
            let trackPromises = data.body.tracks.items.map(track => {
                track = track.track;

                let artist = track.artists[0].name;
                let name = track.name;

                let descriptor = `${name} by ${artist}`;

                return this.youtubeMusic.search(descriptor);
            });

            // gotta love the world of promises
            return new Promise((resolve, reject) => {
                let songs = [];

                Promise.all(trackPromises).then((results: any) => {
                    results.forEach((result: any) => {    
                        songs.push({
                            title: result.content[0].name,
                            url: `http://www.youtube.com/watch?v=${result.content[0].videoId}`,
                            artists: [result.content[0].author],
                            type: YouTubeHandler.getName()
                        })
                    });

                    resolve(songs);
                }).catch(err => {
                    reject(err);
                });
            })
        }

        if (!descriptor) {
            return [];
        }
    }

    public async getStream(url: string) {}

    public getNext(url: string) {}
}

export let SpotifyHandler = new SpotifyMusicHandler();