import { filterInt, validateLogEntry } from '../src/util';

describe('Util', () => {
  it('parses strings as ints strictly', () => {
    expect(filterInt('123')).toBe(123);
    expect(filterInt('ab12df')).toBe(NaN);
    expect(filterInt('12321fds123')).toBe(NaN);
  });
  it('validates logentries', () => {
    expect(() => {
      validateLogEntry('fdsfadsa');
    }).toThrow(SyntaxError);
    expect(() => {
      validateLogEntry(JSON.stringify(['this', 'is not really', 'an object']));
    }).toThrowError('Expected logEntry to be an object');
    const logEntry = {
      timestamp: 123,
      tag: 'test',
      level: 'warn',
    };
    expect(() => {
      validateLogEntry(JSON.stringify({ ...logEntry, timestamp: '123' }));
    }).toThrowError('Expected timestamp to be of type number');
    expect(() => {
      validateLogEntry(JSON.stringify({ ...logEntry, tag: 123 }));
    }).toThrowError('Expected tag to be of type string');
    expect(() => {
      validateLogEntry(JSON.stringify({ ...logEntry, level: 123 }));
    }).toThrowError('Expected level to be a valid loglevel');
    expect(() => {
      validateLogEntry(JSON.stringify({ ...logEntry, level: 'risky' }));
    }).toThrowError('Expected level to be a valid loglevel');
    expect(validateLogEntry(JSON.stringify(logEntry))).toStrictEqual(logEntry);
  });
});
