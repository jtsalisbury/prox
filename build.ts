import shell from 'shelljs';
import config from './tsconfig.json';

const buildFolder = './dist';

if (config.staticIncludes.length > 0) {
    config.staticIncludes.forEach((include: string)=> {
        shell.cp('-R', include, buildFolder);
    });
}