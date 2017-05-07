import * as winston from 'winston';

winston.configure({
    transports: [new winston.transports.Console({
        colorize: true,
        timestamp: true,
    })]
});

export default winston;