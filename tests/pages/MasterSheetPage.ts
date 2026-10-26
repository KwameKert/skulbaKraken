import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import { ReportCardDialog } from './ReportCardDialog';

export interface MasterSheetRow {
    student: string;
    /** what each course column shows, by course name */
    scores: Record<string, string>;
    position: string;
    total: string;
}

/** The Master Sheet screen: pick a class, generate the sheet for the active term, read the table. */
export class MasterSheetPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.page.goto('/academic/grades/search-master-sheet');
        await expect(this.page.getByRole('heading', { name: 'Class Master Sheet' })).toBeVisible();
    }

    get generateButton(): Locator {
        return this.page.getByRole('button', { name: 'Generate Sheet' });
    }

    async selectClass(className: string): Promise<void> {
        await this.page.locator('ng-select').click();
        await this.page.locator('.ng-option').filter({ hasText: className }).first().click();
    }

    /** Generates the sheet and resolves with the API response the screen drew it from. */
    async generate(): Promise<Response> {
        await expect(this.generateButton).toBeEnabled();
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /grade-records\/master-sheet/.test(res.url())),
            this.generateButton.click(),
        ]);
        await expect(this.page.locator('table.datatable tbody tr').first()).toBeVisible();
        return response;
    }

    async open(className: string): Promise<Response> {
        await this.visit();
        await this.selectClass(className);
        return this.generate();
    }

    /** Clicks Report on a student's row and waits for the dialog to load the figures and any saved remarks. */
    async openReport(studentLastName: string): Promise<ReportCardDialog> {
        const row = this.page.locator('table.datatable tbody tr').filter({ hasText: studentLastName });
        await Promise.all([
            this.page.waitForResponse(res => /grade-records\/report-sheet/.test(res.url())),
            this.page.waitForResponse(res => /grade-records\/report\?/.test(res.url()) && res.request().method() === 'GET'),
            row.getByRole('button', { name: 'Report' }).click(),
        ]);
        const dialog = new ReportCardDialog(this.page);
        await dialog.waitUntilOpen();
        return dialog;
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        await expect(this.page.locator('p-toast .p-toast-detail').filter({ hasText: text }).first()).toBeVisible();
    }

    /** Column titles in order: Student, one per course, Position, Total, Action. */
    async headers(): Promise<string[]> {
        return (await this.page.locator('table.datatable thead th').allInnerTexts()).map(h => h.trim());
    }

    async rows(): Promise<MasterSheetRow[]> {
        const headers = await this.headers();
        const courses = headers.slice(1, -3);
        const rows = this.page.locator('table.datatable tbody tr');
        const result: MasterSheetRow[] = [];
        for (let i = 0; i < await rows.count(); i++) {
            const cells = (await rows.nth(i).locator('td').allInnerTexts()).map(c => c.trim());
            result.push({
                student: cells[0],
                scores: Object.fromEntries(courses.map((course, index) => [course, cells[1 + index]])),
                position: cells[1 + courses.length],
                total: cells[2 + courses.length],
            });
        }
        return result;
    }
}
