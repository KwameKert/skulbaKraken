import { authenticatedTest as test, expect } from '../fixtures';
import { SchoolSettingsPage, SchoolSettingsFormData } from '../pages/SchoolSettingsPage';

test.describe('School Settings', () => {
    test.describe('Page load', () => {
        test('loads the school settings form', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await expect(page.locator('input[formcontrolname="schoolName"]')).toBeVisible();
            await expect(page.locator('input[formcontrolname="phoneNumber"]')).toBeVisible();
            await expect(page.locator('input[formcontrolname="email"]')).toBeVisible();
            await expect(page.locator('textarea[formcontrolname="address"]')).toBeVisible();
        });
    });

    test.describe('Validation — bad cases', () => {
        test('shows required error for School Name when touched and empty', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await schoolPage.touchField('schoolName');

            await schoolPage.expectFieldError('schoolName', /school name is required/i);
        });

        test('shows required error for Phone Number when touched and empty', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await schoolPage.touchField('phoneNumber');

            await schoolPage.expectFieldError('phoneNumber', /phone number is required/i);
        });

        test('shows required error for Email when touched and empty', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await schoolPage.touchField('email');

            await schoolPage.expectFieldError('email', /email is required/i);
        });

        test('shows invalid email error when a malformed email is entered', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await page.locator('input[formcontrolname="email"]').fill('not-an-email');
            await schoolPage.touchField('schoolName'); // blur email

            await schoolPage.expectFieldError('email', /valid email/i);
        });

        test('shows required error for Address when touched and empty', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await schoolPage.touchField('address');

            await schoolPage.expectFieldError('address', /address is required/i);
        });

        test('save button is disabled when form is invalid', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });
    });

    test.describe('Happy path', () => {
        const validData: SchoolSettingsFormData = {
            schoolName: 'E2E Test Academy',
            phoneNumber: '0241234567',
            email: 'admin@e2etestacademy.com',
            fax: '0301234567',
            address: '1 Test Street, Accra, Ghana',
        };

        test('saves settings with all valid fields and shows success toast', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await schoolPage.fillForm(validData);
            await schoolPage.submitForm();
        });

        test('save button is enabled when required fields are filled', async ({ page }) => {
            const schoolPage = new SchoolSettingsPage(page);
            await schoolPage.visit();
            await schoolPage.expectFormVisible();

            await schoolPage.fillForm(validData);

            await expect(page.locator('button[type="submit"].btn-primary')).toBeEnabled();
        });
    });


});
