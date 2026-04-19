import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface AcademicYearFormData {
    name: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    status?: 'ACTIVE' | 'INACTIVE';
}

export class AcademicYearPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/academic/academic-years');
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
    }

    async expectListVisible(): Promise<void> {
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
    }

    async expectColumnHeaders(headers: string[]): Promise<void> {
        for (const header of headers) {
            const th = this.page.locator('thead th').filter({ hasText: new RegExp(header, 'i') });
            await th.first().waitFor({ state: 'visible' });
        }
    }

    async clickAddAcademicYear(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /add academic year/i }),
            this.page.locator('a.btn-primary').filter({ hasText: /add academic year/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Add Academic Year button.');
    }

    async search(term: string): Promise<void> {
        const candidates = [
            this.page.locator('input[type="search"]'),
            this.page.getByRole('searchbox'),
            this.page.locator('.dataTables_filter input'),
        ];
        for (const locator of candidates) {
            if (await this.fillIfVisible(locator, term)) return;
        }
        throw new Error('Could not find search input.');
    }

    async expectDialogVisible(mode: 'Add' | 'Edit' = 'Add'): Promise<void> {
        const heading = mode === 'Edit' ? /edit academic year/i : /add academic year/i;
        await this.page.getByRole('dialog').waitFor({ state: 'visible' });
        await this.page.getByRole('heading', { name: heading }).waitFor({ state: 'visible' });
    }


    getDialogError() {
        return this.page.locator('mat-dialog-content .alert.alert-danger');
    }

    getAcademicYearDialog() {
        return this.page.locator('app-manage-academic-year');
    }

    async fillForm(data: AcademicYearFormData): Promise<void> {
        await this.fillField('input[formcontrolname="name"]', data.name);
        await this.fillField('input[formcontrolname="startDate"]', data.startDate);
        await this.fillField('input[formcontrolname="endDate"]', data.endDate);

        if (data.status) {
            const select = this.page.locator('select[formcontrolname="status"]');
            await select.selectOption(data.status);
        }
    }

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.getByRole('heading', { name: /academic year/i }).click();
    }

    async submitForm(): Promise<void> {
        const candidates = [
            this.page.getByRole('button', { name: /create|update/i }),
            this.page.locator('mat-dialog-actions button.btn-primary'),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Create/Update button.');
    }

    async cancelDialog(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /cancel/i }),
            this.page.locator('a[mat-dialog-close]'),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Cancel button.');
    }

    async openRowActions(nameOrId: string): Promise<void> {
        const row = this.page.locator('table.datatable tbody tr').filter({ hasText: nameOrId });
        const menuBtn = row.locator('.ti-dots-vertical').first();
        await menuBtn.click();
    }

    async clickEditInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const option = this.page.getByRole('link', { name: /edit/i }).first();
        await option.click();
    }

    async clickDeleteInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const candidates = [
            this.page.getByRole('link', { name: /delete/i }).first(),
            this.page.locator('.dropdown-item').filter({ hasText: /delete/i }).first(),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Delete option in row actions.');
    }

    async confirmSwalDelete(): Promise<void> {
        const confirmBtn = this.page.locator('.swal2-confirm');
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
        // Wait for popup to dismiss and network to settle after deletion
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async cancelSwalDelete(): Promise<void> {
        const cancelBtn = this.page.locator('.swal2-cancel');
        await cancelBtn.waitFor({ state: 'visible' });
        await cancelBtn.click();
        // Wait for the popup to fully dismiss before returning
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page
            .locator('.p-toast-message')
            .filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }
    async expectFieldError(message: RegExp | string): Promise<void> {
        const error = this.page
            .locator('.text-danger')
            .filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async getTableRowCount(): Promise<number> {
        return this.page
            .locator('table.datatable tbody tr')
            .filter({ hasNot: this.page.locator('td.dataTables_empty') })
            .count();
    }

    async waitForLoadingBar() {
        await this.page.locator('#loading-bar').waitFor({ state: 'hidden' });
    }

    async waitForTableToHaveRows() {
        await this.page.locator('table.datatable tbody tr').first().waitFor();
    }

    async isSubmitDisabled(): Promise<boolean> {
        return this.page.getByRole('button', { name: /create|update/i }).isDisabled();
    }

    private async fillField(selector: string, value: string): Promise<void> {
        const locator = this.page.locator(selector).first();
        await locator.clear();
        await locator.fill(value);
    }

    private async fillIfVisible(locator: Locator, value: string): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) return false;
            const target = locator.first();
            if (!(await target.isVisible())) return false;
            await target.fill(value);
            return true;
        } catch {
            return false;
        }
    }

    private async clickIfVisible(locator: Locator): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) return false;
            const target = locator.first();
            if (!(await target.isVisible())) return false;
            await target.click();
            return true;
        } catch {
            return false;
        }
    }

    private async isVisible(locator: Locator): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) return false;
            return await locator.first().isVisible();
        } catch {
            return false;
        }
    }
}
