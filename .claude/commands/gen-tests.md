You are generating Playwright E2E tests for a school management system.

The user provides two things via $ARGUMENTS:
1. **A path** to an Angular component/module directory (e.g. `src/app/feature-module/setting/academic`)
2. **Instructions** describing which scenarios to cover (happy paths, bad cases, specific flows)

---

## Step 1: Explore the Angular Source Code

Read the directory at the path given in $ARGUMENTS and its sub-directories. Collect:

- **Components**: list, form/manage, detail, dialog components
- **Data model**: interfaces and classes (`*.model.ts`, `*.interface.ts`)
- **Routes**: routing module or route definitions — extract the full URL path(s)
- **Form fields**: `FormGroup` / `FormBuilder` definitions in `.ts` files and `formControlName` bindings in `.html` files
- **Validation rules**: `Validators.required`, `min`, `max`, `pattern`, custom validators, cross-field validators (e.g. weight sums)
- **UI controls**: standard inputs, textareas, PrimeNG components (`p-calendar`, `p-dropdown`, `p-checkbox`), file uploads, FormArrays
- **Feedback mechanisms**: toast selectors (`p-toast .p-toast-detail`), SweetAlert2 dialogs (`.swal2-confirm`), inline `.text-danger small` errors
- **Guards / roles**: any `canActivate` guards on routes

Read enough files to fully understand what the UI does and looks like before writing any code.

---

## Step 2: Inspect the Live UI with playwright-cli

Use the `playwright-cli` skill to open the app and navigate to each route discovered in Step 1.

```bash
playwright-cli open
playwright-cli goto <route>   # e.g. /settings/academic/school
playwright-cli snapshot
```

Use the snapshot to confirm:
- Actual `formcontrolname` attribute values on inputs/textareas
- Exact text on buttons (Save, Cancel, Add Break, etc.)
- PrimeNG component IDs and structure (`p-calendar#dayStart input`, etc.)
- FormArray container attribute names (`formarrayname="breaks"`)
- Error message text (e.g. "School name is required")

If the app requires login, use the stored session or log in first:
```bash
playwright-cli goto /
# fill credentials and submit, then navigate to the target route
playwright-cli snapshot
```

Close the browser when done:
```bash
playwright-cli close
```

---

## Step 3: Generate Page Object(s)

Create `tests/pages/{FeatureName}Page.ts` in this project (skulbaKraken).

**Rules — match the pattern in `tests/pages/StudentsPage.ts` exactly:**

- Extend `BasePage` from `./BasePage`
- Constructor: `constructor(page: Page) { super(page); }`
- `visit()` navigates to the route URL
- Export TypeScript interfaces for form data (e.g. `SchoolSettingsFormData`)
- One public method per user action: `fillForm(data)`, `submitForm()`, `cancelForm()`, `touchField(name)`, `expectToastMessage(text)`, `expectFieldError(name, message)`, `isSubmitDisabled()`
- For dynamic UI (FormArrays): `addBreak(data)`, `removeBreak(index)`, `getBreakCount()`
- Use candidate arrays with fallback selectors:
  ```ts
  const candidates = [
      this.page.getByRole('button', { name: /save/i }),
      this.page.locator('button[type="submit"].btn-primary'),
  ];
  for (const loc of candidates) {
      if (await this.clickIfVisible(loc)) return;
  }
  ```
- Include private helpers (copy exactly from `StudentsPage.ts`):
  `fillIfVisible`, `clickIfVisible`, `isVisible`
- For PrimeNG `p-calendar` (time-only): target the `input` inside the component
  ```ts
  const input = this.page.locator(`p-calendar#${id} input`).first();
  await input.clear();
  await input.fill(time);
  await input.press('Tab');
  ```
- For PrimeNG `p-checkbox` (binary): click the component filtered by label text
  ```ts
  const cb = this.page.locator('[formarrayname="activeDays"] p-checkbox')
      .filter({ hasText: new RegExp(dayLabel, 'i') });
  const isChecked = await cb.locator('input[type="checkbox"]').first().isChecked();
  if (!isChecked) await cb.first().click();
  ```

---

## Step 4: Generate the Spec File

Create `tests/{feature}/{feature-name}.spec.ts` in this project.

**Rules:**

- Import from `'../fixtures'` — NEVER directly from `'@playwright/test'`
- Use `authenticatedTest as test` for tests that require login
- Use `test as baseTest` only for unauthenticated guard tests
- Top-level `test.describe('{Feature Name}', () => { ... })`
- Nested `test.describe` blocks per flow: Page load, Happy path, Validation / Bad cases, (Dynamic forms), (Navigation guard)
- Each test: instantiate page object, call `visit()`, act, assert
- Define test data as `const` at the top of each describe block
- Cover the scenarios from the user's instructions, plus at minimum:
  - Form is visible after navigation
  - Happy path: fill valid data → submit → success toast appears
  - Required field errors appear when fields are touched and empty
  - Save button is disabled when form is invalid
  - Any cross-field validation (e.g. weight sums) triggers an error toast
- Use `await expect(locator).toBeVisible()` for sync assertions
- Use `await expect.poll(async () => ..., { message: '...' }).toBe/toMatch/...` for async UI state
- Do NOT add API setup/teardown — keep tests pure UI
- Leave `// TODO:` comments for any selectors or flows that could not be confirmed from source or snapshot

---

## Step 5: Summarise

After writing all files, output:

- **Files created**: full paths
- **Scenarios covered**: list per file
- **Selectors to verify**: any `formcontrolname` values, route paths, or button text confirmed via playwright-cli snapshot vs. assumed from source
- **TODOs**: fields or interactions left unresolved that the user should check before running
