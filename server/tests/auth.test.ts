import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authenticate, validateInitData } from '../src/auth';

const TOKEN = '123456:TEST-TOKEN';
function sign(fields: Record<string, string>, token = TOKEN) {
  const check = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const now = 1_700_000_000;
const user = JSON.stringify({ id: 42, first_name: 'علی', last_name: 'رضایی', photo_url: 'https://x/y.jpg' });

describe('telegram initData', () => {
  it('accepts valid data', () => {
    const d = sign({ auth_date: String(now), user, query_id: 'q' });
    expect(validateInitData(d, TOKEN, now)).toEqual({ tgId: 42, name: 'علی رضایی', avatar: 'https://x/y.jpg' });
  });
  it('rejects tampered / wrong token / stale / missing hash', () => {
    const d = sign({ auth_date: String(now), user });
    expect(validateInitData(d.replace('42', '43'), TOKEN, now)).toBeNull();
    expect(validateInitData(d, 'other:token', now)).toBeNull();
    expect(validateInitData(d, TOKEN, now + 90000)).toBeNull();
    expect(validateInitData('auth_date=1&user=%7B%7D', TOKEN, now)).toBeNull();
  });
  it('dev auth only works when enabled', () => {
    expect(authenticate('dev:5:Bob', { devAuth: true })).toMatchObject({ tgId: 5, name: 'Bob' });
    expect(authenticate('dev:5:Bob', { devAuth: false, botToken: TOKEN })).toBeNull();
    expect(authenticate(undefined, { devAuth: true })).toBeNull();
  });
});
