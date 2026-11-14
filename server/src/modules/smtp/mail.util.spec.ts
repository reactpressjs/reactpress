jest.mock('nodemailer', () => {
  const sendMail = jest.fn();
  const createTransport = jest.fn(() => ({ sendMail }));
  return { createTransport, __sendMail: sendMail };
});

import { sendEmail } from './mail.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailerMock = require('nodemailer') as {
  createTransport: jest.Mock;
  __sendMail: jest.Mock;
};

describe('sendEmail', () => {
  const transport = { host: 'smtp.test', port: '587', user: 'u', pass: 'p' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects when SMTP configuration is incomplete', async () => {
    await expect(sendEmail({ to: 'a@b.com' }, { ...transport, host: '' })).rejects.toThrow(
      'SMTP configuration is incomplete'
    );
    expect(nodemailerMock.createTransport).not.toHaveBeenCalled();
  });

  it('creates transport with TLS for port 587', async () => {
    nodemailerMock.__sendMail.mockImplementation((_msg: unknown, cb: (err: null, info: unknown) => void) =>
      cb(null, { messageId: '1' })
    );

    await sendEmail({ to: 'a@b.com', subject: 'Hi' }, transport);

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: 'u', pass: 'p' },
      })
    );
    expect(nodemailerMock.__sendMail).toHaveBeenCalled();
  });

  it('uses secure transport for port 465', async () => {
    nodemailerMock.__sendMail.mockImplementation((_msg: unknown, cb: (err: null, info: unknown) => void) =>
      cb(null, { messageId: '2' })
    );

    await sendEmail({ to: 'a@b.com' }, { ...transport, port: '465' });

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
      })
    );
    expect(nodemailerMock.createTransport.mock.calls[0][0]).not.toHaveProperty('requireTLS');
  });

  it('rejects when sendMail reports an error', async () => {
    nodemailerMock.__sendMail.mockImplementation((_msg: unknown, cb: (err: Error, info: null) => void) =>
      cb(new Error('smtp down'), null)
    );

    await expect(sendEmail({ to: 'a@b.com' }, transport)).rejects.toThrow('smtp down');
  });
});
