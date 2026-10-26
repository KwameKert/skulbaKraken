import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Settings > Academic > Report Templates: the layouts a class's report cards can be published with. */
export class ReportTemplatePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.page.goto('/settings/academic/report-templates');
        await expect(this.page.getByRole('heading', { name: 'Report Templates' })).toBeVisible();
        await this.page.waitForLoadState('networkidle');
    }

    async names(): Promise<string[]> {
        await this.visit();
        const cells = this.page.locator('table tbody tr td:nth-child(2)');
        return (await cells.allInnerTexts()).map(n => n.trim()).filter(n => n && !/no report templates/i.test(n));
    }

    async create(name: string): Promise<void> {
        await this.page.getByRole('button', { name: /add template/i }).click();
        const dialog = this.page.locator('mat-dialog-container');
        await expect(dialog.getByRole('heading', { name: /add report template/i })).toBeVisible();
        await dialog.locator('input[formcontrolname="name"]').fill(name);
        // the options a published card is most likely to be checked against
        for (const option of ['showPosition', 'showSubjectPosition', 'showHeadmasterRemarks']) {
            await dialog.locator(`input[formcontrolname="${option}"]`).check();
        }
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /report-templates$/.test(res.url()) && res.request().method() === 'POST'),
            dialog.getByRole('button', { name: 'Create' }).click(),
        ]);
        expect(response.status(), `create template ${name}: ${await response.text()}`).toBe(201);
        await expect(dialog).toBeHidden();
    }

    /**
     * Makes sure the named template exists. Publishing needs one, and a fresh database has none; an
     * existing one is left alone because templates are shared by the whole school.
     */
    async ensureTemplate(name: string): Promise<void> {
        if ((await this.names()).includes(name)) {
            return;
        }
        await this.create(name);
    }
}
