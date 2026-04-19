import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface StaffFormData {
    employeeType: 'Teacher' | 'Admin' | 'Accountant' | 'Staff';
    firstName: string;
    lastName: string;
    gender: 'Male' | 'Female';
    primaryContactNumber: string;
    email: string;
    dateOfJoining: string; // 'MM/DD/YYYY'
    dateOfBirth: string;   // 'MM/DD/YYYY'
    maritalStatus?: 'Single' | 'Married';
    languages?: string[];
    qualification?: string;
    workExperience?: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
    address?: string;
    status: 'Active' | 'Inactive';
    notes?: string;
}

export class StaffPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/peoples/staff/staff-list');
        await Promise.race([
            this.page.locator('a[href="/peoples/staff/add-staff"]').waitFor({ state: 'visible' }),
            this.page.locator('input[type="password"], input[name="password"]').waitFor({ state: 'visible' }),
        ]);
    }

    async visitAddForm(): Promise<void> {
        await this.goto('/peoples/staff/add-staff');
    }

    async visitEditForm(id: number | string): Promise<void> {
        await this.goto(`/peoples/staff/edit-staff/${id}`);
    }

    async expectListVisible(): Promise<void> {
        const candidates = [
            this.page.getByRole('table'),
            this.page.locator('table.datatable'),
            this.page.locator('.custom-datatable-filter'),
        ];
        for (const locator of candidates) {
            if (await this.isVisible(locator)) return;
        }
    }

    async expectColumnHeaders(headers: string[]): Promise<void> {
        for (const header of headers) {
            const th = this.page.locator('thead th').filter({ hasText: new RegExp(header, 'i') });
            await th.first().waitFor({ state: 'visible' });
        }
    }

    async getTableRowCount(): Promise<number> {
        return this.page.locator('table.datatable tbody tr').count();
    }

    async waitForRows(): Promise<number> {
        await expect.poll(
            async () => this.page.locator('table.datatable tbody tr').count(),
            { message: 'Waiting for table rows to load.', timeout: 15000 }
        ).toBeGreaterThan(0);
        return this.page.locator('table.datatable tbody tr').count();
    }

    async search(term: string): Promise<void> {
        await this.page.locator('#employee-list-table-filter').click();

        const searchInput = this.page.locator('#employee-list-name-filter');

        await this.fillIfVisible(searchInput, term);
    }



    async clickResetFilters(): Promise<void> {
        await this.page.locator("#employee-list-table-filter-reset").click();
    }

    async clickAddStaff(): Promise<void> {
        const btn = this.page.locator('a[href="/peoples/staff/add-staff"]');
        await btn.waitFor({ state: 'visible' });
        await btn.click();
    }

    async openRowActions(nameOrId: string): Promise<void> {
        const row = this.page.locator('tr').filter({ hasText: nameOrId });
        const menuBtn = row.locator('[data-bs-toggle="dropdown"], .ti-dots-vertical').first();
        await menuBtn.click();
    }

    async clickViewInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const option = this.page.getByRole('link', { name: /view/i }).first();
        await option.click();
    }

    async clickEditInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const option = this.page.getByText(/^Edit$/i).last();
        await option.waitFor({ state: 'visible' });
        await option.click();
        await this.page.locator('#loading-bar').waitFor({ state: 'hidden' });
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

    async fillStaffForm(data: StaffFormData): Promise<void> {
        await this.selectPrimeDropdownById('app-add-employee-employee-type', data.employeeType);
        await this.page.locator('#app-add-employee-first-name').fill(data.firstName);
        await this.page.locator('#app-add-employee-last-name').fill(data.lastName);
        await this.selectPrimeDropdownById('app-add-employee-gender', data.gender);
        await this.page.locator('#app-add-employee-primary-contact-number').fill(data.primaryContactNumber);
        await this.page.locator('#app-add-employee-email').fill(data.email);
        await this.fillBsDateById('app-add-employee-date-of-joining', data.dateOfJoining);
        await this.fillBsDateById('app-add-employee-date-of-birth', data.dateOfBirth);

        if (data.maritalStatus) {
            await this.selectPrimeDropdownById('app-add-employee-marital-status', data.maritalStatus);
        }
        if (data.languages && data.languages.length > 0) {
            for (const lang of data.languages) {
                await this.addLanguageChip(lang);
            }
        }
        // if (data.qualification) {
        //     await this.page.locator('#app-add-employee-qualification').fill(data.qualification);
        // }
        if (data.workExperience) {
            await this.page.locator('#app-add-employee-work-experience').fill(data.workExperience);
        }

        await this.page.locator('#app-add-employee-emergency-contact-name').fill(data.emergencyContactName);
        await this.page.locator('#app-add-employee-emergency-contact-number').fill(data.emergencyContactNumber);

        if (data.address) {
            await this.page.locator('#app-add-employee-address').fill(data.address);
        }

        await this.selectPrimeDropdownById('app-add-employee-status', data.status);

        if (data.notes) {
            await this.page.locator('#app-add-employee-notes').fill(data.notes);
        }
    }

    async submitForm(): Promise<void> {
        await this.page.locator('#app-add-employee-submit-button').click();
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async confirmSwalDelete(): Promise<void> {
        const confirmBtn = this.page.locator('.swal2-confirm, button.btn-success').filter({ hasText: /yes.*delete/i });
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
    }

    async cancelSwalDelete(): Promise<void> {
        const cancelBtn = this.page.locator('.swal2-cancel, button.btn-danger').filter({ hasText: /cancel/i });
        await cancelBtn.waitFor({ state: 'visible' });
        await cancelBtn.click();
    }

    private async fillBsDateById(id: string, value: string): Promise<void> {
        const input = this.page.locator(`#${id}`);
        await input.click();
        await this.page.keyboard.press('Escape');
        await input.fill(value);
        await this.page.keyboard.press('Tab');
    }

    private async selectPrimeDropdownById(id: string, optionLabel: string): Promise<void> {
        await this.page.locator(`#${id}`).click();
        const option = this.page.locator('.p-dropdown-item').filter({ hasText: optionLabel }).first();
        await option.waitFor({ state: 'visible' });
        await option.click();
    }

    private async addLanguageChip(language: string): Promise<void> {
        const chipsHost = this.page.locator('#app-add-employee-languages');
        await chipsHost.click();
        const chipsInput = this.page.locator('#app-add-employee-languages input').first();
        await chipsInput.fill(language);
        await this.page.keyboard.press('Enter');
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
