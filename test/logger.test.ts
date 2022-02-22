import { join } from 'path';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { mocked } from 'jest-mock';
import { setTimeout } from 'timers/promises';
import { access, rm } from 'fs/promises';
import { faker } from '@faker-js/faker';
import Logger, {
  initCloudwatchLogs,
  InitCloudwatchLogsConfig,
  putLogEvents,
} from '../src';

jest.mock('@aws-sdk/client-cloudwatch-logs');
jest.useFakeTimers();

const mockedCloudwatch = mocked(CloudWatchLogsClient);

const logsDir = join(__dirname, 'logs');
const rejectedLogsDir = join(__dirname, 'rejected');

const initCloudwatchConfig: InitCloudwatchLogsConfig = {
  accessKeyId: 'someKey',
  logGroupName: 'someLogGroupName',
  region: 'someRegion',
  secretAccessKey: 'someSecretKey',
};

describe('Logger', () => {
  beforeEach(() => {
    // @ts-expect-error Typescript wants to mock the whole class, which isn't needed for testing purposes
    mockedCloudwatch.mockImplementation(() => {
      return {
        send: async () => {
          return true;
        },
      };
    });
  });
  it('fails to instantiate without configuration', () => {
    expect(() => {
      new Logger('TEST');
    }).toThrowError('Please call Logger.configure before logging');
    expect(() => {
      Logger.configure({
        logsDir: 'here',
        printToConsole: true,
        rejectedLogsDir: 'there',
        writeToFile: true,
      });
      new Logger('TEST');
    }).not.toThrow();
  });

  it('writes, uploads and deletes', async () => {
    Logger.configure({
      logsDir,
      rejectedLogsDir,
      printToConsole: false,
      writeToFile: true,
    });
    const logger = new Logger('TEST');
    const logFile = Logger.getCurrentLogFile();
    logger.info('Test log');
    initCloudwatchLogs(initCloudwatchConfig);
    await setTimeout(200);
    await putLogEvents();
    expect(Logger.getCurrentLogFile()).not.toBe(logFile);
    await expect(access(join(logsDir, logFile))).rejects.toThrowError();
  });

  it('creates multiple files when reaching cloudwatch limit', async () => {
    Logger.configure({
      logsDir,
      rejectedLogsDir,
      printToConsole: false,
      writeToFile: true,
    });
    const logger = new Logger('LIMIT_TEST');
    const logFile = Logger.getCurrentLogFile();
    // 500 cards is more than enough data for the logger to switch files
    for (let i = 0; i < 500; i += 1) {
      logger.info(faker.helpers.createCard());
    }
    expect(Logger.getCurrentLogFile()).not.toEqual(logFile);
  });

  afterAll(async () => {
    await rm(logsDir, {
      force: true,
      recursive: true,
    });
  });
});
