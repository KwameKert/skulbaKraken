import { test } from '../fixtures';

test('truncate test schema', async ({ truncateSchema }) => {
    // see truncateSchema(): the reset time grows with the number of staff the tests have created
    test.setTimeout(660_000);
    await truncateSchema();
});
