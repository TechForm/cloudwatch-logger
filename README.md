# cloudwatch-logger

A simple logger, which writes to files in accordance with cloudwatch restrictions.

## Installation

```console
yarn add @techform/cloudwatch-logger
```

## Usage

At the top of your entry file, you should call `Logger.configure`:

```typescript
import Logger from '@techform/cloudwatch-logger';

Logger.configure({
  logsDir: join(__dirname, 'logs'),
  printToConsole: true,
  rejectedLogsDir: join(__dirname, 'rejectedLogs'),
  writeToFile: true,
});
```

Afterwards you can create a logger instance and use it as you would console.log/warn/error

```typescript
const logger = new Logger('COMPONENT');

logger.info('Some message', { some: 'data' });
```

The options for configuring are:
| Name | Default | Description |
| :--- | :------ | :---------- |
| logsDir | required | The directory where the logger instances creates logfiles |
| rejectedLogsDir | required | The directory where rejected logs are moved to |
| printToConsole | required | If the logger instances should print to stdout |
| writeToFile | required | If the logger instances should output to logfiles |
| format | required | A function to format the data logged, can be used to fx remove sensitive data |
| standardFormat | true | If the standard formatting should be applied. Be aware this removes the stack from error objects, the $response object from aws-sdk responses and the stack from error arrays. **!NOTE** if you disable standard formatting, you should apply your own handling of error objects, as the output is stringified using `safe-stable-stringify` which doesn't work for errors as they have no iterable keys. |

### Cloudwatch

To enable cloudwatch, you need an IAM user with `logs:PutLogEvents` and `logs:CreateLogStream` privileges. When you want to start uploading logs to cloudwatch, call `initCloudwatchLogs` with the following options:
| Name | Default | Description |
| :--- | :------ | :---------- |
| accessKeyId | required | The access key id of a user with the above permissions |
| secretAccessKey | required | The secret access key of a user with the above permissions |
| region | required | The region where the logGroup was created |
| logGroupName | required | The name of the log group where the IAM user has permission to create log streams |
| uploadInterval | 1 min | How long it will wait before uploading logs again |
| recreateLogStreamInterval | 24 hours | How long it will wait before creating a new log stream. |

After calling `initCloudwatchLogs`, logs will be uploaded from the logs dir indefinitely.
