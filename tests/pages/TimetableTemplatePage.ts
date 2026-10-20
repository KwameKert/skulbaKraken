import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface BreakData {
    startTime: string; // HH:MM (24h)
    endTime: string;
}

export interface TimetableTemplateFormData {
    name?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    activeDays?: string[]; // e.g. ['MONDAY', 'TUESDAY', ...]
    dayStart?: string;     // HH:MM (24h)
    dayEnd?: string;       // HH:MM (24h)
    periodMinutes?: string;
    breaks?: BreakData[];
}

export class TimetableTemplatePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    async visitList(): Promise<void> {
        await this.goto('/timetable/templates');
        await this.expectListVisible();
    }

    async visitCreate(): Promise<void> {
        await this.goto('/timetable/templates/manage');
        await this.expectFormVisible();
    }

    // ── List view ───────────────────────────────────────────────────────────

    async expectListVisible(): Promise<void> {
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
    }

    async expectColumnHeaders(headers: string[]): Promise<void> {
        for (const header of headers) {
            const th = this.page.locator('thead th').filter({ hasText: new RegExp(header, 'i') });
            await th.first().waitFor({ state: 'visible' });
        }
    }

    async clickAddTemplate(): Promise<void> {
        const candidates = [
            this.page.getByRole('link', { name: /add template/i }),
            this.page.locator('a.btn-primary').filter({ hasText: /add template/i }),
        ];
        for (const locator of candidates) {
            if (await this.clickIfVisible(locator)) return;
        }
        throw new Error('Could not find Add Template button.');
    }

    rowByName(name: string): Locator {
        return this.page.locator('table.datatable tbody tr').filter({ hasText: name });
    }

    async clickEditInRow(name: string): Promise<void> {
        await this.rowByName(name).locator('.ti-edit').first().click();
    }

    async clickDeleteInRow(name: string): Promise<void> {
        await this.rowByName(name).locator('.ti-trash').first().click();
    }

    async confirmSwalDelete(): Promise<void> {
        const confirmBtn = this.page.locator('.swal2-confirm');
        await confirmBtn.waitFor({ state: 'visible' });
        await confirmBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    async cancelSwalDelete(): Promise<void> {
        const cancelBtn = this.page.locator('.swal2-cancel');
        await cancelBtn.waitFor({ state: 'visible' });
        await cancelBtn.click();
        await this.page.locator('.swal2-popup').waitFor({ state: 'hidden' });
    }

    // ── Form ────────────────────────────────────────────────────────────────

    async expectFormVisible(): Promise<void> {
        await this.page.locator('input[formcontrolname="name"]').waitFor({ state: 'visible' });
    }

    async fillForm(data: TimetableTemplateFormData): Promise<void> {
        if (data.name) {
            await this.fillField('name', data.name);
        }

        if (data.status) {
            await this.page.locator('select[formcontrolname="status"]').selectOption(data.status);
        }

        if (data.activeDays) {
            for (const day of data.activeDays) {
                await this.checkDay(day);
            }
        }

        if (data.dayStart) {
            await this.setTime(this.page.locator('p-calendar#dayStart input').first(), data.dayStart);
        }

        if (data.dayEnd) {
            await this.setTime(this.page.locator('p-calendar#dayEnd input').first(), data.dayEnd);
        }

        if (data.periodMinutes) {
            await this.fillField('periodMinutes', data.periodMinutes);
        }

        if (data.breaks) {
            for (const breakData of data.breaks) {
                await this.addBreak(breakData);
            }
        }
    }

    async checkDay(dayLabel: string): Promise<void> {
        const checkbox = this.page
            .locator('[formarrayname="activeDays"] p-checkbox')
            .filter({ hasText: new RegExp(dayLabel, 'i') });
        const input = checkbox.locator('input[type="checkbox"]').first();
        if (!(await input.isChecked())) {
            await checkbox.first().click();
        }
    }

    // ── Breaks (top-level; overrides have their own nested breaks array) ────

    private get breaksContainer(): Locator {
        return this.page.locator('[formarrayname="breaks"]').first();
    }

    get breakRows(): Locator {
        return this.breaksContainer.locator('> div');
    }

    async addBreak(data?: BreakData): Promise<void> {
        await this.breaksContainer.getByRole('button', { name: /add break/i }).click();

        if (data) {
            const inputs = this.breakRows.last().locator('p-calendar input');
            await this.setTime(inputs.nth(0), data.startTime);
            await this.setTime(inputs.nth(1), data.endTime);
        }
    }

    async removeBreak(index: number): Promise<void> {
        await this.breakRows.nth(index).locator('button.btn-outline-danger').click();
    }

    // ── Overrides ───────────────────────────────────────────────────────────

    get overrideCards(): Locator {
        return this.page.locator('[formarrayname="overrides"] > div');
    }

    async addOverride(): Promise<void> {
        await this.page
            .locator('[formarrayname="overrides"]')
            .getByRole('button', { name: /add override/i })
            .click();
    }

    async removeOverride(index: number): Promise<void> {
        await this.overrideCards.nth(index).getByRole('button', { name: /remove/i }).click();
    }

    // ── Actions and assertions ──────────────────────────────────────────────

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`input[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.locator('body').click();
    }

    async submitForm(): Promise<void> {
        await this.page.locator('button[type="submit"].btn-primary').click();
    }

    async cancelForm(): Promise<void> {
        await this.page.getByRole('button', { name: /^cancel$/i }).click();
    }

    async isSubmitDisabled(): Promise<boolean> {
        return this.page.locator('button[type="submit"].btn-primary').isDisabled();
    }

    async expectFieldError(message: RegExp | string): Promise<void> {
        const error = this.page.locator('.text-danger').filter({ hasText: message });
        await error.first().waitFor({ state: 'visible', timeout: 5000 });
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        const toast = this.page.locator('.p-toast-message').filter({ hasText: text });
        await toast.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private async setTime(input: Locator, time: string): Promise<void> {
        await input.click();
        // close the PrimeNG time overlay so it doesn't cover the next field
        await this.page.keyboard.press('Escape');
        await input.fill(time);
        await input.press('Tab');
    }

    private async fillField(formControlName: string, value: string): Promise<void> {
        const locator = this.page.locator(`input[formcontrolname="${formControlName}"]`).first();
        await locator.clear();
        await locator.fill(value);
    }
}
