import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

/** The class timetable screen: generate a timetable for classes, then look one class up. */
export class TimetablePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/timetable/list');
        await expect(this.page.getByRole('heading', { name: 'Student Timetable' })).toBeVisible();
        // the dialog is handed the classes the screen has loaded so far: opened early, it lists none
        await this.page.waitForLoadState('networkidle');
    }

    /** Opens Generate Time Table, picks the classes and queues the job. Resolves with the scheduler call. */
    async generate(classNames: string[]): Promise<Response> {
        await this.page.getByRole('link', { name: /generate\s+time table/i }).click();
        const dialog = this.page.locator('mat-dialog-container');
        await expect(dialog.getByRole('heading', { name: 'Generate Time Table' })).toBeVisible();
        for (const name of classNames) {
            await dialog.locator('ng-select#classes').click();
            await this.page.locator('.ng-option').filter({ hasText: name }).first().click();
        }
        const [response] = await Promise.all([
            this.page.waitForResponse(r => /time-table\/scheduler/.test(r.url()) && r.request().method() === 'POST'),
            dialog.getByRole('button', { name: 'Generate' }).click(),
        ]);
        return response;
    }

    /** Looks a class up and resolves with the lessons call the screen made. */
    async search(className: string): Promise<Response> {
        await this.page.locator('ng-select[formcontrolname="classId"]').click();
        await this.page.locator('.ng-option').filter({ hasText: className }).first().click();
        const [response] = await Promise.all([
            this.page.waitForResponse(r => /time-table\/lesson\/search/.test(r.url()) && r.request().method() === 'GET'),
            this.page.getByRole('button', { name: 'Search' }).click(),
        ]);
        return response;
    }

    get days(): Locator {
        return this.page.locator('app-timetable-results h6');
    }

    get lessons(): Locator {
        return this.page.locator('app-timetable-results .rounded.p-3');
    }
}
