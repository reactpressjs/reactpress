import { dateFormat } from './date.util';

describe('dateFormat', () => {
  it('formats the current date when date is null', () => {
    const result = dateFormat(null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('formats the current date when date is undefined', () => {
    const result = dateFormat(undefined as unknown as null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('formats a Date instance with a custom pattern', () => {
    const d = new Date('2020-06-15T10:30:00.000Z');
    expect(dateFormat(d, 'yyyy-MM-dd')).toBe('2020-06-15');
  });

  it('formats a date string', () => {
    expect(dateFormat('2021-03-01T00:00:00.000Z', 'yyyy')).toBe('2021');
  });
});
