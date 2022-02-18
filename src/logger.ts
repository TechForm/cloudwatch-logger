import { log } from 'console';
import { randomUUID } from 'crypto';
import { appendFile, mkdir } from 'fs/promises';
import { DateTime } from 'luxon';
import { join } from 'path';
import { stderr, stdout } from 'process';
import stringify from 'safe-stable-stringify';
import { setTimeout } from 'timers/promises';
import { filterInt } from '.';
import { Config, FormatFunc } from './types';
import { color, isDef, isObject } from './util';

type LogLevel = 'info' | 'warn' | 'error';
interface LogEntry {
  tag: string;
  level: LogLevel;
  message?: string;
  data?: unknown;
  timestamp: DateTime;
}

export default class Logger {
  tag: string;
  overridePrintToConsole: boolean | undefined;

  private static currentFile = randomUUID();
  private static logEvents = 0;
  private static fileSize = 0;
  private static fileCreatedAt = Date.now();
  private static logger = new Logger('LOGGER');
  private static configured = false;

  static logsDir = join(__dirname, 'batches');
  static rejectedLogsDir = join(__dirname, 'rejectedBatches');
  static printToConsole = true;
  static logToFile = true;
  static format: FormatFunc | undefined;
  static standardFormat = true;

  constructor(tag: string, printToConsole?: boolean) {
    if (!Logger.configured) {
      throw new Error('Please call Logger.configure before logging');
    }
    this.tag = tag;
    this.overridePrintToConsole = printToConsole;
  }

  static configure({
    logsDir,
    printToConsole = true,
    rejectedLogsDir,
    writeToFile = true,
    format,
    standardFormat = true,
  }: Config) {
    Logger.logsDir = logsDir;
    Logger.printToConsole = printToConsole;
    Logger.rejectedLogsDir = rejectedLogsDir;
    Logger.logToFile = writeToFile;
    Logger.format = format;
    Logger.standardFormat = standardFormat;
    Logger.configured = true;
  }

  info(message: string): void;
  info(data: unknown): void;
  info(message: string, data: unknown): void;
  info(msgOrData: string | unknown, data?: unknown) {
    if (typeof msgOrData === 'string') {
      this.log({
        level: 'info',
        message: msgOrData,
        data,
      });
    } else {
      this.log({
        level: 'info',
        data: msgOrData,
      });
    }
  }

  warn(message: string): void;
  warn(data: unknown): void;
  warn(message: string, data: unknown): void;
  warn(msgOrData: string | unknown, data?: unknown) {
    if (typeof msgOrData === 'string') {
      this.log({
        level: 'warn',
        message: msgOrData,
        data,
      });
    } else {
      this.log({
        level: 'warn',
        data: msgOrData,
      });
    }
  }

  error(message: string): void;
  error(data: unknown): void;
  error(message: string, data: unknown): void;
  error(msgOrData: string | unknown, data?: unknown) {
    if (typeof msgOrData === 'string') {
      this.log({
        level: 'error',
        message: msgOrData,
        data,
      });
    } else {
      this.log({
        level: 'error',
        data: msgOrData,
      });
    }
  }

  private log(props: { message?: string; data?: unknown; level: LogLevel }) {
    const logEntry: LogEntry = {
      level: props.level,
      tag: this.tag,
      timestamp: DateTime.now(),
    };

    let formatted = Logger.formatData(
      props.data,
      Logger.standardFormat,
      Logger.format,
    );

    if (
      props.message &&
      isObject(formatted) &&
      (typeof formatted.message === 'string' ||
        typeof formatted.message === 'number')
    ) {
      logEntry.message = `${props.message} # ${formatted.message}`;
      delete formatted.message;
      if (Object.keys(formatted).length === 0) {
        formatted = undefined;
      }
    } else if (props.message) {
      logEntry.message = props.message;
    }
    if (
      (Logger.printToConsole && this.overridePrintToConsole !== false) ||
      this.overridePrintToConsole === true
    ) {
      const { level } = logEntry;
      const levelColor =
        // eslint-disable-next-line no-nested-ternary
        level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'blue';
      const consoleString = `[${color(level, levelColor)}][${
        logEntry.tag
      }][${logEntry.timestamp.toFormat('TT.SSS')}]: ${
        logEntry.message ? `${logEntry.message} ` : ''
      }${isDef(formatted) ? stringify(formatted) : ''}\n`;
      if (logEntry.level === 'error') {
        stderr.write(consoleString);
      } else {
        stdout.write(consoleString);
      }
    }
    if (Logger.logToFile) {
      const fileString = `${stringify({
        ...logEntry,
        timestamp: logEntry.timestamp.toUTC().toMillis(),
        // eslint-disable-next-line no-nested-ternary
        ...(typeof formatted === 'object'
          ? formatted
          : typeof formatted === 'string' || typeof formatted === 'number'
          ? { data: formatted }
          : {}),
      })}\n`;

      Logger.logEvents += 1;
      Logger.fileSize += Buffer.byteLength(fileString, 'utf-8') + 26;
      if (
        Logger.logEvents > 9000 ||
        Logger.fileSize > 900000 ||
        Date.now() - Logger.fileCreatedAt > 1000 * 60 * 60 * 22
      ) {
        Logger.currentFile = randomUUID();
        Logger.logEvents = 1;
        Logger.fileSize = Buffer.byteLength(fileString, 'utf-8') + 26;
        Logger.fileCreatedAt = Date.now();
      }

      const fileName = join(Logger.logsDir, `${Logger.currentFile}.log`);

      Logger.writeToFile(fileString, fileName).catch(async () => {
        await setTimeout(500);
        try {
          await Logger.writeToFile(fileString, fileName);
        } catch (error) {
          const failedEntry: LogEntry | { timestamp: number } = {
            level: 'error',
            tag: 'LOGGER',
            timestamp: Date.now(),
            message: 'Could not write logdata to file',
            data: error,
          };
          Logger.writeToFile(`${stringify(failedEntry)}\n`, fileName).catch(
            () => {
              log(
                "A log entry was completely lost, this really shouldn't happen",
                error,
              );
            },
          );
        }
      });
    }
  }

  static resetLogFile() {
    Logger.currentFile = randomUUID();
    Logger.logEvents = 0;
    Logger.fileSize = 0;
    Logger.fileCreatedAt = Date.now();
    Logger.logger.info(`Reset logfile to ${Logger.currentFile}`);
  }

  private static async writeToFile(data: string, curFileName: string) {
    // ensure dir is present
    await mkdir(Logger.logsDir, { recursive: true });

    // write to file
    await appendFile(curFileName, data);
  }

  /**
   * Formats the data according to standardFormatting and custom formatting
   * @param data Data to format
   * @param format A function that formats and returns the data
   * @param standardFormatting If the default formatting options should apply
   * @returns A formatted data object
   */
  static formatData(
    data: unknown,
    standardFormatting: boolean,
    format?: FormatFunc,
  ) {
    if (!isDef(data)) {
      return undefined;
    }
    try {
      const newData = data;

      if (standardFormatting) {
        if (isObject(newData)) {
          // generally i don't need the stack in a production build,
          if ('stack' in newData) {
            delete newData.stack;
          }
          // stop logging a lot of aws-sdk v3 responses
          if (isObject(newData.$response)) {
            newData.headers = newData.$response.headers;
            newData.statusCode = newData.$response.statusCode;
            delete newData.$response;
          }

          for (const [key, value] of Object.entries(newData)) {
            if (
              !Number.isNaN(filterInt(key)) &&
              isObject(value) &&
              'message' in value &&
              typeof value.message === 'string'
            ) {
              if (
                'code' in value &&
                (typeof value.code === 'string' ||
                  typeof value.code === 'number')
              ) {
                newData[key] = {
                  message: value.message,
                  code: value.code,
                };
              } else {
                newData[key] = value.message;
              }
            }
          }
        }
      }

      return format ? format(newData) : newData;
    } catch (error) {
      Logger.logger.error('Could not format logdata', error);
      return undefined;
    }
  }
}
