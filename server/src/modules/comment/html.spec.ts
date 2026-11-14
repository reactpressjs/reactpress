import { dateFormat } from '../../utils/date.util';
import { getNewCommentHTML, getReplyCommentHTML } from './html';

jest.mock('../../utils/date.util', () => ({
  dateFormat: jest.fn(() => '2020-01-01'),
}));

describe('comment html templates', () => {
  it('getNewCommentHTML embeds site and comment fields', () => {
    const html = getNewCommentHTML({
      systemTitle: 'Site',
      systemUrl: 'https://example.com',
      adminSystemUrl: 'https://example.com/admin',
      adminName: 'Admin',
      comment: { name: 'Guest', content: 'Nice post' },
    });

    expect(html).toContain('Site');
    expect(html).toContain('Admin');
    expect(html).toContain('Guest');
    expect(html).toContain('Nice post');
    expect(html).toContain('https://example.com/admin');
    expect(html).toContain('2020-01-01');
    expect(dateFormat).toHaveBeenCalled();
  });

  it('getReplyCommentHTML uses logo or favicon and reply link', () => {
    const html = getReplyCommentHTML({
      systemLogo: '',
      systemFavicon: '/favicon.png',
      systemTitle: 'Site',
      systemUrl: 'https://example.com',
      replyUserName: 'Alice',
      commentHostUrl: 'https://example.com/post/1',
    });

    expect(html).toContain('/favicon.png');
    expect(html).toContain('Alice');
    expect(html).toContain('https://example.com/post/1');
    expect(html).toContain('Site');
  });
});
