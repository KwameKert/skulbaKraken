import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://keycloak.kwamekert.com/realms/skulba-realm/protocol/openid-connect/auth?client_id=skulba-app&redirect_uri=http%3A%2F%2Flocalhost%3A4200%2F&state=8a20e4d6-6eb9-42b5-b6e4-dbef8a8b2c25&response_mode=fragment&response_type=code&scope=openid&nonce=4a064901-241c-46b7-8d81-81f1eb5c7d43&code_challenge=dOj7zKkla4FRCjtuzWLG1jl3S6BT-3FacEmFkAj--XI&code_challenge_method=S256');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('link', { name: '﨡 Staff' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: ' Add Staff' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
  await page.getByRole('link', { name: 'Filter ' }).click();
});