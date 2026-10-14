import { expect, Locator, Page } from '@playwright/test';

export class BasePage {
    protected readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto(pathname: string): Promise<void> {
        await this.page.goto(pathname);
    }

    async expectUrlMatches(pattern: RegExp): Promise<void> {
        await expect(this.page).toHaveURL(pattern);
    }

    protected async fillIfVisible(locator: Locator, value: string): Promise<boolean> {
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

    protected async clickIfVisible(locator: Locator): Promise<boolean> {
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

    protected async isVisible(locator: Locator): Promise<boolean> {
        try {
            if ((await locator.count()) === 0) return false;
            return await locator.first().isVisible();
        } catch {
            return false;
        }
    }
}
