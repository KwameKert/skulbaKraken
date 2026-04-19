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

    async navigateToGradeSettings(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /grade settings/i }),
            this.page.locator('a').filter({ hasText: /grade settings/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        await this.goto('/settings/academic/grade');
    }

    async navigateToTimetableSettings(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /time.?table settings/i }),
            this.page.locator('a').filter({ hasText: /time.?table/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        await this.goto('/settings/academic/time-table');
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
