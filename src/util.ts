type ValidatedLogEntry = Record<string, unknown> & {
  timestamp: number;
  tag: string;
  level: string;
};

export function isObject(
  input: unknown,
): input is Record<PropertyKey, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

export function isDef(val: unknown) {
  return val !== undefined && val !== null;
}

/**
 * A stricter test for integer values in strings than parseInt.
 * According to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt parseInt will return the first number it finds in a string.
 * ```
 * parseInt('some11value11', 10) // 11
 * filterInt('some11value11') // NaN
 * ```
 * @param value Value to test whether is strictly a number
 * @returns Either the numeric value of the string, or NaN
 */
export function filterInt(value: string) {
  if (/^[-+]?(\d+|Infinity)$/.test(value)) {
    return Number(value);
  }
  return NaN;
}

export function color(
  str: string,
  colour: 'red' | 'yellow' | 'green' | 'blue',
) {
  let returnStr = '';
  switch (colour) {
    case 'green':
      returnStr += '\x1b[32m';
      break;
    case 'red':
      returnStr += '\x1b[31m';
      break;
    case 'yellow':
      returnStr = '\x1b[33m';
      break;
    case 'blue':
      returnStr = '\x1b[34m';
      break;
    default:
      return str;
  }
  returnStr += `${str}\x1b[89m\x1b[0m`;
  return returnStr;
}

export function validateLogEntry(entry: string): ValidatedLogEntry {
  const parsed = JSON.parse(entry) as unknown;
  if (!isObject(parsed)) {
    throw new Error('Expected logEntry to be an object');
  }
  const { timestamp, level, tag } = parsed;
  if (typeof timestamp !== 'number') {
    throw new Error('Expected timestamp to be of type number');
  }
  if (typeof tag !== 'string') {
    throw new Error('Expected tag to be of type string');
  }
  if (
    typeof level !== 'string' ||
    !(level === 'info' || level === 'warn' || level === 'error')
  ) {
    throw new Error('Expected level to be a valid loglevel');
  }

  return {
    timestamp,
    level,
    tag,
    ...parsed,
  };
}
