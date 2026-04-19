import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://keycloak.kwamekert.com/realms/skulba-realm/protocol/openid-connect/auth?client_id=skulba-app&redirect_uri=http%3A%2F%2Flocalhost%3A4200%2F&state=ee6a6d52-885a-4625-9221-76c91d82323d&response_mode=fragment&response_type=code&scope=openid&nonce=c071b3f1-95e9-42b1-81e7-7554aff9fce4&code_challenge=3nPfxiV-ESOjEghlHshtEoFNgdU9ysVZwy7Doxz61hk&code_challenge_method=S256');
  await page.getByRole('textbox', { name: 'Username or email' }).click();
  await page.getByRole('textbox', { name: 'Username or email' }).fill('kraken@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('link', { name: ' Terms' }).click();
  await page.getByRole('link', { name: 'All Terms' }).click();
  await page.locator('div').filter({ hasText: 'IDAcademic YearNameIs' }).nth(4).click();
  await page.locator('.btn.btn-white').click();
  await page.locator('.btn.btn-white').click();
  await page.locator('.btn.btn-white').click();
  await page.locator('.btn.btn-white').click();
  await page.locator('.btn.btn-white').click();
  await page.getByRole('cell').filter({ hasText: 'EditDelete' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
});