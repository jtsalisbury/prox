import { createLogger, format, transports } from 'winston';

const { combine, timestamp, prettyPrint, colorize, errors } = format;

let logger =  createLogger({
    level: 'info',
    format: combine(
        errors({ stack: true }), // <-- use errors format
        colorize(),
        timestamp(),
        prettyPrint()
      ),
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.Console()
    ]
});

logger.add(new transports.Console({
    format: format.simple()
}));



export default logger;