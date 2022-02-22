export type RequiredRecord<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

export type FormatFunc = (logData: unknown) => unknown;

export interface Config {
  /** The directory where log files are created */ logsDir: string;
  /** The directory where log files that are to old are moved */ rejectedLogsDir: string;
  /** If the logger should print to stdout. Defaults to true */ printToConsole: boolean;
  /** If the logger should output log files. Defaults to true */ writeToFile: boolean;
  /** If the logger should apply standard formatting to logdata. Defaults to true */ standardFormat?: boolean;
  /** User defined formatting of logdata */ format?: FormatFunc;
}
