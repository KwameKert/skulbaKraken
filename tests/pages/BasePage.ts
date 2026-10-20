import { expect, Locator, Page } from '@playwright/test';

export class BasePage {
    protected readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto(pathname: string): Promise<void> {
        await this.page.goto(pathname);
    }

    /**
     * Settings pages patch the form with saved values once the settings GET returns.
     * Wait for that response so a late patch can't overwrite what a test just typed.
     */
    protected async gotoAndWaitForSettings(pathname: string, keyParam: string): Promise<void> {
        const loaded = this.page.waitForResponse(
            res => res.url().includes('/settings') && res.url().includes(keyParam) && res.request().method() === 'GET'
        );
        await this.page.goto(pathname);
        await loaded;
        // let Angular apply the response to the form before the test starts typing
        await this.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
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
