import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AcademicSettingsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/settings/academic/school');
    }

    async navigateToSchoolSettings(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /school settings/i }),
            this.page.locator('a').filter({ hasText: /school settings/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        await this.goto('/settings/academic/school');
    }
}
