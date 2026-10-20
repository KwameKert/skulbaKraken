import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface GuardianModalData {
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber: string;
    relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
    address?: string;
    occupation?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isSmsEnable?: boolean;
    isEmailEnable?: boolean;
}

export class GuardiansPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ── List view ───────────────────────────────────────────────────────────

    async visit(): Promise<void> {
        await this.goto('/peoples/guardians/guardians-list');
        await this.expectListVisible();
    }

    async expectListVisible(): Promise<void> {
        await this.page.locator('#print-section table').waitFor({ state: 'visible' });
    }

    async expectColumnHeaders(headers: string[]): Promise<void> {
        for (const header of headers) {
            const th = this.page.locator('thead th').filter({ hasText: new RegExp(header, 'i') });
            await th.first().waitFor({ state: 'visible' });
        }
    }

    /** Guardians are keyed by phone number, which is unique per guardian. */
    rowByPhone(phone: string): Locator {
        return this.page.locator('#print-section tbody tr').filter({ hasText: phone });
    }

    get emptyState(): Locator {
        return this.page.locator('#print-section tbody td').filter({ hasText: /no guardians found/i });
    }

    async filterByName(name: string): Promise<void> {
        await this.page.locator('a.dropdown-toggle').filter({ hasText: /filter/i }).click();
        await this.page.getByPlaceholder('Search by name').fill(name);
        await this.page.getByRole('button', { name: /apply/i }).click();
    }

    /** The guardian's name in the first column links to the details page. */
    async openDetailsFromRow(phone: string): Promise<void> {
        await this.rowByPhone(phone).locator('a.table-profileimage').click();
    }

    async openRowActions(phone: string): Promise<void> {
        await this.rowByPhone(phone).locator('.ti-dots-vertical').first().click();
    }

    private async clickRowAction(phone: string, action: RegExp): Promise<void> {
        await this.openRowActions(phone);
        await this.rowByPhone(phone).locator('.dropdown-item').filter({ hasText: action }).first().click();
    }

    async clickEditInRow(phone: string): Promise<void> {
        await this.clickRowAction(phone, /edit/i);
    }

    async clickResetPasswordInRow(phone: string): Promise<void> {
        await this.clickRowAction(phone, /reset password/i);
    }

    async clickDeleteInRow(phone: string): Promise<void> {
        await this.clickRowAction(phone, /delete/i);
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

    // ── Add / Edit dialog ───────────────────────────────────────────────────

    get dialog(): Locator {
        return this.page.getByRole('dialog');
    }

    async openAddModal(): Promise<void> {
        await this.page.getByRole('link', { name: /add guardian/i }).first().click();
        await this.dialog.waitFor({ state: 'visible' });
    }

    async fillModal(data: GuardianModalData): Promise<void> {
        await this.fillField('firstName', data.firstName);
        await this.fillField('lastName', data.lastName);

        if (data.email !== undefined) {
            await this.fillField('email', data.email);
        }

        const phone = this.dialog.locator('[formcontrolname="phoneNumber"]');
        if (await phone.isEnabled()) {
            await phone.fill(data.phoneNumber);
        }

        if (data.address) {
            await this.dialog.locator('textarea[formcontrolname="address"]').fill(data.address);
        }

        await this.dialog.locator('select[formcontrolname="relationshipToStudent"]').selectOption(data.relationship);

        if (data.occupation) {
            await this.fillField('occupation', data.occupation);
        }

        if (data.status) {
            await this.dialog.locator('select[formcontrolname="status"]').selectOption(data.status);
        }

        if (data.isSmsEnable !== undefined) {
            await this.dialog.locator('#smsEnable').setChecked(data.isSmsEnable);
        }

        if (data.isEmailEnable !== undefined) {
            await this.dialog.locator('#emailEnable').setChecked(data.isEmailEnable);
        }
    }

    async touchModalField(formControlName: string): Promise<void> {
        await this.dialog.locator(`[formcontrolname="${formControlName}"]`).first().click();
        await this.dialog.locator('.modal-title').click();
    }

    async submitModal(): Promise<void> {
        await this.dialog.locator('button.btn-primary').click();
    }

    async cancelModal(): Promise<void> {
        await this.dialog.getByRole('button', { name: /^cancel$/i }).click();
    }

    async isModalSubmitDisabled(): Promise<boolean> {
        return this.dialog.locator('button.btn-primary').isDisabled();
    }

    async expectModalError(message: RegExp | string): Promise<void> {
        const error = this.dialog.locator('.invalid-feedback').filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    private async fillField(formControlName: string, value: string): Promise<void> {
        const input = this.dialog.locator(`input[formcontrolname="${formControlName}"]`).first();
        await input.clear();
        await input.fill(value);
    }
}
