import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/');
    }

    async login(email: string, password: string): Promise<void> {
        await this.fillEmail(email);
        await this.fillPassword(password);
        // await this.page.waitForTimeout(100000);
        await this.submit();
    }

    async hasVisibleLoginError(): Promise<boolean> {
        const candidates = [
            this.page.getByRole('alert'),
            this.page.locator('[aria-live="assertive"]'),
            this.page.getByText(/invalid|incorrect|failed|error|wrong|try again/i),
            this.page.locator('.error, .text-danger, .alert-danger'),
        ];

        for (const locator of candidates) {
            if (await this.isVisible(locator)) {
                return true;
            }
        }

        return false;
    }

    private async fillEmail(email: string): Promise<void> {
        const candidates = [
            this.page.getByLabel(/email/i),
            this.page.getByPlaceholder(/email/i),
            this.page.locator('input[type="email"]'),
            this.page.locator('input[name*="email" i]'),
        ];

        await this.fillFirstVisible(candidates, email, 'email');
    }

    private async fillPassword(password: string): Promise<void> {
        const candidates = [
            this.page.getByLabel(/password/i),
            this.page.getByPlaceholder(/password/i),
            this.page.locator('input[type="password"]'),
            this.page.locator('input[name*="password" i]'),
        ];

        await this.fillFirstVisible(candidates, password, 'password');
    }

    private async submit(): Promise<void> {
        const candidates = [
            this.page.getByRole('button', { name: /log in|login|sign in|continue/i }),
            this.page.locator('button[type="submit"]'),
            this.page.locator('input[type="submit"]'),
        ];

        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) {
                return;
            }
        }

        throw new Error('Could not find a visible login submit button.');
    }

    private async fillFirstVisible(candidates: Locator[], value: string, fieldName: string): Promise<void> {
        for (const locator of candidates) {
            if (await this.fillIfVisible(locator, value)) {
                return;
            }
        }

        throw new Error(`Could not find a visible ${fieldName} input.`);
    }

    private async fillIfVisible(locator: Locator, value: string): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) {
                return false;
            }

            const target = locator.first();
            if (!(await target.isVisible())) {
                return false;
            }

            await target.fill(value);
            return true;
        } catch {
            return false;
        }
    }

    private async clickIfVisible(locator: Locator): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) {
                return false;
            }

            const target = locator.first();
            if (!(await target.isVisible())) {
                return false;
            }

            await target.click();
            return true;
        } catch {
            return false;
        }
    }

    private async isVisible(locator: Locator): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) {
                return false;
            }

            return await locator.first().isVisible();
        } catch {
            return false;
        }
    }
}
