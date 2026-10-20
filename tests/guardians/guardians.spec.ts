import { authenticatedTest as test, expect } from '../fixtures';
import { GuardianModalData, GuardiansPage } from '../pages/GuardiansPage';
import { makeGuardian } from '../data/people';

const base = makeGuardian();
const guardian: GuardianModalData = {
    firstName: base.firstName,
    lastName: base.lastName,
    email: base.email,
    phoneNumber: base.phoneNumber,
    relationship: 'FATHER',
    address: base.address,
    occupation: base.occupation,
    status: 'ACTIVE',
    isSmsEnable: true,
    isEmailEnable: true,
};

const isGuardianWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/guardians') && res.request().method() === method;

test.describe.serial('Guardians', () => {
    test.describe('List view', () => {
        test('loads the guardians list with expected columns', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();

            await guardiansPage.expectColumnHeaders(['Name', 'Email', 'Phone', 'Relationship', 'Status', 'Channels', 'Action']);
        });

        test('shows the empty state when the name filter matches nobody', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();

            await guardiansPage.filterByName('zz-no-such-guardian-zz');

            await expect(guardiansPage.emptyState).toBeVisible();
        });
    });

    test.describe('Add dialog — validation', () => {
        test('submit is disabled until required fields are filled', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.openAddModal();

            await expect(guardiansPage.dialog.getByRole('heading', { name: /add guardian/i })).toBeVisible();
            expect(await guardiansPage.isModalSubmitDisabled()).toBeTruthy();
        });

        test('shows required errors when fields are touched and empty', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.openAddModal();

            await guardiansPage.touchModalField('firstName');
            await guardiansPage.touchModalField('phoneNumber');

            await guardiansPage.expectModalError(/required/i);
        });

        test('shows an error for a malformed email', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.openAddModal();

            await guardiansPage.dialog.locator('input[formcontrolname="email"]').fill('not-an-email');
            await guardiansPage.touchModalField('email');

            await guardiansPage.expectModalError(/valid email/i);
        });
    });

    test.describe('Create guardian', () => {
        test('creates a guardian and shows it in the list', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.openAddModal();

            await guardiansPage.fillModal(guardian);
            const [response] = await Promise.all([
                page.waitForResponse(isGuardianWrite('POST')),
                guardiansPage.submitModal(),
            ]);

            expect(response.ok()).toBeTruthy();
            await guardiansPage.expectToastMessage(/guardian added successfully/i);
            await expect(guardiansPage.dialog).toBeHidden();
            await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toBeVisible();
        });

        test('creating a guardian with an existing phone is rejected', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.openAddModal();

            await guardiansPage.fillModal({ ...guardian, firstName: 'Duplicate', email: undefined });
            const [response] = await Promise.all([
                page.waitForResponse(isGuardianWrite('POST')),
                guardiansPage.submitModal(),
            ]);

            expect(response.ok()).toBeFalsy();
            await guardiansPage.expectToastMessage(/failed to add guardian/i);
            await guardiansPage.cancelModal();
        });
    });

    test.describe('Edit guardian', () => {
        test('phone is locked and changes are saved', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();

            await guardiansPage.clickEditInRow(guardian.phoneNumber);
            await expect(guardiansPage.dialog.getByRole('heading', { name: /edit guardian/i })).toBeVisible();
            await expect(guardiansPage.dialog.locator('[formcontrolname="phoneNumber"]')).toBeDisabled();

            await guardiansPage.dialog.locator('input[formcontrolname="occupation"]').fill('Teacher');
            const [response] = await Promise.all([
                page.waitForResponse(isGuardianWrite('PATCH')),
                guardiansPage.submitModal(),
            ]);

            expect(response.ok()).toBeTruthy();
            await guardiansPage.expectToastMessage(/guardian updated successfully/i);
        });

        test('edit dialog shows the saved status', async ({ page }) => {

            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.clickEditInRow(guardian.phoneNumber);
            await guardiansPage.dialog.locator('select[formcontrolname="status"]').selectOption('INACTIVE');
            await Promise.all([
                page.waitForResponse(isGuardianWrite('PATCH')),
                guardiansPage.submitModal(),
            ]);
            await expect(guardiansPage.dialog).toBeHidden();

            await guardiansPage.clickEditInRow(guardian.phoneNumber);

            await expect(guardiansPage.dialog.locator('select[formcontrolname="status"]')).toHaveValue('INACTIVE');
        });
    });

    test.describe('Row actions', () => {
        test('Reset Password asks for confirmation and can be cancelled', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();

            await guardiansPage.clickResetPasswordInRow(guardian.phoneNumber);
            await expect(page.locator('.swal2-popup')).toContainText(/reset password/i);
            await guardiansPage.cancelSwal();

            await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toBeVisible();
        });

        test('cancelling delete keeps the guardian', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();

            await guardiansPage.clickDeleteInRow(guardian.phoneNumber);
            await expect(page.locator('.swal2-popup')).toBeVisible();
            await guardiansPage.cancelSwal();

            await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toBeVisible();
        });

        test('confirming delete removes the guardian', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();

            await guardiansPage.clickDeleteInRow(guardian.phoneNumber);
            const [response] = await Promise.all([
                page.waitForResponse(isGuardianWrite('DELETE')),
                guardiansPage.confirmSwal(),
            ]);

            expect(response.ok()).toBeTruthy();
            await guardiansPage.expectToastMessage(/guardian deleted successfully/i);
            await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(0);
        });


        test('a deleted guardian is reactivated when created again with the same phone', async ({ page }) => {
            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await guardiansPage.openAddModal();

            await guardiansPage.fillModal(guardian);
            const [response] = await Promise.all([
                page.waitForResponse(isGuardianWrite('POST')),
                guardiansPage.submitModal(),
            ]);

            expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
            await expect(guardiansPage.dialog).toBeHidden();
            await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toBeVisible();
        });
    });
});
