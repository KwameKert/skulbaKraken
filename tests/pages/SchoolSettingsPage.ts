import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface SchoolSettingsFormData {
    schoolName: string;
    phoneNumber: string;
    email: string;
    fax?: string;
    address: string;
}

export class SchoolSettingsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/settings/academic/school');
    }

    async expectFormVisible(): Promise<void> {
        await this.page.locator('input[formcontrolname="schoolName"]').waitFor({ state: 'visible' });
    }

    async fillForm(data: SchoolSettingsFormData): Promise<void> {
        await this.fillField('input[formcontrolname="schoolName"]', data.schoolName);
        await this.fillField('input[formcontrolname="phoneNumber"]', data.phoneNumber);
        await this.fillField('input[formcontrolname="email"]', data.email);

        if (data.fax) {
            await this.fillField('input[formcontrolname="fax"]', data.fax);
        }

        await this.fillField('textarea[formcontrolname="address"]', data.address);
    }

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.locator('body').click();
    }

    async touchAllRequiredFields(): Promise<void> {
        for (const name of ['schoolName', 'phoneNumber', 'email', 'address']) {
            await this.touchField(name);
        }
    }

    async submitForm(): Promise<void> {
        await this.page.locator('button[type="submit"].btn-primary').click();
    }

    async cancelForm(): Promise<void> {
        const candidates = [
            this.page.getByRole('button', { name: /cancel/i }),
            this.page.locator('button.btn-light[type="button"]'),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Cancel button.');
    }

    async expectFieldError(formControlName: string, message: RegExp | string): Promise<void> {
        const field = this.page.locator(`[formcontrolname="${formControlName}"]`).first();
        const container = field.locator('~ div.text-danger, ../div.text-danger').first();
        const error = this.page
            .locator('.text-danger small')
            .filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page
            .locator('p-toast .p-toast-message, .p-toast-detail')
            .filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async isSubmitDisabled(): Promise<boolean> {
        return this.page.locator('button[type="submit"].btn-primary').isDisabled();
    }

    private async fillField(selector: string, value: string): Promise<void> {
        const locator = this.page.locator(selector).first();
        await locator.clear();
        await locator.fill(value);
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
}
