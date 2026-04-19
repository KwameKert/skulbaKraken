import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface ClassFormData {
    name: string;
    teacherName?: string; // text to match in the ng-select dropdown
    description?: string;
    status?: 'ACTIVE' | 'INACTIVE';
}

export class ClassPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/academic/classes');
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

    async clickAddClass(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /add class/i }),
            this.page.locator('a.btn-primary').filter({ hasText: /add class/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Add Class button.');
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
        const heading = mode === 'Edit' ? /edit class/i : /add class/i;
        await this.page.getByRole('dialog').waitFor({ state: 'visible' });
        await this.page.getByRole('heading', { name: heading }).waitFor({ state: 'visible' });
    }

    getDialogError() {
        return this.page.locator('mat-dialog-content .alert.alert-danger');
    }

    async fillForm(data: ClassFormData): Promise<void> {
        await this.fillField('input[formcontrolname="name"]', data.name);

        if (data.teacherName) {
            await this.selectTeacher(data.teacherName);
        }

        if (data.description !== undefined) {
            await this.fillField('textarea[formcontrolname="description"]', data.description);
        }

        if (data.status) {
            await this.page.locator('select[formcontrolname="status"]').selectOption(data.status);
        }
    }

    async selectTeacher(name: string): Promise<void> {
        const ngSelect = this.page.locator('ng-select[formcontrolname="teacherId"]');
        await ngSelect.click();
        const option = this.page.locator('.ng-option').filter({ hasText: name }).first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
    }

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.getByRole('heading', { name: /class/i }).first().click();
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

        const visibleMenu = this.page.locator('.dropdown-menu.show');
        await visibleMenu.waitFor({ state: 'visible' });

        await visibleMenu.getByText(/^Edit$/i).click();
    }

    async clickDeleteInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);

        const visibleMenu = this.page.locator('.dropdown-menu.show');
        await visibleMenu.waitFor({ state: 'visible' });

        const option = visibleMenu.getByText(/^Delete$/i);
        await option.click();
    }

    async clickViewClass(nameOrId: string): Promise<void> {
        const row = this.page.locator('table.datatable tbody tr').filter({ hasText: nameOrId });
        await row.locator('a.link-primary').first().click();
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
