const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const logFormat = winston.format.printf(({ timestamp, level, message }) => {
  return `${timestamp} [${level}] ${message}`;
});
const getYearMonthPath = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString('default', { month: 'long' });
  return path.join('logs', year.toString(), month.toLowerCase());
};
const createLogDirectories = () => {
  const dirPath = getYearMonthPath();
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const auditDir = path.join('logs', 'handler');
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }
};
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat)
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(getYearMonthPath(), '%DATE%.md'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
      auditFile: path.join('logs', 'handler', 'audit.json')
    })
  ]
});
const initializeLogger = () => {
  createLogDirectories();
};
initializeLogger();
process.on('uncaughtException', error => {
  logger.error(`🚨 **Uncaught Exception:** ${error.message}`);
  throw error;
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`🚨 **Unhandled Rejection:** at ${promise}, reason: ${reason}`);
});
module.exports = logger;
