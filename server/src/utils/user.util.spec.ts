import { isValidEmail, isValidUsername } from './user.util';

describe('isValidEmail', () => {
  it('accepts a simple valid address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });
});

describe('isValidUsername', () => {
  it('accepts alphanumeric usernames with underscores', () => {
    expect(isValidUsername('user_name123')).toBe(true);
  });

  it('rejects invalid characters', () => {
    expect(isValidUsername('user-name')).toBe(false);
    expect(isValidUsername('user name')).toBe(false);
  });

  it('rejects reserved substrings admin and root', () => {
    expect(isValidUsername('myadmin')).toBe(false);
    expect(isValidUsername('rootuser')).toBe(false);
  });

  it('rejects a value that gains whitespace after the character check', () => {
    let calls = 0;
    const username = {
      toString() {
        calls += 1;
        return calls === 1 ? 'valid_name' : 'bad name';
      },
    };
    expect(isValidUsername(username)).toBe(false);
  });
});
