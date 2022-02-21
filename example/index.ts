import { join } from 'path';
import Logger from '../src';

// Need to call configure before creating a logger instance
Logger.configure({
  logsDir: join(__dirname, 'tmp/logs'),
  printToConsole: true,
  rejectedLogsDir: join(__dirname, 'tmp/rejectedLogs'),
  writeToFile: true,
});

const localLogger = new Logger('example');

// Basic usage
localLogger.error('You can provide only a message');
localLogger.warn(
  new Error('You can choose to only provide some data of any type'),
);

localLogger.info(
  'This is an info message which produces a log in console and file',
  {
    message:
      'This will be concatinated the string you provide in the first parameter, because the key is "message"',
    otherData:
      'this will not be concatinated, but will be a key-value pair in the json object in the logFile',
  },
);

// You can override printToConsole on a per instance basis
const notAConsoleLogger = new Logger('notConsole', false);

notAConsoleLogger.error('This will not print to the console');

// You can reconfigure all logger instances multiple times
Logger.configure({
  logsDir: join(__dirname, 'tmp/anotherLogsDir'),
  printToConsole: false,
  rejectedLogsDir: join(__dirname, 'tmp/rejectedLogs'),
  writeToFile: true,
});

notAConsoleLogger.info('This log will now use the new logs dir');
