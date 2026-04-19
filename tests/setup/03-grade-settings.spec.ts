import { authenticatedTest as test, expect } from '../fixtures';
import { GradeSettingsPage, GradeSettingsFormData } from '../pages/GradeSettingsPage';

test.describe('Grade Settings', () => {
    test.describe('Page load', () => {
        test('loads the grade settings form', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await expect(page.locator('input[formcontrolname="continuousAssessmentWeight"]')).toBeVisible();
            await expect(page.locator('input[formcontrolname="examWeight"]')).toBeVisible();
            await expect(page.locator('input[formcontrolname="roundingPrecision"]')).toBeVisible();
        });
    });

    test.describe('Validation — bad cases', () => {
        test('shows error toast when CA + Exam weights do not sum to 100', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await gradePage.fillForm({ continuousAssessmentWeight: '60', examWeight: '30', roundingPrecision: '2' });
            await gradePage.submitForm();

            await gradePage.expectWeightSumError();
        });

        test('shows required error for CA Weight when touched and empty', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await gradePage.touchField('continuousAssessmentWeight');

            await gradePage.expectFieldError('continuousAssessmentWeight', /continuous assessment weight is required/i);
        });

        test('shows required error for Exam Weight when touched and empty', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await gradePage.touchField('examWeight');

            await gradePage.expectFieldError('examWeight', /exam weight is required/i);
        });

        test('shows required error for Rounding Precision when touched and empty', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await gradePage.touchField('roundingPrecision');

            await gradePage.expectFieldError('roundingPrecision', /rounding precision is required/i);
        });

        test('save button is disabled when form is invalid', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });

        test('rejects non-numeric input in CA Weight field', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await page.locator('input[formcontrolname="continuousAssessmentWeight"]').fill('abc');
            await gradePage.touchField('examWeight');

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });

        test('rejects Rounding Precision greater than 5', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await page.locator('input[formcontrolname="roundingPrecision"]').fill('6');
            await gradePage.touchField('continuousAssessmentWeight');

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });
    });

    test.describe('Happy path', () => {
        test('saves valid grade settings (CA=60, Exam=40, Precision=2) and shows success toast', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await gradePage.fillForm({ continuousAssessmentWeight: '60', examWeight: '40', roundingPrecision: '2' });
            await gradePage.submitForm();

            await gradePage.expectToastMessage(/success/i);
        });

        test('saves valid grade settings (CA=30, Exam=70, Precision=0)', async ({ page }) => {
            const gradePage = new GradeSettingsPage(page);
            await gradePage.visit();
            await gradePage.expectFormVisible();

            await gradePage.fillForm({ continuousAssessmentWeight: '30', examWeight: '70', roundingPrecision: '0' });
            await gradePage.submitForm();

            await gradePage.expectToastMessage(/success/i);
        });
    });


});
