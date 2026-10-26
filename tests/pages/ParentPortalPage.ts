import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface PublishedReportCard {
    id: string;
    term: string;
}

/**
 * What a guardian sees once signed in: the child picker in the sidebar and, under Report > End of Term,
 * the published report cards of the chosen child. Opening one launches the PDF in a new tab.
 */
export class ParentPortalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /** The sidebar starts on 'Select Student': a parent chooses which child's records to look at. */
    async selectChild(lastName: string): Promise<void> {
        await this.chosenChild.click();
        await this.page.locator('.dropdown.my-4 .dropdown-item').filter({ hasText: lastName }).click();
        await expect(this.chosenChild).toContainText(lastName);
    }

    /** The way a parent gets there: the sidebar's Report menu, then End of Term. */
    async openEndOfTerm(): Promise<void> {
        await this.page.getByText('Report', { exact: true }).first().click();
        await this.page.getByText('End of Term').click();
        await this.page.waitForURL(/\/academic\/grades\/student-reports/);
        await expect(this.page.getByRole('heading', { name: 'Published Reports' })).toBeVisible();
        await this.settled();
    }

    /** The cards load for whichever child the sidebar has selected, so wait for cards or the empty notice. */
    private async settled(): Promise<void> {
        await expect(this.cards.first().or(this.emptyNotice)).toBeVisible();
    }

    private get cards(): Locator {
        return this.page.locator('.card.hover-scale');
    }

    get emptyNotice(): Locator {
        return this.page.getByText('No data available');
    }

    /** The child chosen in the sidebar picker. */
    get chosenChild(): Locator {
        return this.page.locator('.dropdown.my-4 > a');
    }

    /** Everyone the picker offers. */
    async children(): Promise<string[]> {
        await this.chosenChild.click();
        const names = (await this.page.locator('.dropdown.my-4 .dropdown-item').allInnerTexts()).map(n => n.trim());
        await this.page.keyboard.press('Escape');
        return names;
    }

    async reports(): Promise<PublishedReportCard[]> {
        await this.settled();
        const found: PublishedReportCard[] = [];
        for (let i = 0; i < await this.cards.count(); i++) {
            const card = this.cards.nth(i);
            found.push({
                id: (await card.locator('.badge').innerText()).trim(),
                term: (await card.locator('p', { hasText: 'Term:' }).innerText()).replace('Term:', '').trim(),
            });
        }
        return found;
    }

    /**
     * Clicks a card. The app asks the server for the report's PDF link and opens it in a new tab with
     * window.open. A headless browser gives a test nothing to watch in that tab, so the call is
     * intercepted and this resolves with the address the parent's browser was sent to.
     */
    async openReport(index = 0): Promise<string> {
        await this.page.evaluate(() => {
            const opened: string[] = [];
            (window as unknown as { __opened: string[] }).__opened = opened;
            window.open = (url?: string | URL) => {
                opened.push(String(url));
                return null;
            };
        });
        await this.cards.nth(index).click();
        const handle = await this.page.waitForFunction(() => (window as unknown as { __opened: string[] }).__opened[0]);
        return (await handle.jsonValue()) as string;
    }
}
