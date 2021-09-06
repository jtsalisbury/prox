import WitSpeech from 'node-witai-speech';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import util from 'util';
import logger from '../services/logger';

export default class SpeechInterpreter {
    private contentType = 'audio/wav';
    private tempDir = __dirname + '/../temp/';
    private key = 0;

    constructor() { }

    public getNextKey(): number {
        this.key = this.key + 1;

        return this.key;
    }

    public convertAudio(inFile: string, outFile: string) {
        return new Promise((resolve, reject) => {
            let cmd = ffmpeg(inFile);

            cmd.inputFormat('s16le')
                .inputOptions(['-f s16le', '-ar 48000', '-ac:a 2'])
                .output(outFile)
                .outputOptions(['-ar 16000', '-ac:a 1']);

            cmd.on('end', () => {
                resolve("");
            });

            cmd.on('error', (err, stdout, stderr) => {
                logger.error('err: ' + err);
                logger.error('stdout: ' + stdout);
                logger.error('stderr: ' + stderr);

                reject(err);
            });

            cmd.run();
        });
    }

    public handleStream(stream: any): Promise<string> {
        return new Promise((resolve, reject) => {
            let key = this.getNextKey();
            let filename = this.tempDir + 'audio_' + key + '_' + Date.now() + '.pcm';

            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir);
            }

            let ws = fs.createWriteStream(filename);

            stream.pipe(ws);
            stream.on('error', e => {
                logger.error('Error while parsing audio stream: ' + e);
            });
            stream.on('end', async () => {
                let stats = fs.statSync(filename);
                let fileSizeBytes = stats.size;
                let duration = fileSizeBytes / 48000 / 4;

                if (duration < 0.5 || duration > 19) {
                    fs.unlinkSync(filename);
                    return reject("Audio stream was too short or too long. Length: " + duration);
                }

                let convName = filename.replace('pcm', 'wav');

                await this.convertAudio(filename, convName);

                resolve(convName);
            });
        });
    }

    public async interpret(stream: any): Promise<string> {
        return new Promise((resolve, reject) => {
            this.handleStream(stream).then(async (convName: string) => {
                let originalFilename = convName.replace('wav', 'pcm');

                let extractSpeechIntent = util.promisify(WitSpeech.extractSpeechIntent);

                let convStream = fs.createReadStream(convName);
                let output = await extractSpeechIntent(process.env.WITAI_TOKEN, convStream, this.contentType);
                convStream.destroy();

                fs.unlinkSync(convName);
                fs.unlinkSync(originalFilename)

                logger.info(output);

                if (output && 'entities' in output) {
                    let preface = output.entities['preface:preface'] ? output.entities['preface:preface'][0].value : null;
                    let command = output.entities['command:command'] ? output.entities['command:command'][0].value : null;

                    if (preface == null || command == null) {
                        reject('Couldn\'t find a preface or command');
                    }

                    let options = output.entities['options:options'] ? output.entities['options:options'][0].value : '';

                    let str = `${preface} ${command} ${options}`;
                    for (let ent in output.entities) {
                        if (ent == 'preface:preface' || ent == 'command:command' || ent == 'options:options') {
                            continue;
                        }

                        str += ' ' + output.entities[ent][0].value;
                    }

                    return resolve(str);
                }

                if (output && '_text' in output && output._text.length)
                    return resolve(output._text);
                if (output && 'text' in output && output.text.length)
                    return resolve(output.text);
                return resolve(output);

            }).catch(err => {
                reject(err);
            });
        });
    }
}