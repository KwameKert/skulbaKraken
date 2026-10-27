/**
 * Every address the tests create ends in this, so test accounts are easy to tell from real ones:
 *   admin.kraken@gmail.com, staff.<id>.kraken@gmail.com, guardian.<id>.kraken@gmail.com ...
 */
export const EMAIL_SUFFIX = 'kraken@gmail.com';

export const ADMIN_EMAIL = `admin.${EMAIL_SUFFIX}`;

export function testEmail(kind: string, id: string): string {
    return `${kind}.${id}.${EMAIL_SUFFIX}`;
}
