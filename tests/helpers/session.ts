import { Browser, Page } from '@playwright/test';
import { loggedOut } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';

export interface Session {
    page: Page;
    login: LoginPage;
    close: () => Promise<void>;
}

/** Keycloak's default for accounts the portal creates, and again after "Reset Password". */
export const TEMP_PASSWORD = 'password';

/**
 * Opens a clean browser (no admin session) and submits the Keycloak login form.
 * `username` is the email for staff and the phone number for guardians.
 */
export async function signIn(browser: Browser, username: string, password: string): Promise<Session> {
    const context = await browser.newContext(loggedOut);
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.visit();
    await login.login(username, password);
    return { page, login, close: () => context.close() };
}

/** First login with the temporary password: set a new one and wait for the app to load. */
export async function signInAndSetPassword(
    browser: Browser,
    username: string,
    newPassword: string,
): Promise<Session> {
    const session = await signIn(browser, username, TEMP_PASSWORD);
    await session.login.expectPasswordUpdateRequired();
    await session.login.completeRequiredPasswordUpdate(newPassword);
    await session.page.waitForURL(/localhost:4200\/dashboard/);
    return session;
}
