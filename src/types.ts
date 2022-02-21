export type RequiredRecord<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

export type FormatFunc = (logData: unknown) => unknown;

export interface Config {
  logsDir: string;
  rejectedLogsDir: string;
  printToConsole: boolean;
  writeToFile: boolean;
  standardFormat?: boolean;
  format?: FormatFunc;
}
