import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import { TermPage } from './TermPage';

export interface PublicationRow {
    className: string;
    status: string;
    publishedBy: string;
    students: string;
}

/** A term's page: its figures, and the Reports tab where a class's results are published for parents. */
export class TermDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /** The way an administrator gets here: the term list, the row's menu, View Details. */
    async openFromList(termName: string): Promise<void> {
        const terms = new TermPage(this.page);
        await terms.visit();
        await terms.openRowActions(termName);
        await this.page.getByText('View Details').last().click();
        await this.page.waitForURL(/\/academic\/terms\/\d+/);
        await this.waitForPublications();
    }

    async visit(termId: number): Promise<void> {
        await this.page.goto(`/academic/terms/${termId}`);
        await this.waitForPublications();
    }

    private async waitForPublications(): Promise<void> {
        await expect(this.page.getByRole('heading', { name: 'Report Publications' })).toBeVisible();
        await this.page.waitForLoadState('networkidle');
    }

    /** The 'Total Expected Reports' and 'Published' counters on the Reports tab. */
    async counters(): Promise<{ expected: number; published: number }> {
        const [expected, published] = (await this.page.locator('.counters').allInnerTexts()).map(Number);
        return { expected, published };
    }

    private get rows(): Locator {
        return this.page.locator('.card').filter({ hasText: 'Report Publications' }).locator('table tbody tr');
    }

    rowFor(className: string): Locator {
        return this.rows.filter({ hasText: className });
    }

    async publication(className: string): Promise<PublicationRow> {
        const cells = (await this.rowFor(className).first().locator('td').allInnerTexts()).map(c => c.trim());
        return { className: cells[0], status: cells[1], publishedBy: cells[2], students: cells[4] };
    }

    /** Opens the Publish Reports dialog, picks the class and the template, and publishes. */
    async publish(className: string, templateName: string): Promise<Response> {
        await this.page.getByRole('button', { name: /publish reports/i }).click();
        const dialog = this.page.locator('mat-dialog-container');
        await expect(dialog.getByRole('heading', { name: 'Publish Reports' })).toBeVisible();

        const [classes, template] = [dialog.locator('ng-select').nth(0), dialog.locator('ng-select').nth(1)];
        await classes.locator('input').fill(className);
        await this.page.locator('.ng-option').filter({ hasText: className }).first().click();
        // closes the class list; Escape would close the whole dialog
        await dialog.getByRole('heading', { name: 'Publish Reports' }).click();
        await template.click();
        await this.page.locator('.ng-option').filter({ hasText: templateName }).first().click();

        const [response] = await Promise.all([
            this.page.waitForResponse(res => /report-publications$/.test(res.url()) && res.request().method() === 'POST'),
            dialog.locator('button[type="submit"]').click(),
        ]);
        return response;
    }

    /** The row's own Publish button (shown while a class is a draft or failed), which publishes with no template. */
    async publishRow(className: string): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /report-publications$/.test(res.url()) && res.request().method() === 'POST'),
            this.rowFor(className).getByRole('button', { name: 'Publish' }).click(),
        ]);
        return response;
    }

    /** Unpublish with its confirmation; resolves with the API response. */
    async unpublish(className: string): Promise<Response> {
        await this.rowFor(className).getByRole('button', { name: /unpublish/i }).click();
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /report-publications\/\d+\/unpublish$/.test(res.url())),
            this.page.locator('.swal2-confirm').click(),
        ]);
        return response;
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        await expect(this.page.locator('.p-toast-message').filter({ hasText: text }).first()).toBeVisible();
    }
}
