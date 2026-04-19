import { authenticatedTest as test, expect } from '../fixtures';
import { TimetableSettingsPage } from '../pages/TimetableSettingsPage';

test.describe('Timetable Settings', () => {
    test.describe('Page load', () => {
        test('loads the timetable settings form', async ({ page }) => {
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            await expect(page.locator('input[formcontrolname="periodMinutes"]')).toBeVisible();
            await expect(page.locator('[formarrayname="activeDays"]')).toBeVisible();
        });
    });

    test.describe('Validation — bad cases', () => {
        test('save button is disabled when form is invalid', async ({ page }) => {
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });

        test('shows error when Period Duration is cleared and form touched', async ({ page }) => {
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            await page.locator('input[formcontrolname="periodMinutes"]').fill('');
            await timetablePage.touchField('periodMinutes');

            await expect(page.locator('button[type="submit"].btn-primary')).toBeDisabled();
        });

        test('add override button adds an override card', async ({ page }) => {
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            const cards = page.locator('[formarrayname="overrides"] > div');

            const before = await cards.count();
            await timetablePage.addOverride();

            await expect.poll(async () => await cards.count()).toBe(before + 1);
        });

        test('remove override button removes the override card', async ({ page }) => {
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            const cards = page.locator('[formarrayname="overrides"] > div');
            await timetablePage.addOverride();
            await expect(cards).toHaveCount(1);
            const before = await cards.count();
            await timetablePage.removeOverride(0);
            await expect(cards).toHaveCount(before - 1);
        });
    });
    test.describe('Happy path', () => {


        test('saves settings with a break added', async ({ page, truncateSchema }) => {
            await truncateSchema();
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            await timetablePage.fillForm({
                activeDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
                dayStart: '08:00',
                dayEnd: '14:00',
                periodMinutes: '40',
                breaks: [{ startTime: '10:00', endTime: '10:15' }],
            });

            await timetablePage.submitForm();

            await timetablePage.expectToastMessage(/success/i);
        });

        test('saves valid timetable settings (Mon–Fri, 08:00–15:00, 45 min periods)', async ({ page, truncateSchema }) => {
            await truncateSchema();
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            await timetablePage.fillForm({
                activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
                dayStart: '08:00',
                dayEnd: '15:00',
                periodMinutes: '45',
            });

            await timetablePage.submitForm();

            await timetablePage.expectToastMessage(/success/i);
        });
    });

    test.describe('Breaks management', () => {
        test('adds a break row when Add Break is clicked', async ({ page, truncateSchema }) => {
            await truncateSchema();
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();
            const breaks = page.locator('[formarrayname="breaks"] > div');
            const before = await breaks.count();
            await page
                .locator('[formarrayname="breaks"]')
                .getByRole('button', { name: /add break/i })
                .click();

            await expect.poll(async () => await breaks.count()).toBe(before + 1);
        });

        test('removes a break row when the delete button is clicked', async ({ page }) => {
            const timetablePage = new TimetableSettingsPage(page);
            await timetablePage.visit();
            await timetablePage.expectFormVisible();

            const breaks = page.locator('[formarrayname="breaks"] > div');

            await page
                .locator('[formarrayname="breaks"]')
                .getByRole('button', { name: /add break/i })
                .click();

            await expect(breaks).toHaveCount(1);
            const before = await breaks.count();
            await timetablePage.removeBreak(0);
            await expect.poll(async () => await breaks.count()).toBe(before - 1);
        });
    });


});
