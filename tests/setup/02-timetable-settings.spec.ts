import { authenticatedTest as test, expect } from '../fixtures';
import { TimetableTemplateFormData, TimetableTemplatePage } from '../pages/TimetableTemplatePage';

const validTemplate: TimetableTemplateFormData = {
    name: 'E2E Default Timetable',
    status: 'ACTIVE',
    activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    dayStart: '08:00',
    dayEnd: '15:00',
    periodMinutes: '45',
    breaks: [{ startTime: '10:00', endTime: '10:15' }],
};

test.describe('Timetable Templates', () => {
    test.describe('List view', () => {
        test('loads the template list with expected columns', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitList();

            await templatePage.expectColumnHeaders(['#', 'Name', 'Active Days', 'Status', 'Actions']);
        });

        test('Add Template button navigates to the create form', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitList();

            await templatePage.clickAddTemplate();

            await expect(page).toHaveURL(/timetable\/templates\/manage/i);
            await templatePage.expectFormVisible();
        });
    });

    test.describe('Create form — page load', () => {
        test('loads the template form', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await expect(page.locator('input[formcontrolname="name"]')).toBeVisible();
            await expect(page.locator('select[formcontrolname="status"]')).toHaveValue('ACTIVE');
            await expect(page.locator('input[formcontrolname="periodMinutes"]')).toBeVisible();
            await expect(page.locator('[formarrayname="activeDays"]')).toBeVisible();
        });
    });

    test.describe('Validation — bad cases', () => {
        test('save button is disabled when form is empty', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });

        test('shows required error for Name when touched and empty', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await templatePage.touchField('name');

            await templatePage.expectFieldError(/name is required/i);
        });

        test('save button stays disabled when Period Duration is not numeric', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await templatePage.fillForm({ ...validTemplate, breaks: undefined, periodMinutes: 'abc' });

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });
    });

    test.describe('Breaks management', () => {
        test('Add Break adds a break row', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            const before = await templatePage.breakRows.count();
            await templatePage.addBreak();

            await expect(templatePage.breakRows).toHaveCount(before + 1);
        });

        test('delete button removes the break row', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await templatePage.addBreak();
            await expect(templatePage.breakRows).toHaveCount(1);

            await templatePage.removeBreak(0);

            await expect(templatePage.breakRows).toHaveCount(0);
        });
    });

    test.describe('Overrides management', () => {
        test('Add Override adds an override card', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            const before = await templatePage.overrideCards.count();
            await templatePage.addOverride();

            await expect(templatePage.overrideCards).toHaveCount(before + 1);
        });

        test('Remove button removes the override card', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await templatePage.addOverride();
            await expect(templatePage.overrideCards).toHaveCount(1);

            await templatePage.removeOverride(0);

            await expect(templatePage.overrideCards).toHaveCount(0);
        });
    });

    test.describe('Happy path', () => {
        test('creates a template (Mon–Fri, 08:00–15:00, 45 min periods, one break)', async ({ page }) => {
            const templatePage = new TimetableTemplatePage(page);
            await templatePage.visitCreate();

            await templatePage.fillForm(validTemplate);
            await expect(page.locator('button[type="submit"].btn-primary')).toBeEnabled();

            const [response] = await Promise.all([
                page.waitForResponse(res =>
                    res.url().includes('/timetable-templates') && res.request().method() === 'POST'
                ),
                templatePage.submitForm(),
            ]);
            expect(response.ok()).toBeTruthy();

            // saving navigates back to the list, where the new template should appear
            await expect(page).toHaveURL(/timetable\/templates\/?$/i);
            await templatePage.expectListVisible();
            await expect(templatePage.rowByName(validTemplate.name!)).toBeVisible();
        });
    });
});
