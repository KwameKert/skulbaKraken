import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface TermFormData {
    name: string;
    academicYearName: string; // text to match in the ng-select dropdown
    startDate: string;        // YYYY-MM-DD
    endDate: string;          // YYYY-MM-DD
    status?: 'ACTIVE' | 'INACTIVE';
    isLocked?: boolean;
    isPublished?: boolean;
    description?: string;
}

export class TermPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/academic/terms');
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
    }

    async expectListVisible(): Promise<void> {
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
        await this.page.locator('#loading-bar').waitFor({ state: 'hidden' });
    }

    async expectColumnHeaders(headers: string[]): Promise<void> {
        for (const header of headers) {
            const th = this.page.locator('thead th').filter({ hasText: new RegExp(header, 'i') });
            await th.first().waitFor({ state: 'visible' });
        }
    }

    async clickAddTerm(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /add term/i }),
            this.page.locator('a.btn-primary').filter({ hasText: /add term/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Add Term button.');
    }

    async search(term: string): Promise<void> {
        const candidates = [
            this.page.getByRole('searchbox'),
            this.page.locator('input[type="search"]'),
            this.page.locator('.dataTables_filter input'),
        ];
        for (const locator of candidates) {
            if (await this.fillIfVisible(locator, term)) return;
        }
        throw new Error('Could not find search input.');
    }

    async expectDialogVisible(mode: 'Add' | 'Edit' = 'Add'): Promise<void> {
        const heading = mode === 'Edit' ? /edit term/i : /add term/i;
        await this.page.getByRole('dialog').waitFor({ state: 'visible' });
        await this.page.getByRole('heading', { name: heading }).waitFor({ state: 'visible' });
    }

    getDialogError() {
        return this.page.locator('mat-dialog-content .alert.alert-danger');
    }

    getTermDialog() {
        return this.page.locator('app-manage-term');
    }

    async fillForm(data: TermFormData): Promise<void> {
        await this.fillField('input[formcontrolname="name"]', data.name);
        await this.selectAcademicYear(data.academicYearName);
        await this.fillField('input[formcontrolname="startDate"]', data.startDate);
        await this.fillField('input[formcontrolname="endDate"]', data.endDate);

        if (data.isLocked !== undefined) {
            const checkbox = this.page.locator('input#isLocked[formcontrolname="isLocked"]');
            const checked = await checkbox.isChecked();
            if (data.isLocked !== checked) await checkbox.click();
        }

        if (data.isPublished !== undefined) {
            const checkbox = this.page.locator('input#isPublished[formcontrolname="isPublished"]');
            const checked = await checkbox.isChecked();
            if (data.isPublished !== checked) await checkbox.click();
        }

        if (data.description) {
            await this.fillField('textarea[formcontrolname="description"]', data.description);
        }

        if (data.status) {
            await this.page.locator('select[formcontrolname="status"]').selectOption(data.status);
        }
    }

    async selectAcademicYear(name: string): Promise<void> {
        const ngSelect = this.page.locator('ng-select[formcontrolname="academicYearId"]');
        await ngSelect.click();
        const option = this.page.locator('.ng-option').filter({ hasText: name }).first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
    }

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.getByRole('heading', { name: /term/i }).first().click();
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
        const option = this.page.getByText(/^Edit$/i).last();
        await option.waitFor({ state: 'visible' });
        await option.click();
    }

    async clickDeleteInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const candidates = [
            this.page.getByRole('link', { name: /^delete$/i }).first(),
            this.page.locator('.dropdown-item').filter({ hasText: /delete/i }).first(),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Delete option in row actions.');
    }

    async clickRollOverInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const candidates = [
            this.page.getByRole('link', { name: /roll over/i }).first(),
            this.page.locator('.dropdown-item').filter({ hasText: /roll over/i }).first(),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Roll Over option in row actions.');
    }

    async confirmSwalDelete(): Promise<void> {
        const confirmBtn = this.page.locator('.swal2-confirm');
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async cancelSwalDelete(): Promise<void> {
        const cancelBtn = this.page.locator('.swal2-cancel');
        await cancelBtn.waitFor({ state: 'visible' });
        await cancelBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async confirmSwalRollOver(): Promise<void> {
        const confirmBtn = this.page.locator('.swal2-confirm');
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async expectFieldError(message: RegExp | string): Promise<void> {
        const error = this.page.locator('.text-danger').filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async getTableRowCount(): Promise<number> {
        return this.page.locator('table.datatable tbody tr').count();
    }

    async waitForTableToHaveRows(): Promise<void> {
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
