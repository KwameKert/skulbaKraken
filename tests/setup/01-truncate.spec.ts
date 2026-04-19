import { test } from '../fixtures';

test('truncate test schema', async ({ truncateSchema }) => {
    await truncateSchema();
});