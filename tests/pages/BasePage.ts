import { expect, Page } from '@playwright/test';

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
}
