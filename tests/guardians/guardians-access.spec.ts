import { Page } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { StudentsPage } from '../pages/StudentsPage';
import { GuardiansPage } from '../pages/GuardiansPage';
import { makeGuardian, makeStudent } from '../data/people';
import { signIn, signInAndSetPassword, TEMP_PASSWORD } from '../helpers/session';

/**
 * Guardians are given a login when they are created (username = phone number, temporary
 * password). These flows check that the login works, that Reset Password really resets it,
 * and that deleting a guardian locks them out (and re-adding them restores access).
 */
const guardian = makeGuardian({ relationship: 'Mother', isPrimary: true });
const student = makeStudent();
const NEW_PASSWORD = 'Newpass#12345';
const AFTER_RESET_PASSWORD = 'Afterreset#12345';

const isGuardianWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/guardians') && res.request().method() === method;

async function createStudentWithGuardian(page: Page): Promise<void> {
    const studentsPage = new StudentsPage(page);
    await studentsPage.visitAddForm();
    await studentsPage.fillStudentForm(student);
    await studentsPage.addGuardian(guardian);
    const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST'),
        studentsPage.submitForm(),
    ]);
    expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
    await expect(page).toHaveURL(/student-details\/\d+/i);
}

test.describe.serial('Guardians — sign-in access', () => {
    test('adding a guardian through a student provisions a login', async ({ page }) => {
        await createStudentWithGuardian(page);
    });

    test('first login with phone number and temporary password forces a password change', async ({ browser }) => {
        const session = await signInAndSetPassword(browser, guardian.phoneNumber, NEW_PASSWORD);

        await expect(session.page).toHaveURL(/\/dashboard\/student-dashboard/);
        await session.close();
    });

    test('the temporary password stops working and the new password signs in', async ({ browser }) => {
        const stale = await signIn(browser, guardian.phoneNumber, TEMP_PASSWORD);
        await stale.login.expectInvalidCredentials();
        await stale.close();

        const fresh = await signIn(browser, guardian.phoneNumber, NEW_PASSWORD);
        await expect(fresh.page).toHaveURL(/\/dashboard/);
        await fresh.close();
    });

    test('Reset Password sets the temporary password again', async ({ page, browser }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await guardiansPage.clickResetPasswordInRow(guardian.phoneNumber);
        const [response] = await Promise.all([
            page.waitForResponse(res => /reset/i.test(res.url()) && res.request().method() !== 'GET'),
            guardiansPage.confirmSwal(),
        ]);
        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();

        const old = await signIn(browser, guardian.phoneNumber, NEW_PASSWORD);
        await old.login.expectInvalidCredentials();
        await old.close();

        const session = await signInAndSetPassword(browser, guardian.phoneNumber, AFTER_RESET_PASSWORD);
        await expect(session.page).toHaveURL(/\/dashboard/);
        await session.close();
    });

    test('deleting the guardian locks them out', async ({ page, browser }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(1);
        await guardiansPage.clickDeleteInRow(guardian.phoneNumber);
        const [response] = await Promise.all([
            page.waitForResponse(isGuardianWrite('DELETE')),
            guardiansPage.confirmSwal(),
        ]);
        expect(response.ok()).toBeTruthy();

        const session = await signIn(browser, guardian.phoneNumber, AFTER_RESET_PASSWORD);
        await session.login.expectInvalidCredentials();
        await session.close();
    });

    test('adding the same guardian again through a student restores them and their login', async ({ page, browser }) => {
        await createStudentWithGuardian(page);

        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(1);

        const session = await signInAndSetPassword(browser, guardian.phoneNumber, NEW_PASSWORD);
        await expect(session.page).toHaveURL(/\/dashboard/);
        await session.close();
    });
});
