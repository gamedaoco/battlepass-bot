import { config } from './config';
import { createLogger, format, transports } from 'winston';

function getLoggerFormat() {
  let dateFmt = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });
  if (config.logging.json) {
    return format.combine(
      dateFmt,
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    )
  } else {
    return format.combine(
      dateFmt,
      format.colorize(),
      format.splat(),
      format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    );
  }
}

export const logger = createLogger({
  level: config.logging.level,
  format: getLoggerFormat(),
  transports: [
    new transports.Console()
  ]
});
