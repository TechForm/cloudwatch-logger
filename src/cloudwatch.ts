import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  InputLogEvent,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, readdir, rename, stat, unlink, appendFile } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';
import stringify from 'safe-stable-stringify';
import { setTimeout } from 'timers/promises';
import { validateLogEntry } from '.';
import Logger from './logger';
import { RequiredRecord } from './types';

export interface InitCloudwatchLogsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  /** The region of the log group */ region: string;
  /** The name of the target log group */ logGroupName: string;
  /** The amount of millis to wait between log uploads. Defaults to 1 minute */ uploadInterval?: number;
  /** The amount of millis to wait before creating a new logstream. Defaults to 24 hours. */ recreateLogStreamInterval?: number;
}

let logStreamName = randomUUID();
let client: CloudWatchLogsClient;
let logGroupName: string;

let sequenceToken: string | undefined;
let newLogStreamInterval: NodeJS.Timeout;
let putLogsInterval: NodeJS.Timeout;
let logStreamReady = false;

let logger: Logger | undefined;

/**
 * Initializes a cloudwatch logs client, and uploads the logs every
 * @param config The configuration required to communicate with a cloudwatch backend
 */
export function initCloudwatchLogs(config: InitCloudwatchLogsConfig) {
  logger = new Logger('CLOUDWATCH');
  newLogStreamInterval = setInterval(() => {
    if (logStreamReady) {
      logStreamReady = false;
      logStreamName = randomUUID();
      clearInterval(newLogStreamInterval);
      initCloudwatchLogs(config);
    }
  }, config.recreateLogStreamInterval || 1000 * 60 * 60 * 24);

  if (!putLogsInterval) {
    putLogsInterval = setInterval(() => {
      putLogEvents();
    }, config.uploadInterval || 1000 * 60);
  }
  client = new CloudWatchLogsClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  logGroupName = config.logGroupName;
  const createStreamCommand = new CreateLogStreamCommand({
    logGroupName,
    logStreamName,
  });
  client
    .send(createStreamCommand)
    .then(() => {
      sequenceToken = undefined;
      logStreamReady = true;
      logger?.info('Created log stream');
    })
    .catch(async err => {
      logger?.error('Could not create log stream', err);
      await setTimeout(10000);
      initCloudwatchLogs(config);
    });
}

/**
 * Uploads the logs in Logger.logsDir to cloudwatch.
 * initCloudwatchLogs has to be called prior to calling this function.
 * @returns void
 */
export async function putLogEvents() {
  logger?.info('Putting logEvents to cloudwatch');
  if (!logStreamReady) {
    logger?.info('Log stream not ready, skipping');
    return;
  }
  if (!client || !logStreamName || !logGroupName) {
    logger?.error(
      'Client, streamName or groupName was not defined, did you remember call initCloudwatchLogs?',
    );
    return;
  }
  try {
    const files = await readdir(Logger.logsDir);
    Logger.resetLogFile();
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await uploadFileToCloudwatch(file);
    }
  } catch (error) {
    logger?.error('Could not read files in logsdir', error);
  }
}

async function uploadFileToCloudwatch(file: string) {
  try {
    const filePath = join(Logger.logsDir, file);

    const stats = await stat(filePath);
    if (Date.now() - stats.birthtimeMs > 1000 * 60 * 60 * 24 * 4) {
      try {
        logger?.warn(
          'A batchfile was more than 4 days old, moving it to rejectedLogsDir',
        );
        await mkdir(Logger.rejectedLogsDir, { recursive: true });
        await rename(
          filePath,
          join(
            Logger.rejectedLogsDir,
            `${new Date().toISOString().replaceAll(':', '-')}-${file}`,
          ),
        );
      } catch (error) {
        logger?.error(
          `Could not move logFile ${file} to rejectedLogsDir`,
          error,
        );
      }
      return;
    }
    const stream = createReadStream(filePath);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });
    const batch: RequiredRecord<InputLogEvent>[] = [];
    for await (const line of rl) {
      try {
        const result = validateLogEntry(line);

        const { timestamp, ...rest } = result;
        batch.push({
          timestamp,
          message: stringify(rest),
        });
      } catch (error) {
        logger?.error('Could not validate log event', error);
      }
    }
    stream.close();
    if (batch.length < 1) {
      // No logs were found in batch file
      await unlink(filePath);
      return;
    }
    batch.sort((a, b) => a.timestamp - b.timestamp);
    const putLogsCommand = new PutLogEventsCommand({
      logEvents: batch,
      logGroupName,
      logStreamName,
      sequenceToken,
    });
    const putLogsResponse = await client.send(putLogsCommand);
    sequenceToken = putLogsResponse.nextSequenceToken;
    const { rejectedLogEventsInfo } = putLogsResponse;
    if (rejectedLogEventsInfo) {
      logger?.error(
        'Received rejectedLogEventsInfo in putLogsResponse, moving rejected events to rejectedLogsFile',
      );
      let rejectedEvents: RequiredRecord<InputLogEvent>[] = [];
      const {
        expiredLogEventEndIndex,
        tooNewLogEventStartIndex,
        tooOldLogEventEndIndex,
      } = rejectedLogEventsInfo;

      if (expiredLogEventEndIndex !== undefined) {
        rejectedEvents = rejectedEvents.concat(
          batch.slice(0, expiredLogEventEndIndex),
        );
      }
      if (tooNewLogEventStartIndex !== undefined) {
        rejectedEvents = rejectedEvents.concat(
          batch.slice(tooNewLogEventStartIndex),
        );
      }
      if (tooOldLogEventEndIndex !== undefined) {
        rejectedEvents = rejectedEvents.concat(
          batch.slice(0, tooOldLogEventEndIndex),
        );
      }
      if (rejectedEvents.length > 0) {
        try {
          await mkdir(Logger.rejectedLogsDir, { recursive: true });
          const stringToWrite = rejectedEvents
            .map(value => stringify(value))
            .join('\n');
          await appendFile(
            join(
              Logger.rejectedLogsDir,
              `${new Date().toISOString().replaceAll(':', '-')}-${file}`,
            ),
            stringToWrite,
          );
        } catch (error) {
          logger?.error(
            'Could not write rejectedEvents to rejectedLogsDir, trying to move entire file to rejectedLogsDir',
            error,
          );
          try {
            await setTimeout(300);
            await mkdir(Logger.rejectedLogsDir, { recursive: true });
            await rename(
              filePath,
              join(
                Logger.rejectedLogsDir,
                `${new Date().toISOString().replaceAll(':', '-')}-${file}`,
              ),
            );
          } catch (err) {
            logger?.error(
              'Could not move logFile to rejectedLogsDir after trying to write rejectedEvents',
            );
          }
          return;
        }
      }
    }

    await unlink(filePath);
  } catch (error) {
    logger?.error('Error while reading readstream for batchfile', error);
  }
}
