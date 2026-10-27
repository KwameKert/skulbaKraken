import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

/** The test administrator's session, saved by tests/admin.auth.ts; every project except `auth` starts logged in from it. */
const authFile = path.resolve(__dirname, 'playwright/.auth/admin.json');

/**
 * The `setup` project truncates the database and rebuilds the school (settings, academic year,
 * terms, timetable, grades). It only exists when RUN_SETUP=1, so a normal run keeps the data that
 * is already there and can never wipe it by accident. `npm run test:fresh` turns it on and makes
 * every other project wait for it.
 */
const withSetup = process.env.RUN_SETUP === '1';
const afterSetup = ['admin-auth'];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: process.env.BASE_URL || 'https://skulba.kwamekert.com',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    ...(withSetup
      ? [{
          // only a setup run needs the tenant owner: they create the administrator
          name: 'auth',
          testMatch: '**/auth.setup.ts',
          use: { ...devices['Desktop Chrome'] },
        }, {
          name: 'setup',
          testMatch: '**/setup/**/*.spec.ts',
          dependencies: ['auth'],
          fullyParallel: false,
          workers: 1,
          // the administrator's session: 01a-admin-user.spec.ts creates the administrator as the tenant
          // and saves it, and every later setup file runs as that administrator
          use: { ...devices['Desktop Chrome'], storageState: authFile },
        }]
      : []),
    {
      name: 'admin-auth',
      testMatch: '**/admin.auth.ts',
      // after a setup run the administrator is new, so sign in again once setup has finished
      dependencies: withSetup ? ['setup'] : [],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'academic',
      testMatch: '**/academic/**/*.spec.ts',
      dependencies: afterSetup,
      // fullyParallel: false,
      // workers: 1,
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'students',
      testMatch: '**/students/**/*.spec.ts',
      dependencies: afterSetup,
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'guardians',
      testMatch: '**/guardians/**/*.spec.ts',
      dependencies: afterSetup,
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'staff',
      testMatch: '**/staff/**/*.spec.ts',
      dependencies: afterSetup,
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
