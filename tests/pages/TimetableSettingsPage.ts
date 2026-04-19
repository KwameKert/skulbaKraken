import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface BreakData {
    startTime: string; // HH:MM (24h)
    endTime: string;
}

export interface TimetableSettingsFormData {
    activeDays?: string[]; // e.g. ['MONDAY', 'TUESDAY', ...]
    dayStart?: string;     // HH:MM
    dayEnd?: string;       // HH:MM
    periodMinutes?: string;
    breaks?: BreakData[];
}

export class TimetableSettingsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.goto('/settings/academic/time-table');
    }

    async expectFormVisible(): Promise<void> {
        await this.page
            .locator('input[formcontrolname="periodMinutes"]')
            .waitFor({ state: 'visible' });
    }

    async fillForm(data: TimetableSettingsFormData): Promise<void> {
        if (data.activeDays) {
            for (const day of data.activeDays) {
                await this.checkDay(day);
            }
        }

        if (data.dayStart) {
            await this.setTime('dayStart', data.dayStart);
        }

        if (data.dayEnd) {
            await this.setTime('dayEnd', data.dayEnd);
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
            .locator('[formarrayname="activeDays"]')
            .locator('p-checkbox')
            .filter({ hasText: new RegExp(dayLabel, 'i') });
        const input = checkbox.locator('input[type="checkbox"]').first();
        const isChecked = await input.isChecked();
        if (!isChecked) {
            await checkbox.first().click();
        }
    }

    async setTime(calendarId: 'dayStart' | 'dayEnd', time: string): Promise<void> {
        const input = this.page.locator(`p-calendar#${calendarId} input`).first();
        await input.clear();
        await input.fill(time);
        await input.press('Tab');
    }

    // async addBreak(data: BreakData): Promise<void> {
    //     const addBreakBtn = this.page
    //         .locator('[formarrayname="breaks"]')
    //         .getByRole('button', { name: /add break/i });
    //     await addBreakBtn.click();

    //     const breakRows = this.page.locator('[formarrayname="breaks"] > div');
    //     const lastRow = breakRows.last();

    //     const startInput = lastRow.locator('p-calendar').nth(0).locator('input');
    //     await startInput.fill(data.startTime);
    //     await startInput.press('Tab');

    //     const endInput = lastRow.locator('p-calendar').nth(1).locator('input');
    //     await endInput.fill(data.endTime);
    //     await endInput.press('Tab');
    // }


    async addBreak(data: BreakData): Promise<void> {
        const addBreakBtn = this.page
            .locator('[formarrayname="breaks"]')
            .getByRole('button', { name: /add break/i });
        await addBreakBtn.click();

        const breakRows = this.page.locator('[formarrayname="breaks"] > div');
        const lastRow = breakRows.last();

        await this.selectCalendarTime(
            lastRow.locator('p-calendar').nth(0),
            'Start Time',
            data.startTime
        );
        await this.selectCalendarTime(
            lastRow.locator('p-calendar').nth(1),
            'End Time',
            data.endTime
        );
    }

    private async selectCalendarTime(
        calendar: Locator,
        label: string,
        time: string
    ): Promise<void> {
        const input = calendar.getByRole('combobox', { name: label });

        await input.click();
        await this.page.keyboard.press('Escape');
        await input.fill(time);
        await input.press('Tab');

    }

    async removeBreak(index: number): Promise<void> {
        const breakRows = this.page.locator('[formarrayname="breaks"] > div');
        const row = breakRows.nth(index);
        await row.locator('button.btn-outline-danger').click();
    }

    async getBreakCount(): Promise<number> {
        return this.page.locator('[formarrayname="breaks"] > div').count();
    }

    async addOverride(): Promise<void> {
        const addOverrideBtn = this.page
            .locator('[formarrayname="overrides"]')
            .getByRole('button', { name: /add override/i });
        await addOverrideBtn.click();
    }

    async removeOverride(index: number): Promise<void> {
        const overrides = this.page.locator('[formarrayname="overrides"] > div');
        const override = overrides.nth(index);
        await override.getByRole('button', { name: /remove/i }).click();
    }

    async touchField(formControlName: string): Promise<void> {
        const input = this.page.locator(`input[formcontrolname="${formControlName}"]`).first();
        await input.click();
        await this.page.locator('body').click();
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

    async expectFieldError(message: RegExp | string): Promise<void> {
        const error = this.page.locator('.text-danger small, small.p-error').filter({ hasText: message });
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
