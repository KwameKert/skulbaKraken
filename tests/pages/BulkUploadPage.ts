import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { UploadFile } from '../data/bulkStudents';

export class BulkUploadPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/peoples/students/bulk-upload');
        await this.page.getByRole('heading', { name: /bulk upload students/i }).waitFor({ state: 'visible' });
    }

    // ── Form ────────────────────────────────────────────────────────────────

    get fileInput(): Locator {
        return this.page.locator('input[type="file"]');
    }

    get uploadButton(): Locator {
        return this.page.getByRole('button', { name: /upload students/i });
    }

    get resetButton(): Locator {
        return this.page.getByRole('button', { name: /^reset$/i });
    }

    get templateLink(): Locator {
        return this.page.getByRole('link', { name: /download template/i });
    }

    async selectClass(name: string): Promise<void> {
        await this.page.locator('ng-select').click();
        const option = this.page.locator('.ng-option').filter({ hasText: name }).first();
        await option.waitFor({ state: 'visible' });
        await option.click();
    }

    async chooseFile(file: UploadFile): Promise<void> {
        await this.fileInput.setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: file.buffer });
    }

    async removeFile(): Promise<void> {
        await this.page.locator('a.text-danger').click();
    }

    // ── Preview ─────────────────────────────────────────────────────────────

    get previewRows(): Locator {
        return this.page.locator('table.table-bordered tbody tr');
    }

    get recordBadge(): Locator {
        return this.page.locator('.badge').filter({ hasText: /record\(s\)/ });
    }

    get readyBadge(): Locator {
        return this.page.locator('.badge.bg-success').filter({ hasText: /ready/i });
    }

    get errorBadge(): Locator {
        return this.page.locator('.badge.bg-danger');
    }

    get missingColumnsBanner(): Locator {
        return this.page.locator('.alert-danger').filter({ hasText: /missing required columns/i });
    }

    get cellErrorBanner(): Locator {
        return this.page.locator('.alert-warning').filter({ hasText: /cell error/i });
    }

    get errorCells(): Locator {
        return this.page.locator('table.table-bordered td.table-danger');
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }
}
