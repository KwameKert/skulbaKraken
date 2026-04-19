# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: setup/06-term.spec.ts >> Terms >> Delete term >> confirming delete removes the row and shows success toast
- Location: tests/setup/06-term.spec.ts:242:13

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 2
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - link "Logo" [ref=e7] [cursor=pointer]:
        - /url: /dashboard
        - img "Logo" [ref=e8]
      - link "﫻" [ref=e9] [cursor=pointer]:
        - /url: javascript:void(0);
        - generic [ref=e10]: 﫻
    - generic [ref=e13]:
      - generic [ref=e14]: "Sms Balance: 0"
      - combobox [ref=e16]:
        - text: 
        - option "2025/2026 Academic Year" [selected]
      - combobox [ref=e18]:
        - option "✅ First Term (edited)" [selected]
      - link "" [ref=e20] [cursor=pointer]:
        - /url: javascript:void(0);
        - generic [ref=e21]: 
      - link "" [ref=e23] [cursor=pointer]:
        - /url: javascript:void(0);
        - generic [ref=e24]: 
      - link "" [ref=e26] [cursor=pointer]:
        - /url: javascript:void(0);
        - generic [ref=e27]: 
      - link "" [ref=e29] [cursor=pointer]:
        - /url: javascript:void(0);
        - generic [ref=e30]: 
      - link "Img" [ref=e32] [cursor=pointer]:
        - /url: javascript:void(0);
        - img "Img" [ref=e34]
    - text: 
    - progressbar [ref=e36]
  - generic [ref=e47]:
    - list [ref=e48]:
      - listitem [ref=e49]:
        - link "Profile" [ref=e50] [cursor=pointer]:
          - /url: javascript:void(0);
          - img "Profile" [ref=e51]
    - list [ref=e52]:
      - listitem [ref=e53]:
        - heading "Main" [level=6] [ref=e54]:
          - generic [ref=e55]: Main
        - list [ref=e56]:
          - listitem [ref=e57]:
            - link " Dashboard" [ref=e58] [cursor=pointer]:
              - /url: /dashboard
              - generic [ref=e59]: 
              - generic [ref=e60]: Dashboard
      - listitem [ref=e61]:
        - heading "Peoples" [level=6] [ref=e62]:
          - generic [ref=e63]: Peoples
        - list [ref=e64]:
          - listitem [ref=e65]:
            - link " Students" [ref=e66] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e67]: 
              - generic [ref=e68]: Students
      - listitem [ref=e70]:
        - heading "Academics" [level=6] [ref=e71]:
          - generic [ref=e72]: Academics
        - list [ref=e73]:
          - listitem [ref=e74]:
            - link " Classes" [ref=e75] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e76]: 
              - generic [ref=e77]: Classes
          - listitem [ref=e79]:
            - link " Courses" [ref=e80] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e81]: 
              - generic [ref=e82]: Courses
          - listitem [ref=e84]:
            - link " Terms" [ref=e85] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e86]: 
              - generic [ref=e87]: Terms
          - listitem [ref=e89]:
            - link " Academic Year" [ref=e90] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e91]: 
              - generic [ref=e92]: Academic Year
          - listitem [ref=e94]:
            - link " Grades" [ref=e95] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e96]: 
              - generic [ref=e97]: Grades
          - listitem [ref=e99]:
            - link " Timetable" [ref=e100] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e101]: 
              - generic [ref=e102]: Timetable
      - listitem [ref=e104]:
        - heading "Staff" [level=6] [ref=e105]:
          - generic [ref=e106]: Staff
        - list [ref=e107]:
          - listitem [ref=e108]:
            - link "﨡 Staff" [ref=e109] [cursor=pointer]:
              - /url: /peoples/staff/staff-list
              - generic [ref=e110]: 﨡
              - generic [ref=e111]: Staff
      - listitem [ref=e112]:
        - heading "Announcements" [level=6] [ref=e113]:
          - generic [ref=e114]: Announcements
        - list [ref=e115]:
          - listitem [ref=e116]:
            - link " Announcements" [ref=e117] [cursor=pointer]:
              - /url: /announcements/list
              - generic [ref=e118]: 
              - generic [ref=e119]: Announcements
      - listitem [ref=e120]:
        - heading "Attendance" [level=6] [ref=e121]:
          - generic [ref=e122]: Attendance
        - list [ref=e123]:
          - listitem [ref=e124]:
            - link " Attendance" [ref=e125] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e126]: 
              - generic [ref=e127]: Attendance
      - listitem [ref=e129]:
        - heading "Finance" [level=6] [ref=e130]:
          - generic [ref=e131]: Finance
        - list [ref=e132]:
          - listitem [ref=e133]:
            - link " Fees Collection" [ref=e134] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e135]: 
              - generic [ref=e136]: Fees Collection
          - listitem [ref=e138]:
            - link " Accounting" [ref=e139] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e140]: 
              - generic [ref=e141]: Accounting
          - listitem [ref=e143]:
            - link " Billings" [ref=e144] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e145]: 
              - generic [ref=e146]: Billings
          - listitem [ref=e148]:
            - link " Budgets" [ref=e149] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e150]: 
              - generic [ref=e151]: Budgets
          - listitem [ref=e153]:
            - link " Approvals" [ref=e154] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e155]: 
              - generic [ref=e156]: Approvals
          - listitem [ref=e158]:
            - link " Payroll" [ref=e159] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e160]: 
              - generic [ref=e161]: Payroll
      - listitem [ref=e163]:
        - heading "Reports" [level=6] [ref=e164]:
          - generic [ref=e165]: Reports
        - list [ref=e166]:
          - listitem [ref=e167]:
            - link " Fee Report" [ref=e168] [cursor=pointer]:
              - /url: /reports/fees-report
              - generic [ref=e169]: 
              - generic [ref=e170]: Fee Report
      - listitem [ref=e171]:
        - heading "Settings" [level=6] [ref=e172]:
          - generic [ref=e173]: Settings
        - list [ref=e174]:
          - listitem [ref=e175]:
            - link "ﮎ Academic Settings" [ref=e176] [cursor=pointer]:
              - /url: javascript:void(0)
              - generic [ref=e177]: ﮎ
              - generic [ref=e178]: Academic Settings
      - listitem [ref=e180]:
        - heading "Audit" [level=6] [ref=e181]:
          - generic [ref=e182]: Audit
        - list [ref=e183]:
          - listitem [ref=e184]:
            - link " Audit" [ref=e185] [cursor=pointer]:
              - /url: /audit/logs
              - generic [ref=e186]: 
              - generic [ref=e187]: Audit
  - generic [ref=e194]:
    - generic [ref=e195]:
      - alert [ref=e197]:
        - generic [ref=e198]:
          - img [ref=e201]
          - generic [ref=e203]:
            - generic [ref=e204]: Success
            - generic [ref=e205]: Term created successfully!
          - button "Close" [ref=e206] [cursor=pointer]:
            - img [ref=e208]
      - alert [ref=e211]:
        - generic [ref=e212]:
          - img [ref=e215]
          - generic [ref=e217]:
            - generic [ref=e218]: Success
            - generic [ref=e219]: Term deleted successfully!
          - button "Close" [ref=e220] [cursor=pointer]:
            - img [ref=e222]
    - generic [ref=e225]:
      - generic [ref=e226]:
        - generic [ref=e227]:
          - heading "Term List" [level=3] [ref=e228]
          - navigation [ref=e229]:
            - list [ref=e230]:
              - listitem [ref=e231]:
                - link "Dashboard" [ref=e232] [cursor=pointer]:
                  - /url: /dashboard
              - listitem [ref=e233]:
                - text: /
                - link "Terms" [ref=e234] [cursor=pointer]:
                  - /url: javascript:void(0);
              - listitem [ref=e235]: / All Terms
        - generic [ref=e236]:
          - generic [ref=e237]:
            - link "Refresh" [ref=e238] [cursor=pointer]:
              - /url: javascript:void(0);
              - generic [ref=e239]: 
            - link "Print" [ref=e240] [cursor=pointer]:
              - /url: javascript:void(0);
              - generic [ref=e241]: 
          - link "Add Term" [ref=e243] [cursor=pointer]:
            - /url: javascript:void(0);
            - generic [ref=e244]: 
            - text: Add Term
      - generic [ref=e245]:
        - generic [ref=e246]:
          - heading "Terms List" [level=4] [ref=e247]
          - link "Filter " [ref=e250] [cursor=pointer]:
            - /url: javascript:void(0);
            - generic [ref=e251]: 
            - text: Filter 
        - generic [ref=e252]:
          - searchbox [ref=e259]
          - generic [ref=e260]:
            - table [ref=e261]:
              - rowgroup [ref=e262]:
                - row "ID   Academic Year   Name   Is Locked   Is Published   Rollover Status   Status   Start Date   End Date   Action" [ref=e263]:
                  - columnheader "ID  " [ref=e264]:
                    - button "ID  " [ref=e265] [cursor=pointer]:
                      - generic [ref=e266]: ID
                      - generic [ref=e267]:
                        - text: 
                        - img [ref=e268]
                        - text: 
                  - columnheader "Academic Year  " [ref=e270]:
                    - button "Academic Year  " [ref=e271] [cursor=pointer]:
                      - generic [ref=e272]: Academic Year
                      - generic [ref=e273]:
                        - text: 
                        - img [ref=e274]
                        - text: 
                  - columnheader "Name  " [ref=e276]:
                    - button "Name  " [ref=e277] [cursor=pointer]:
                      - generic [ref=e278]: Name
                      - generic [ref=e279]:
                        - text: 
                        - img [ref=e280]
                        - text: 
                  - columnheader "Is Locked  " [ref=e282]:
                    - button "Is Locked  " [ref=e283] [cursor=pointer]:
                      - generic [ref=e284]: Is Locked
                      - generic [ref=e285]:
                        - text: 
                        - img [ref=e286]
                        - text: 
                  - columnheader "Is Published  " [ref=e288]:
                    - button "Is Published  " [ref=e289] [cursor=pointer]:
                      - generic [ref=e290]: Is Published
                      - generic [ref=e291]:
                        - text: 
                        - img [ref=e292]
                        - text: 
                  - columnheader "Rollover Status  " [ref=e294]:
                    - button "Rollover Status  " [ref=e295] [cursor=pointer]:
                      - generic [ref=e296]: Rollover Status
                      - generic [ref=e297]:
                        - text: 
                        - img [ref=e298]
                        - text: 
                  - columnheader "Status  " [ref=e300]:
                    - button "Status  " [ref=e301] [cursor=pointer]:
                      - generic [ref=e302]: Status
                      - generic [ref=e303]:
                        - text: 
                        - img [ref=e304]
                        - text: 
                  - columnheader "Start Date  " [ref=e306]:
                    - button "Start Date  " [ref=e307] [cursor=pointer]:
                      - generic [ref=e308]: Start Date
                      - generic [ref=e309]:
                        - text: 
                        - img [ref=e310]
                        - text: 
                  - columnheader "End Date  " [ref=e312]:
                    - button "End Date  " [ref=e313] [cursor=pointer]:
                      - generic [ref=e314]: End Date
                      - generic [ref=e315]:
                        - text: 
                        - img [ref=e316]
                        - text: 
                  - columnheader "Action" [ref=e318]
              - rowgroup [ref=e319]:
                - row "60 2025/2026 Academic Year Second Term  No  No NOT_RUN  INACTIVE 9/1/24, 12:00 AM 12/20/24, 12:00 AM " [ref=e320]:
                  - cell "60" [ref=e321]:
                    - link "60" [ref=e322] [cursor=pointer]:
                      - /url: javascript:void(0);
                  - cell "2025/2026 Academic Year" [ref=e323]
                  - cell "Second Term" [ref=e324]
                  - cell " No" [ref=e325]:
                    - generic [ref=e326]:
                      - generic [ref=e327]: 
                      - text: "No"
                  - cell " No" [ref=e328]:
                    - generic [ref=e329]:
                      - generic [ref=e330]: 
                      - text: "No"
                  - cell "NOT_RUN" [ref=e331]
                  - cell " INACTIVE" [ref=e332]:
                    - generic [ref=e333]:
                      - generic [ref=e334]: 
                      - text: INACTIVE
                  - cell "9/1/24, 12:00 AM" [ref=e335]
                  - cell "12/20/24, 12:00 AM" [ref=e336]
                  - cell "" [ref=e337]:
                    - generic [ref=e339]:
                      - link "" [ref=e340] [cursor=pointer]:
                        - /url: javascript:void(0);
                        - generic [ref=e341]: 
                      - text:   
                - row "57 2025/2026 Academic Year First Term (edited)  No  No NOT_RUN  ACTIVE 9/1/25, 12:00 AM 12/20/25, 12:00 AM " [ref=e342]:
                  - cell "57" [ref=e343]:
                    - link "57" [ref=e344] [cursor=pointer]:
                      - /url: javascript:void(0);
                  - cell "2025/2026 Academic Year" [ref=e345]
                  - cell "First Term (edited)" [ref=e346]
                  - cell " No" [ref=e347]:
                    - generic [ref=e348]:
                      - generic [ref=e349]: 
                      - text: "No"
                  - cell " No" [ref=e350]:
                    - generic [ref=e351]:
                      - generic [ref=e352]: 
                      - text: "No"
                  - cell "NOT_RUN" [ref=e353]
                  - cell " ACTIVE" [ref=e354]:
                    - generic [ref=e355]:
                      - generic [ref=e356]: 
                      - text: ACTIVE
                  - cell "9/1/25, 12:00 AM" [ref=e357]
                  - cell "12/20/25, 12:00 AM" [ref=e358]
                  - cell "" [ref=e359]:
                    - generic [ref=e361]:
                      - link "" [ref=e362] [cursor=pointer]:
                        - /url: javascript:void(0);
                        - generic [ref=e363]: 
                      - text:  
            - group [ref=e364]:
              - generic [ref=e366]:
                - generic [ref=e367]:
                  - generic [ref=e368]: "Items per page:"
                  - combobox "10 Items per page:" [ref=e373] [cursor=pointer]:
                    - generic [ref=e374]:
                      - generic [ref=e376]: "10"
                      - img [ref=e379]
                - generic [ref=e382]:
                  - generic [ref=e383]: 1 – 2 of 2
                  - button "Previous page" [disabled] [ref=e384]:
                    - img [ref=e385]
                  - button "Next page" [disabled] [ref=e389]:
                    - img [ref=e390]
```

# Test source

```ts
  160 |             await termPage.visit();
  161 | 
  162 |             await termPage.clickAddTerm();
  163 |             await termPage.expectDialogVisible('Add');
  164 | 
  165 |             await page.locator('input[formcontrolname="name"]').fill('Some Name');
  166 |             // academic year and dates still empty — form still invalid
  167 | 
  168 |             await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
  169 |         });
  170 |     });
  171 | 
  172 |     test.describe('Edit term', () => {
  173 |         const existingTermName = validTerm.name;
  174 |         test('clicking Edit opens the dialog in edit mode', async ({ page }) => {
  175 |             const termPage = new TermPage(page);
  176 |             await termPage.visit();
  177 |             await termPage.expectListVisible();
  178 | 
  179 |             await termPage.clickEditInRow(existingTermName);
  180 | 
  181 |             await termPage.expectDialogVisible('Edit');
  182 |             await expect(page.getByRole('heading', { name: /edit term/i })).toBeVisible();
  183 |         });
  184 | 
  185 |         test('edit dialog shows Update button instead of Create', async ({ page }) => {
  186 |             const termPage = new TermPage(page);
  187 |             await termPage.visit();
  188 |             await termPage.expectListVisible();
  189 | 
  190 |             await termPage.clickEditInRow(existingTermName);
  191 |             await termPage.expectDialogVisible('Edit');
  192 | 
  193 |             await expect(page.getByRole('button', { name: /update/i })).toBeVisible();
  194 |         });
  195 | 
  196 |         test('saves changes to an existing term and shows success toast', async ({ page }) => {
  197 |             const termPage = new TermPage(page);
  198 |             await termPage.visit();
  199 |             await termPage.expectListVisible();
  200 | 
  201 |             await termPage.clickEditInRow(existingTermName);
  202 |             await termPage.expectDialogVisible('Edit');
  203 | 
  204 |             await page.locator('input[formcontrolname="name"]').fill(existingTermName + ' (edited)');
  205 |             await termPage.submitForm();
  206 | 
  207 |             await termPage.expectToastMessage(/updated successfully/i);
  208 |         });
  209 |     });
  210 | 
  211 |     test.describe('Delete term', () => {
  212 | 
  213 | 
  214 |         test('shows SweetAlert2 confirmation dialog on delete click', async ({ page }) => {
  215 |             const termPage = new TermPage(page);
  216 |             await termPage.visit();
  217 |             await termPage.expectListVisible();
  218 | 
  219 |             await termPage.clickDeleteInRow(validTerm.name);
  220 | 
  221 |             await expect.poll(
  222 |                 async () => page.locator('.swal2-popup').isVisible(),
  223 |                 { message: 'Expected SweetAlert2 confirmation dialog to appear.' }
  224 |             ).toBeTruthy();
  225 |         });
  226 | 
  227 |         test('cancelling delete keeps the row in the table', async ({ page }) => {
  228 |             const termPage = new TermPage(page);
  229 |             await termPage.visit();
  230 |             await termPage.expectListVisible();
  231 | 
  232 |             const rowsBefore = await termPage.getTableRowCount();
  233 |             await termPage.clickDeleteInRow(validTerm.name);
  234 |             await termPage.cancelSwalDelete();
  235 | 
  236 |             await expect.poll(
  237 |                 async () => termPage.getTableRowCount(),
  238 |                 { message: 'Expected row count to remain unchanged after cancelling delete.' }
  239 |             ).toBe(rowsBefore);
  240 |         });
  241 | 
  242 |         test('confirming delete removes the row and shows success toast', async ({ page }) => {
  243 |             const termPage = new TermPage(page);
  244 |             await termPage.visit();
  245 |             await termPage.expectListVisible();
  246 | 
  247 |             await termPage.clickAddTerm();
  248 |             await termPage.expectDialogVisible('Add');
  249 | 
  250 |             await termPage.fillForm(secondTerm);
  251 |             await termPage.submitForm();
  252 | 
  253 | 
  254 |             const rowsBefore = await termPage.getTableRowCount();
  255 |             await termPage.clickDeleteInRow(secondTerm.name);
  256 |             await termPage.confirmSwalDelete();
  257 | 
  258 |             await termPage.expectToastMessage(/deleted successfully/i);
  259 |             const rowsAfter = await termPage.getTableRowCount();
> 260 |             expect(rowsAfter).toBe(1);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  261 |         });
  262 |     });
  263 | });
  264 | 
```