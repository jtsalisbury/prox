import { IBaseMusicHandler, ISongData } from '../models/IBase';
import SpotifyWebApi from 'spotify-web-api-node';
import YoutubeMusicApi from 'youtube-music-api';
import YouTubeHandler from './YouTubeMusicHandler';
import logger from '../services/logger';

//https://open.spotify.com/album/3JfSxDfmwS5OeHPwLSkrfr?si=2HTRJzihRS6soTaYDP2XkA
class SpotifyMusicHandler implements IBaseMusicHandler {
    private spotifyApi = null;
    private youtubeMusicApi = null;
    private accessTokenExpiry: Date = null;
    
    constructor() {
        this.spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });

        this.youtubeMusicApi = new YoutubeMusicApi();
        
        this.youtubeMusicApi.initalize();
        this.auth();
    }

    public getName(): string {
        return 'Spotify';
    }

    public isMatch(link): boolean {
        return link.indexOf('spotify.com') !== -1;
    }

    private async auth() {
        let data = await this.spotifyApi.clientCredentialsGrant();

        let now = Date.now();
        let expireTime = new Date(now + (1000 * data.body.expires_in));

        this.accessTokenExpiry = expireTime;
        this.spotifyApi.setAccessToken(data.body.access_token);

        logger.info('Received new Spotify token. Expires at: ' + expireTime + ', currently it is ' + new Date());
    }

    private validateAuth(): boolean {
        if (this.accessTokenExpiry.getTime() < Date.now()) {
            return false;
        }

        return true;
    }

    private getSongDataFromYoutube(spotifyTracks: object[]): Promise<ISongData[]> {
        let trackPromises = spotifyTracks.map((track: any) => {
            // a mindfuck
            if (track.track) {
                track = track.track;
            }

            let artist = track.artists[0].name;
            let name = track.name;

            let descriptor = `${name} by ${artist}`;

            return this.youtubeMusicApi.search(descriptor);
        });

        // gotta love the world of promises
        return new Promise((resolve, reject) => {
            let songs = [];

            Promise.all(trackPromises).then((results: any) => {
                results.forEach((result: any) => { 
                    let artists = {};   
                    let artist = result.content[0].author;
                    if (!artist) {
                        if (result.content[0].artist) {
                            artist = result.content[0].artist.name;
                        }
                    }

                    if (artist) {
                        artists[artist] = 1;
                    }

                    songs.push({
                        title: result.content[0].name,
                        url: `http://www.youtube.com/watch?v=${result.content[0].videoId}`,
                        artists: artists,
                        type: YouTubeHandler.getName()
                    })
                });

                resolve(songs);
            }).catch(err => {
                reject(err);
            });
        })
    }

    public async getSongs(link: string): Promise<ISongData[]> {
        if (!this.validateAuth()) {
            await this.auth();
        }

        let linkParts = link.split('/');
        let id = linkParts[linkParts.length - 1];
        let descriptor = null;

        if (link.indexOf('album') !== -1) {
            let data = await this.spotifyApi.getAlbumTracks(id);

            return this.getSongDataFromYoutube(data.body.tracks.items);
        }

        if (link.indexOf('playlist') !== -1) {
            let data = await this.spotifyApi.getPlaylistTracks(id);
            
            return this.getSongDataFromYoutube(data.body.tracks.items);
        }

        if (!descriptor) {
            return [];
        }
    }

    public async getStream(url: string) {}

    public getNext(url: string) {}
}

export default new SpotifyMusicHandler();