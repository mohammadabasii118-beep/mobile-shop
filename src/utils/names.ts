import { ValidationError } from './errors';

/** Customer-chosen service name: 2–32 chars, letters (any script), digits, space, - _ . ( ) */
export function validateServiceName(raw: string): string {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 32) throw new ValidationError('نام باید بین ۲ تا ۳۲ حرف باشد');
  // \u200c = Persian half-space (ZWNJ), \p{M} = combining marks
  if (!/^[\p{L}\p{N}\p{M}\u200c _.\-()]+$/u.test(name)) throw new ValidationError('فقط حروف، عدد، فاصله و - _ . ( ) مجاز است');
  return name;
}

/** Latin-safe slug for the X-UI client email (the panel stores it as the client's name). Empty if nothing usable. */
export function slugify(name: string, max = 16): string {
  return name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
}

/** Short automatic code of a service, from its order number / client email (e.g. "7583F6"). */
export function serviceCode(externalIdOrOrderNumber: string): string {
  const m = externalIdOrOrderNumber.match(/vpn-\d{6}-([a-z0-9]{6})/i) ?? externalIdOrOrderNumber.match(/adm-([a-z0-9]+)/i);
  return (m ? m[1] : externalIdOrOrderNumber.slice(-6)).toUpperCase();
}

/** Display label shown to the customer: custom name + automatic code (both). */
export const serviceLabel = (displayName: string | null | undefined, externalId: string) =>
  displayName ? `${displayName} · ${serviceCode(externalId)}` : `VPN-${serviceCode(externalId)}`;

/** Remark placed in generated direct links (shown by V2Ray apps). */
export const linkRemark = (displayName: string | null | undefined, externalId: string) =>
  displayName ? `${displayName} | VPN-${serviceCode(externalId)}` : `VPN-${serviceCode(externalId)}`;
