let WitSpeech = require('node-witai-speech');
let SoxCommand = require('sox-audio');
let fs = require('fs');
let util = require('util');

class SpeechInterpreter {
    constructor() {
        this.contentType = 'audio/wav';
        this.tempDir = './temp/';
        this.key = 0;
    }

    getNextKey() {
        this.key = this.key + 1;

        return this.key;
    }

    convertAudio(inFile, outFile) {
        return new Promise((resolve, reject) => {
            let cmd = SoxCommand();
            let reader = fs.createReadStream(inFile);
            let writer = fs.createWriteStream(outFile);

            cmd.input(reader)
                .inputSampleRate(48000)
                .inputEncoding('signed')
                .inputBits(16)
                .inputChannels(2)
                .inputFileType('raw')
                .output(writer)
                .outputSampleRate(16000)
                .outputEncoding('signed')
                .outputBits(16)
                .outputChannels(1)
                .outputFileType('wav');

            cmd.on('end', () => {
                reader.close();
                writer.close();
                resolve();
            });

            cmd.on('error', (err, stdout, stderr) => {
                console.log('Error: ' + err);
                console.log('Sox standard out: ' + stdout);
                console.log('Sox standard error: ' + stderr);
                reject(err);
            });

            cmd.run();
        });
    }

    handleStream(stream) {
        return new Promise((resolve, reject) => {
            let key = this.getNextKey();
            let filename = this.tempDir + 'audio_' + key + '_' + Date.now() + '.tmp';

            if (!fs.existsSync(this.tempDir)){
                fs.mkdirSync(this.tempDir);
            }

            let ws = fs.createWriteStream(filename);

            stream.pipe(ws);
            stream.on('error', e => {
                console.log('Error while parsing audio stream: ' + e);
            });
            stream.on('end', async () => {
                let stats = fs.statSync(filename);
                let fileSizeBytes = stats.size;
                let duration = fileSizeBytes / 48000 / 4;

                if (duration < 0.5 || duration > 19) {
                    fs.unlinkSync(filename);
                    return reject("Audio stream was too short or too long. Length: " + duration);
                }

                let convName = filename.replace('tmp', 'wav');

                await this.convertAudio(filename, convName);

                resolve(convName);
            });
        });
    }

    async interpret(stream) {
        return new Promise((resolve, reject) => {
            this.handleStream(stream).then(async convName => {
                let originalFilename = convName.replace('wav', 'tmp');

                let extractSpeechIntent = util.promisify(WitSpeech.extractSpeechIntent);

                let convStream = fs.createReadStream(convName);
                let output = await extractSpeechIntent(process.env.WITAI_TOKEN, convStream, this.contentType);
                convStream.destroy();

                fs.unlinkSync(convName);
                fs.unlinkSync(originalFilename)

                console.log(output);

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

module.exports = SpeechInterpreter;