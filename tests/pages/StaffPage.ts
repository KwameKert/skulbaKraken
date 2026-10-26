import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface StaffFormData {
    employeeType: 'Teacher' | 'Head Teacher' | 'Admin' | 'Accountant' | 'Staff';
    firstName: string;
    lastName: string;
    gender: 'Male' | 'Female';
    primaryContactNumber: string;
    email: string;
    dateOfJoining: string; // MM/DD/YYYY
    dateOfBirth: string;   // MM/DD/YYYY
    maritalStatus?: 'Single' | 'Married';
    languages?: string[];
    workExperience?: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
    address?: string;
    status: 'Active' | 'Inactive';
    notes?: string;
}

const ID = 'app-add-employee';

export class StaffPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    async visit(): Promise<void> {
        await this.goto('/peoples/staff/staff-list');
        await this.expectListVisible();
    }

    async visitAddForm(): Promise<void> {
        await this.goto('/peoples/staff/add-staff');
        await this.expectFormVisible();
    }

    async visitEditForm(id: number | string): Promise<void> {
        await this.goto(`/peoples/staff/edit-staff/${id}`);
        await this.expectFormVisible();
    }

    // ── List view ───────────────────────────────────────────────────────────

    async expectListVisible(): Promise<void> {
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
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

    async clickAddStaff(): Promise<void> {
        await this.page.getByRole('link', { name: /add staff/i }).first().click();
    }

    async search(term: string): Promise<void> {
        const input = this.page.locator('#DataTables_Table_0_filter input[type="search"]');
        await input.waitFor({ state: 'visible' });
        await input.fill(term);
    }

    async filterByName(term: string): Promise<void> {
        await this.page.locator('#employee-list-table-filter').click();
        await this.page.locator('#employee-list-name-filter').fill(term);
        await this.page.getByRole('button', { name: /apply/i }).click();
    }

    async clickResetFilters(): Promise<void> {
        await this.page.locator('#employee-list-table-filter-reset').click();
    }

    rowByName(name: string): Locator {
        return this.page.locator('table.datatable tbody tr').filter({ hasText: name });
    }

    async openRowActions(name: string): Promise<void> {
        await this.rowByName(name).locator('.ti-dots-vertical').first().click();
    }

    private async clickRowAction(name: string, action: RegExp): Promise<void> {
        await this.openRowActions(name);
        await this.rowByName(name).locator('.dropdown-item').filter({ hasText: action }).first().click();
    }

    async clickViewInRow(name: string): Promise<void> {
        await this.clickRowAction(name, /view/i);
    }

    async clickEditInRow(name: string): Promise<void> {
        await this.clickRowAction(name, /^\s*edit\s*$/i);
    }

    async clickResetPasswordInRow(name: string): Promise<void> {
        await this.clickRowAction(name, /reset password/i);
    }

    async clickDeleteInRow(name: string): Promise<void> {
        await this.clickRowAction(name, /delete/i);
    }

    async confirmSwal(): Promise<void> {
        const confirmBtn = this.page.locator('.swal2-confirm');
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async cancelSwal(): Promise<void> {
        const cancelBtn = this.page.locator('.swal2-cancel');
        await cancelBtn.waitFor({ state: 'visible' });
        await cancelBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    // ── Staff form ──────────────────────────────────────────────────────────

    async expectFormVisible(): Promise<void> {
        await this.page.locator(`#${ID}-first-name`).waitFor({ state: 'visible' });
    }

    async fillStaffForm(data: StaffFormData): Promise<void> {
        await this.selectDropdown(`${ID}-employee-type`, data.employeeType);
        await this.fillById('first-name', data.firstName);
        await this.fillById('last-name', data.lastName);
        await this.selectDropdown(`${ID}-gender`, data.gender);
        await this.fillById('primary-contact-number', data.primaryContactNumber);
        await this.fillById('email', data.email);
        await this.fillDate(`${ID}-date-of-joining`, data.dateOfJoining);
        await this.fillDate(`${ID}-date-of-birth`, data.dateOfBirth);

        if (data.maritalStatus) {
            await this.selectDropdown(`${ID}-marital-status`, data.maritalStatus);
        }

        for (const language of data.languages ?? []) {
            await this.addLanguageChip(language);
        }

        if (data.workExperience) {
            await this.fillById('work-experience', data.workExperience);
        }

        await this.fillById('emergency-contact-name', data.emergencyContactName);
        await this.fillById('emergency-contact-number', data.emergencyContactNumber);

        if (data.address) {
            await this.fillById('address', data.address);
        }

        await this.selectDropdown(`${ID}-status`, data.status);

        if (data.notes) {
            await this.fillById('notes', data.notes);
        }
    }

    async fillById(name: string, value: string): Promise<void> {
        const input = this.page.locator(`#${ID}-${name}`);
        await input.clear();
        await input.fill(value);
    }

    async touchField(name: string): Promise<void> {
        await this.page.locator(`#${ID}-${name}`).click();
        await this.page.getByRole('heading', { name: /staff/i }).first().click();
    }

    async submitForm(): Promise<void> {
        await this.page.locator(`#${ID}-submit-button`).click();
    }

    async cancelForm(): Promise<void> {
        await this.page.locator(`#${ID}-cancel-button`).click();
    }

    async isSubmitDisabled(): Promise<boolean> {
        return this.page.locator(`#${ID}-submit-button`).isDisabled();
    }

    /** Retrying checks: Angular enables the button a moment after the last field is filled. */
    async expectSubmitEnabled(): Promise<void> {
        await expect(this.page.locator(`#${ID}-submit-button`)).toBeEnabled();
    }

    async expectSubmitDisabled(): Promise<void> {
        await expect(this.page.locator(`#${ID}-submit-button`)).toBeDisabled();
    }

    async expectFieldError(message: RegExp | string): Promise<void> {
        const error = this.page.locator('.text-danger').filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private async fillDate(id: string, value: string): Promise<void> {
        const input = this.page.locator(`#${id}`);
        await input.click();
        await this.page.keyboard.press('Escape');
        await input.fill(value);
        await input.press('Tab');
    }

    private async selectDropdown(id: string, optionLabel: string): Promise<void> {
        await this.page.locator(`#${id}`).click();
        const option = this.page.locator('.p-dropdown-item').filter({ hasText: optionLabel }).first();
        await option.waitFor({ state: 'visible' });
        await option.click();
    }

    private async addLanguageChip(language: string): Promise<void> {
        const chipsInput = this.page.locator(`#${ID}-languages input`).first();
        await chipsInput.click();
        await chipsInput.fill(language);
        await chipsInput.press('Enter');
    }
}
