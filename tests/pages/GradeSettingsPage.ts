import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface GradeSettingsFormData {
    continuousAssessmentWeight: string;
    examWeight: string;
    roundingPrecision: string;
}

export class GradeSettingsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/settings/academic/grade');
    }

    async expectFormVisible(): Promise<void> {
        await this.page
            .locator('input[formcontrolname="continuousAssessmentWeight"]')
            .waitFor({ state: 'visible' });
    }

    async fillForm(data: GradeSettingsFormData): Promise<void> {
        await this.fillField('continuousAssessmentWeight', data.continuousAssessmentWeight);
        await this.fillField('examWeight', data.examWeight);
        await this.fillField('roundingPrecision', data.roundingPrecision);
    }

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`input[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.locator('body').click();
    }

    async touchAllRequiredFields(): Promise<void> {
        for (const name of ['continuousAssessmentWeight', 'examWeight', 'roundingPrecision']) {
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
        const error = this.page
            .locator('.text-danger small')
            .filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async expectWeightSumError(): Promise<void> {
        await this.expectToastMessage(/must sum to 100/i);
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

    private async fillField(formControlName: string, value: string): Promise<void> {
        const locator = this.page.locator(`input[formcontrolname="${formControlName}"]`).first();
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
