import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface StudentFormData {
    firstName: string;
    lastName: string;
    otherNames?: string;
    gender: 'Male' | 'Female';
    dateOfBirth: string; // MM/DD/YYYY
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
    isPrimary?: boolean;
}

const ID = 'app-add-student';

export class StudentsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    async visit(): Promise<void> {
        await this.goto('/peoples/students/students-list');
        await this.expectListVisible();
    }

    async visitAddForm(): Promise<void> {
        await this.goto('/peoples/students/add-student');
        await this.expectFormVisible();
    }

    async visitEditForm(id: number | string): Promise<void> {
        await this.goto(`/peoples/students/edit-student/${id}`);
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

    async clickAddStudent(): Promise<void> {
        await this.page.getByRole('link', { name: /add student/i }).first().click();
    }

    async search(term: string): Promise<void> {
        const input = this.page.locator('#DataTables_Table_0_filter input[type="search"]');
        await input.waitFor({ state: 'visible' });
        await input.fill(term);
    }

    rowByName(name: string): Locator {
        return this.page.locator('table.datatable tbody tr').filter({ hasText: name });
    }

    async openRowActions(name: string): Promise<void> {
        await this.rowByName(name).locator('.ti-dots-vertical').first().click();
    }

    async clickViewInRow(name: string): Promise<void> {
        await this.openRowActions(name);
        await this.rowByName(name).locator('.dropdown-item').filter({ hasText: /view/i }).first().click();
    }

    async clickEditInRow(name: string): Promise<void> {
        await this.openRowActions(name);
        await this.rowByName(name).locator('.dropdown-item').filter({ hasText: /edit/i }).first().click();
    }

    async clickDeleteInRow(name: string): Promise<void> {
        await this.openRowActions(name);
        await this.rowByName(name).locator('.dropdown-item').filter({ hasText: /delete/i }).first().click();
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

    async getTableRowCount(): Promise<number> {
        return this.page.locator('table.datatable tbody tr').count();
    }

    // ── Student form ────────────────────────────────────────────────────────

    async expectFormVisible(): Promise<void> {
        await this.page.locator(`#${ID}-firstName`).waitFor({ state: 'visible' });
    }

    async fillStudentForm(data: StudentFormData): Promise<void> {
        await this.fillById('firstName', data.firstName);
        await this.fillById('lastName', data.lastName);

        if (data.otherNames) {
            await this.fillById('otherNames', data.otherNames);
        }

        await this.selectDropdown(`#${ID}-gender`, data.gender);
        await this.fillDate(`#${ID}-dateOfBirth`, data.dateOfBirth);

        if (data.phoneNumber) {
            await this.fillById('phoneNumber', data.phoneNumber);
        }

        if (data.email) {
            await this.fillById('email', data.email);
        }

        await this.selectDropdown(`#${ID}-status`, data.status);

        if (data.address) {
            await this.fillById('address', data.address);
        }

        if (data.notes) {
            await this.fillById('notes', data.notes);
        }
    }

    /** Blur a student form input so its "touched" validation message appears. */
    async touchField(name: string): Promise<void> {
        await this.page.locator(`#${ID}-${name}`).click();
        await this.page.getByRole('heading', { name: /student/i }).first().click();
    }

    /** p-dropdown fields only mark touched after the overlay closes. */
    async touchDropdown(name: string): Promise<void> {
        await this.page.locator(`#${ID}-${name}`).click();
        await this.page.keyboard.press('Escape');
        await this.page.getByRole('heading', { name: /student/i }).first().click();
    }

    async submitForm(): Promise<void> {
        await this.page.locator(`#${ID}-submit`).click();
    }

    async cancelForm(): Promise<void> {
        await this.page.locator(`#${ID}-cancel`).click();
    }

    async isSubmitDisabled(): Promise<boolean> {
        return this.page.locator(`#${ID}-submit`).isDisabled();
    }

    async expectFieldError(message: RegExp | string): Promise<void> {
        const error = this.page.locator('.text-danger').filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    // ── Guardians inside the student form ───────────────────────────────────

    get guardianCards(): Locator {
        return this.page.locator('[formarrayname="guardians"] > div');
    }

    async addGuardian(data?: GuardianFormData): Promise<void> {
        const before = await this.guardianCards.count();
        await this.page.locator(`#${ID}-guardians-add`).click();
        await this.guardianCards.nth(before).waitFor({ state: 'visible' });

        if (data) {
            await this.fillGuardian(before, data);
        }
    }

    async fillGuardian(index: number, data: GuardianFormData): Promise<void> {
        await this.fillGuardianField(index, 'firstName', data.firstName);
        await this.fillGuardianField(index, 'lastName', data.lastName);
        await this.fillGuardianField(index, 'email', data.email);
        await this.fillGuardianField(index, 'phoneNumber', data.phoneNumber);

        if (data.address) {
            await this.fillGuardianField(index, 'address', data.address);
        }

        if (data.occupation) {
            await this.fillGuardianField(index, 'occupation', data.occupation);
        }

        await this.selectDropdown(`#${ID}-guardian-relationshipToStudent-${index}`, data.relationship);

        if (data.isPrimary !== undefined) {
            await this.page
                .locator(`#${ID}-guardian-isPrimary-${index}`)
                .selectOption({ label: data.isPrimary ? 'Yes' : 'No' });
        }
    }

    /** Index of the guardian card whose last name matches (cards load in server order). */
    async guardianIndexByLastName(lastName: string): Promise<number> {
        const count = await this.guardianCards.count();
        for (let i = 0; i < count; i++) {
            if ((await this.page.locator(`#${ID}-guardian-lastName-${i}`).inputValue()) === lastName) {
                return i;
            }
        }
        throw new Error(`No guardian card with last name ${lastName}`);
    }

    async fillGuardianField(index: number, name: string, value: string): Promise<void> {
        const input = this.page.locator(`#${ID}-guardian-${name}-${index}`);
        await input.clear();
        await input.fill(value);
    }

    async touchGuardianField(index: number, name: string): Promise<void> {
        await this.page.locator(`#${ID}-guardian-${name}-${index}`).click();
        await this.page.getByRole('heading', { name: /student/i }).first().click();
    }

    async removeGuardian(index: number): Promise<void> {
        const before = await this.guardianCards.count();
        await this.page.locator(`#${ID}-guardian-remove-${index}`).click();
        // wait for Angular to drop the card so a following addGuardian() counts correctly
        await expect(this.guardianCards).toHaveCount(before - 1);
    }

    // ── Search Guardian dialog ──────────────────────────────────────────────

    async openGuardianSearch(): Promise<void> {
        await this.page.locator(`#${ID}-guardians-search`).click();
        await this.page.getByRole('dialog').waitFor({ state: 'visible' });
    }

    async searchGuardian(term: string): Promise<void> {
        const dialog = this.page.getByRole('dialog');
        await dialog.getByPlaceholder(/search by name, email or phone/i).fill(term);
        await dialog.getByRole('button', { name: /^search$/i }).click();
    }

    async selectFirstGuardianResult(): Promise<void> {
        await this.page.getByRole('dialog').getByRole('button', { name: /select/i }).first().click();
    }

    async clickCreateNewGuardian(): Promise<void> {
        await this.page.getByRole('dialog').getByRole('button', { name: /create new guardian/i }).click();
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private async fillById(name: string, value: string): Promise<void> {
        const input = this.page.locator(`#${ID}-${name}`);
        await input.clear();
        await input.fill(value);
    }

    private async fillDate(selector: string, value: string): Promise<void> {
        const input = this.page.locator(selector);
        await input.click();
        // close the datepicker overlay so it doesn't cover the next field
        await this.page.keyboard.press('Escape');
        await input.fill(value);
        await input.press('Tab');
    }

    private async selectDropdown(selector: string, optionLabel: string): Promise<void> {
        await this.page.locator(selector).click();
        const option = this.page.locator('.p-dropdown-item').filter({ hasText: optionLabel }).first();
        await option.waitFor({ state: 'visible' });
        await option.click();
    }
}
