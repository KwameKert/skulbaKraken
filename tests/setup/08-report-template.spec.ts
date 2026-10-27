import { authenticatedTest as test } from '../fixtures';
import { ReportTemplatePage } from '../pages/ReportTemplatePage';

/**
 * Report cards cannot be turned into PDFs until the school has a report template, and the truncate
 * removes the one a previous run left behind. Templates belong to the whole school, so it is made here once.
 */
test.describe('Report template', () => {
    test('the school has a report template for report cards', async ({ page }) => {
        await new ReportTemplatePage(page).ensureTemplate('E2E Report Template');
    });
});
