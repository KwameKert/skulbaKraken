import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface StudentFormData {
    firstName: string;
    lastName: string;
    otherNames?: string;
    gender: 'Male' | 'Female';
    dateOfBirth: string; // e.g. '01/15/2005'
    phoneNumber?: string;
    email?: string;
    status: 'Active' | 'Inactive';
    address?: string;
    notes?: string;
}

export interface GuardianFormData {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    relationship: 'Father' | 'Mother' | 'Guardian' | 'Other';
    address?: string;
    occupation?: string;
}

export class StudentsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/peoples/students/students-list');
    }

    async visitAddForm(): Promise<void> {
        await this.goto('/peoples/students/add-student');
    }

    async visitEditForm(id: number | string): Promise<void> {
        await this.goto(`/peoples/students/edit-student/${id}`);
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

    async clickAddStudent(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /add student/i }),
            this.page.locator('a[routerlink]').filter({ hasText: /add student/i }),
            this.page.locator('.btn-primary').filter({ hasText: /add student/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Add Student button.');
    }

    async search(term: string): Promise<void> {
        const candidates = [
            this.page.locator('input[type="search"]'),
            this.page.getByPlaceholder(/search/i),
            this.page.locator('.dataTables_filter input'),
        ];
        for (const locator of candidates) {
            if (await this.fillIfVisible(locator, term)) return;
        }
        throw new Error('Could not find search input.');
    }

    async fillStudentForm(data: StudentFormData): Promise<void> {
        await this.fillField(/first name/i, data.firstName);
        await this.fillField(/last name/i, data.lastName);

        if (data.otherNames) {
            await this.fillField(/other names/i, data.otherNames);
        }

        await this.selectPrimeDropdown('gender', data.gender);
        await this.fillDateOfBirth(data.dateOfBirth);

        if (data.phoneNumber) {
            await this.fillField(/phone number/i, data.phoneNumber);
        }

        if (data.email) {
            await this.fillField(/email/i, data.email);
        }

        await this.selectPrimeDropdown('status', data.status);

        if (data.address) {
            await this.fillField(/address/i, data.address);
        }

        if (data.notes) {
            const textarea = this.page.locator('textarea[formControlName="notes"]');
            await this.fillIfVisible(textarea, data.notes);
        }
    }

    async addGuardian(data: GuardianFormData): Promise<void> {
        const addBtn = this.page.getByRole('button', { name: /add guardian/i });
        await addBtn.click();

        const lastGuardian = this.page.locator('[formgroupname]').last();

        await lastGuardian.locator('input[placeholder="First Name"]').fill(data.firstName);
        await lastGuardian.locator('input[placeholder="Last Name"]').fill(data.lastName);
        await lastGuardian.locator('input[placeholder="Email"]').fill(data.email);
        await lastGuardian.locator('input[placeholder="Phone Number"]').fill(data.phoneNumber);

        if (data.address) {
            await lastGuardian.locator('input[placeholder="Address"]').fill(data.address);
        }

        if (data.occupation) {
            await lastGuardian.locator('input[placeholder="Occupation"]').fill(data.occupation);
        }

        // Select relationship via PrimeNG dropdown inside guardian card
        const relDropdown = lastGuardian.locator('p-dropdown[formcontrolname="relationshipToStudent"]');
        await relDropdown.click();
        await this.page.locator('.p-dropdown-item', { hasText: data.relationship }).first().click();
    }

    async submitForm(): Promise<void> {
        const candidates = [
            this.page.getByRole('button', { name: /add student|update student/i }),
            this.page.locator('button[type="submit"]'),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find submit button.');
    }

    async openRowActions(nameOrId: string): Promise<void> {
        const row = this.page.locator('tr').filter({ hasText: nameOrId });
        const menuBtn = row.locator('[data-bs-toggle="dropdown"], .ti-dots-vertical').first();
        await menuBtn.click();
    }

    async clickViewInRow(nameOrId: string): Promise<void> {
        await this.openRowActions(nameOrId);
        const option = this.page.getByRole('link', { name: /view student/i }).first();
        await option.click();
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
        const confirmBtn = this.page.locator('.swal2-confirm, button.btn-success').filter({ hasText: /yes.*delete/i });
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
    }

    async cancelSwalDelete(): Promise<void> {
        const cancelBtn = this.page.locator('.swal2-cancel, button.btn-danger').filter({ hasText: /cancel/i });
        await cancelBtn.waitFor({ state: 'visible' });
        await cancelBtn.click();
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('p-toast .p-toast-message, .p-toast-detail').filter({ hasText: text });
        await toast.waitFor({ state: 'visible', timeout: 10000 });
    }

    async getTableRowCount(): Promise<number> {
        return this.page.locator('table.datatable tbody tr').count();
    }

    async expectColumnHeaders(headers: string[]): Promise<void> {
        for (const header of headers) {
            const th = this.page.locator('thead th').filter({ hasText: new RegExp(header, 'i') });
            await th.first().waitFor({ state: 'visible' });
        }
    }

    private async fillField(label: RegExp, value: string): Promise<void> {
        const candidates = [
            this.page.getByLabel(label),
            this.page.locator(`input[formcontrolname]`).filter({ has: this.page.locator(`..`).filter({ hasText: label }) }),
        ];
        for (const locator of candidates) {
            if (await this.fillIfVisible(locator, value)) return;
        }
        // fallback: find the label then the sibling input
        const labelEl = this.page.locator('label.form-label').filter({ hasText: label }).first();
        const input = labelEl.locator('~ input, ~ div input').first();
        if (await this.fillIfVisible(input, value)) return;
        throw new Error(`Could not fill field matching ${label}`);
    }

    private async fillDateOfBirth(value: string): Promise<void> {
        const candidates = [
            this.page.locator('input.datetimepicker[formcontrolname="dateOfBirth"]'),
            this.page.locator('input[formcontrolname="dateOfBirth"]'),
        ];
        for (const locator of candidates) {
            if (await this.fillIfVisible(locator, value)) return;
        }
        throw new Error('Could not find date of birth input.');
    }

    private async selectPrimeDropdown(formControlName: string, optionLabel: string): Promise<void> {
        const dropdown = this.page.locator(`p-dropdown[formcontrolname="${formControlName}"]`);
        await dropdown.click();
        const option = this.page.locator('.p-dropdown-item').filter({ hasText: optionLabel }).first();
        await option.waitFor({ state: 'visible' });
        await option.click();
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
