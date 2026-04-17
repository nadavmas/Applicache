# AppliCache Memory Bank

This is the internal source of truth for product design decisions and completed work history.

## Product Design

### Product Purpose

AppliCache helps job seekers manage all job applications in one place instead of using spreadsheets. Users can track each application, update status, and keep notes throughout the hiring process.

### Problem Statement

Most candidates track applications in Excel or Google Sheets, which is hard to maintain and not tailored for application lifecycle workflows.

### Solution Overview

AppliCache provides:

- A React single-page dashboard for managing applications and statuses
- A status-driven workflow from application to final outcome
- A Chrome extension flow to save LinkedIn jobs directly to the dashboard

### Frontend Architecture

- Application type: React SPA
- Main user experience: dashboard for viewing, filtering, and updating applications
- Authenticated user sessions tied to AWS Cognito

### Backend Architecture

- Runtime: Node.js
- Pattern: Raw AWS Lambda handlers behind API Gateway (default recommendation)
- API consumer clients:
  - React frontend
  - Chrome extension

### AWS Services and Responsibilities

- **Amazon Cognito**
  - User sign-up/sign-in
  - Token issuance and identity
- **Amazon API Gateway**
  - Public HTTP API surface
  - Cognito-authorized access to backend routes
- **AWS Lambda**
  - Business logic and request handling
  - Validation and data access orchestration
  - Post Confirmation trigger: after email verification, writes the user profile into DynamoDB (single-table keys `USER#<sub>` / `PROFILE#<sub>`)
- **Amazon DynamoDB**
  - Persistent storage for application records
  - Single-table design (`AppliCacheData` with `PK` / `SK`); user profiles and future entities share one table
- **Amazon S3 + CloudFront (or Amplify Hosting)**
  - Frontend SPA hosting

### Core Domain Model

Primary entity: `Application`

Suggested fields:

- `userId`
- `applicationId`
- `company`
- `jobTitle`
- `jobUrl`
- `source` (for example: linkedin, manual)
- `status` (for example: saved, applied, interview, offer, rejected)
- `notes`
- `appliedAt`
- `createdAt`
- `updatedAt`

### High-Level API Surface

- `POST /applications` create application
- `GET /applications` list applications
- `GET /applications/{id}` get one application
- `PATCH /applications/{id}` update status/details
- `DELETE /applications/{id}` delete application

### LinkedIn Extension Flow

1. User opens a LinkedIn job posting page.
2. Extension reads available job metadata.
3. User clicks add-to-AppliCache action.
4. Extension calls secured AppliCache API.
5. Backend stores the job in DynamoDB under the user account.

## Completed Tasks Backlog

Update this section only when explicitly requested.

| Task | Completed On | Notes |
|---|---|---|
| Created project root folders `backend/` and `frontend/`. | 2026-04-14 | Initial repository structure setup. |
| Created product overview in `README.md`. | 2026-04-14 | Added purpose, architecture, MVP scope, and roadmap. |
| Created `.gitignore` and added `README.md` ignore entry. | 2026-04-14 | Applied requested ignore rule. |
| Created `TASK_TRACKER.md` and iterated its format to completed-only backlog. | 2026-04-14 | Evolved tracker format based on user feedback. |
| Created `MEMORY_BANK.md` as single source of truth and deprecated `TASK_TRACKER.md`. | 2026-04-14 | Migrated tracking workflow to memory bank model. |
| Added project rule in `.cursorrules` for memory bank usage/immutability unless instructed. | 2026-04-14 | Enforced memory-first guidance for future work. |
| Set up frontend React SPA landing flow with routes `/`, `/login`, `/signup`. | 2026-04-14 | Added router, landing hero, and placeholder auth pages. |
| Added minimal AWS SAM scaffold at `backend/template.yaml`. | 2026-04-14 | Created empty SAM template with `Resources: {}`. |
| Created and switched to `aws` git branch for backend SAM/Lambda-focused work. | 2026-04-14 | Branch workflow established for AWS-related changes. |
| Integrated AWS Amplify v6 (`aws-amplify/auth`) in the frontend: `amplifyConfig.js`, `cognitoSignup.js`, `cognitoLogin.js`, `cognitoLogout.js`, `cognitoStub.js`, `cognitoAuthErrors.js`; configure via `VITE_*` env vars. | 2026-04-16 | End-to-end Cognito flows for the SPA. |
| Expanded `backend/template.yaml` with Cognito User Pool + app client (email alias, password policy, required attributes, SRP + refresh flows, no client secret). | 2026-04-16 | Replaced empty SAM scaffold with auth-ready Cognito resources. |
| Added `/dashboard` route, `DashboardPage` (auth gate, welcome, sign out), and `LandingPage` redirect to dashboard when already signed in. | 2026-04-16 | Baseline authenticated shell for post-login UX. |
| Implemented sign-up with profile fields, email verification (`confirmSignUp`), and resend code; wired `SignupPage` to Cognito. | 2026-04-16 | Registration path aligned with pool required attributes. |
| Implemented sign-in restricted to **email only** (`LoginPage` + validation); Cognito `loginWith`: `email: true`, `username: false`; sign-in uses verified email as Amplify `username` parameter. | 2026-04-16 | Avoids username-vs-alias confusion; simplified login UX. |
| Stopped ignoring `MEMORY_BANK.md` in `.gitignore` so the memory bank is tracked in git. | 2026-04-16 | Keeps product/design history with the repo. |
| Merged `feature/user-handling` into `main` and pushed to `origin` (includes Cognito integration and dashboard shell). | 2026-04-16 | Remote `main` updated to match integrated feature work. |
| Redesigned global SPA styles in `frontend/src/styles.css` (design tokens, subtle motion, `prefers-reduced-motion`, landing/auth/dashboard polish); removed unused `frontend/src/style.css`; replaced inline styles with utility classes where appropriate; `frontend/src/main.ts` now imports `styles.css` if used. | 2026-04-16 | Cleaner, Apple-inspired UI; no new runtime deps. |
| Added `AppliCacheData` DynamoDB table to `backend/template.yaml` (partition key `PK`, sort key `SK`, on-demand billing) with stack outputs for name and ARN. | 2026-04-16 | Establishes single-table storage for profiles and future application entities. |
| Implemented Cognito **Post Confirmation** Lambda at `backend/functions/postConfirmation/` (Node.js 20, AWS SDK v3 `PutItem`); profile item shape `PK` = `USER#<sub>`, `SK` = `PROFILE#<sub>` with email, names, birthdate, username, `createdAt`. Wired IAM (`dynamodb:PutItem` on table only), `AWS::Lambda::Permission` for `cognito-idp.amazonaws.com`, and `CognitoUserPool.LambdaConfig.PostConfirmation` in SAM. | 2026-04-16 | Confirmed users get a profile row automatically after email verification. |
| Added root `.gitignore` entry `node_modules/` (covers frontend and packaged Lambda dependencies). | 2026-04-16 | Avoids committing installed packages. |
| Implemented **boards** Lambda (`GET`/`POST /boards`): create/list user boards in `AppliCacheData` with `PK`=`USER#<sub>`, `SK`=`BOARD#<id>`; `POST` stores `entityType: BOARD`, `boardName`, `createdAt`/`updatedAt` (ISO), default **columns** (Company / Job Title / Status) with `crypto.randomUUID()` ids, **`rows: []`**; `GET` returns boards with `columns`, `rows`, `entityType`, timestamps. | 2026-04-16 | `backend/functions/boards/index.js`; REST authorizer `sub` from Cognito claims. |
| Frontend **boards API client** (`listBoards`, `getBoard`, `createBoard` with optional column payload) with JSDoc for response shapes; `VITE_API_URL` base + Bearer id token. | 2026-04-16 | `frontend/src/api/boardsApi.js`. |
| Dashboard **job boards**: `boardFromServer` / `createEmptyBoard` with **`persisted`** and **`columnsLocked`**; list boards on load when API configured; table UI with optional add-column, entries gate, rows. | 2026-04-16 | `frontend/src/dashboard/boardUtils.js`, `DashboardPage.jsx`, `BoardTableView.jsx`. |
| **Deferred save UX**: sidebar flow only adds a **local draft** (`draft-<uuid>`); **`POST /boards` runs only** from the primary **Create** control **below the table**; `savingBoardId` / `saveBoardError`; bar hidden after successful save. Sidebar uses **Continue** + **Cancel** (no blur-to-submit); drafts show **(unsaved)**. | 2026-04-16 | `DashboardPage.jsx`, `DashboardSidebar.jsx`; styles `.dashboard-draft-save`. |
| **Draft vs persisted columns**: drafts use **`columnsLocked: false`** until save; after save, **`boardFromServer`** sets **`columnsLocked: true`** (no **+**). **`POST /boards`** can include optional **`columns`** from the client so draft column definitions persist; if omitted, the API uses the default three. **`handleAddColumn`** runs only when **`!columnsLocked`**. | 2026-04-16 | `boardUtils`, `DashboardPage.handleSaveDraftBoard`, `boards/index.js` POST. |
| **`GET /boards/{boardId}`** (DynamoDB **`GetItem`** on `USER#<sub>` / `BOARD#<id>`); shared **`sanitizeColumns`** + **`buildBoardDto`** with list **`GET`**. Frontend **`getBoard`**, **`handleSelectBoard`**: refetch persisted board on sidebar click so the main table matches stored columns/rows. | 2026-04-16 | IAM `dynamodb:GetItem`; `template.yaml` route; `boardsApi.js`. |
| **Dashboard UI (boards)**: shared **`.dashboard-accent-btn`** (same accent text treatment as sidebar “Create new table”) for **Create** (draft save) and **Start adding entries**; **unboxed** draft save and entries-gate sections (top divider only, no card); primary copy **“Press Create and start caching your applications!”**; duplicate draft hint under the grid removed. | 2026-04-16 | `styles.css`, `DashboardPage`, `BoardTableView`. |
| **Board row entries (DynamoDB)**: **`POST /boards/{boardId}/entries`** on API Gateway (same Cognito authorizer); **`dynamodb:UpdateItem`** on `BoardsFunction`. Lambda loads board via **`GetItem`**, validates **`cells`** keys match the board’s column ids exactly (no missing/extra keys), appends one element to **`rows`** with **`UpdateItem`** + **`list_append`**, each stored row **`{ rowId, cells, createdAt, updatedAt }`**; board **`updatedAt`** refreshed. **`mapRowForApi`** maps **`rowId`** or **`id`** for **`GET`** DTOs. **`201`** returns **`{ row: { id, cells, … }, updatedAt }`**. | 2026-04-17 | `backend/template.yaml`, `backend/functions/boards/index.js`. |
| **Board entries (SPA)**: **`addBoardEntry(boardId, { cells })`** in **`boardsApi.js`** (Bearer + JSON). Client rows use **`pendingSave`** for drafts; **Save** / **Enter** submit; failed API keeps draft + inline error + retry; success merges server **`row`** locally (no refetch flicker). **`boardFromServer`**: **`entriesEnabled: true`** when **`rows.length > 0`** so boards with data skip the “Start adding entries” gate; gate only for **persisted + no rows + not yet enabled**. Table: empty **Save** column header, read-only cells for saved rows. | 2026-04-17 | `frontend/src/api/boardsApi.js`, `boardUtils.js`, `BoardTableView.jsx`, `DashboardPage.jsx`. |
| **Edit board entries (PATCH)**: **`PATCH /boards/{boardId}/entries/{rowId}`** — API Gateway event **`UpdateBoardEntry`**; **`AllowMethods`** / **`Access-Control-Allow-Methods`** extended with **`PATCH`** on **`Cors`** and **`DEFAULT_4XX` / `DEFAULT_5XX`**. Lambda: read–modify–write — **`GetItem`**, locate row by **`rowId`** or legacy **`id`**, **`normalizeCellsForBoard`** (same rules as POST), replace row in **`rows`** array, **`UpdateItem`** **`SET`** **`#rows`**, **`#updatedAt`**; **`200`** **`{ row: { id, cells, createdAt, updatedAt }, updatedAt }`**. **`corsHeaders`** include **`PATCH`**. IAM unchanged (**`GetItem`** / **`UpdateItem`** already granted). SPA: **`updateBoardEntry`**, **`editingRowId`** + **`originalEditRowData`** snapshot for cancel, **`handleStartEditRow`** (revert prior row when switching edit target; block while **`savingEntryRowId`**), **`handleCancelEdit`**, **`handleUpdateRow`**, **`handleCellChange`** for drafts and active edit row; clear edit snapshot when **`activeBoardId`** changes; **`saveEntryError`** for add + update failures. **`BoardTableView`**: unified **`showRowActionsColumn`** (draft **Save** and/or saved-row actions), read-only vs edit vs draft rows, **Save** / **Cancel** in edit mode, **Escape** / **Enter** on edit inputs, disabled while **`savingRowId`** matches row. Styles: **`.board-table__tr--interactive`**, **`.board-table__edit-btn`**, **`.board-table__edit-actions`**, **`.board-table__cancel-edit`**, hover / **`focus-within`** / **`focus-visible`** for discoverability. | 2026-04-17 | `backend/template.yaml`, `backend/functions/boards/index.js`, `frontend/src/api/boardsApi.js`, `DashboardPage.jsx`, `BoardTableView.jsx`, `styles.css`. |
| **Board entry table: width follows columns; Edit as icon**: **`board-table-wrap`** and **`board-table-scroll`**: **`width: fit-content`**, **`max-width: 100%`** so the bordered table area sizes to column content instead of stretching the full dashboard column; **`board-table`**: **`width: auto`**, **`table-layout: auto`**. **`board-table__th--action`**: **`min-width`** reduced (e.g. **3rem**) so the actions column stays compact when only the edit control shows; column still grows for **Save** / **Save + Cancel**. **Edit** control: inline **square-pen** SVG (**`BoardEditIcon`**, **`stroke="currentColor"`**), visible label removed; **`aria-label`** on the button keeps **“Edit row …”** for assistive tech. | 2026-04-17 | `BoardTableView.jsx`, `styles.css`. |
| **Delete board entries**: **`DELETE /boards/{boardId}/entries/{rowId}`** — SAM **`DeleteBoardEntry`**; CORS / **`GatewayResponses`** include **`DELETE`**. Lambda: **`GetItem`**, filter **`rows`** by **`rowId`** / **`id`**, **`404`** if board or row missing, **`UpdateItem`** **`SET`** **`rows`** + **`updatedAt`**, **`200`** **`{ updatedAt }`**. SPA: **`deleteBoardEntry`**, **`deletingRowId`**, **`window.confirm`**, local row removal; trash icon (**`BoardDeleteIcon`**) beside edit, red hover (**.board-table__delete-btn**); **`focusAfterDelete`** + **`requestAnimationFrame`** focus next row actions / **Add New Entry** / table region. | 2026-04-17 | `backend/template.yaml`, `backend/functions/boards/index.js`, `frontend/src/api/boardsApi.js`, `DashboardPage.jsx`, `BoardTableView.jsx`, `styles.css`. |
| **Board entry validation (no all-blank saves)**: At least one cell must be non-whitespace after trim before **Save** on new or edited rows. **`entryCellsHaveAtLeastOneFilledValue`** + **`ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE`** in **`boardUtils.js`**; **`handleSaveRow`** / **`handleUpdateRow`** guard; **Save** buttons disabled when all empty; Lambda **`cellsHaveAtLeastOneNonWhitespaceValue`** after **`normalizeCellsForBoard`** on **`POST …/entries`** and **`PATCH …/entries/{rowId}`** → **`400`**. **`setSavingEntryRowId`** only after validation passes (avoids stuck **Saving…**). | 2026-04-17 | `boardUtils.js`, `DashboardPage.jsx`, `BoardTableView.jsx`, `backend/functions/boards/index.js`. |
| **Board table UI polish (post-delete)**: Removed **“No entries yet”** empty copy (it had briefly lived in-table, then below the bordered scroll, then was dropped per UX). **`.board-table__edit-btn`**: default icon color **`var(--muted)`** like **`.board-table__delete-btn`**, **`var(--accent)`** on hover for affordance. | 2026-04-17 | `BoardTableView.jsx`, `styles.css`. |
| **Board metadata editing (PATCH `/boards/{boardId}`)**: SAM **`UpdateBoard`** event on **`BoardsFunction`** (**`PATCH`** + path **`/boards/{boardId}`**); CORS already included **`PATCH`**. Lambda **`PATCH`** split by path: **no `rowId`** → update board **`boardName`**, **`columns`**, **`updatedAt`** via **`UpdateItem`** (validate non-empty **`boardName`**, non-empty **`columns`** array, max **64**, each column **`name`** non-empty; assign **`randomUUID()`** when **`id`** missing/blank); **`200`** returns **`buildBoardDto`** merged in memory. **With `rowId`** → existing row PATCH unchanged. **`normalizeColumnsFromPatchBody`** helper; **`MAX_COLUMNS`** shared with create path. | 2026-04-17 | `backend/template.yaml`, `backend/functions/boards/index.js`. |
| **Board metadata editing (SPA)**: **`updateBoard(boardId, { boardName, columns })`** in **`boardsApi.js`** (**`PATCH`**, Bearer + JSON). **Dashboard**: **`isEditingBoard`**, **`boardEditDraft`**, **`savingBoardEdit`**, **`saveBoardEditError`**; **`boardForTable`** view model; **`canSaveBoardEdit`** (trimmed non-empty board name + every column name non-empty); **`handleSaveBoardEdit`** / cancel; **`handleAddColumn`** branches to append draft column when editing; **`handleRemove`** / rename column drafts; **`handleUpdateBoard`** merges **`boardFromServer`** into **`boards`**. **Mutual exclusion** on **Edit Board**: revert in-progress row edit (same as cancel), drop **`pendingSave`** draft rows, then open board edit. Row/cell/entry actions gated while **`isEditingBoard`**; **`activeBoardId`** change clears board edit state. | 2026-04-17 | `frontend/src/api/boardsApi.js`, `DashboardPage.jsx`. |
| **Board metadata editing (UI)**: Board title (**`h2`** / input) **above** the table; **⋯** board actions menu (**Edit Board** / **Delete Board** disabled, “coming soon”) in the **thead** row **aligned with column headers** (after data + optional **+** column, before row-actions column); empty body cell uses **`board-table__td--board-menu-spacer`** (no **`--pad`** muted fill) so the spacer matches row striping. Edit mode: column header inputs with **remove** (**`×`**) when **>1** column, **Save Changes** / **Cancel**, **`.board-table__board-edit-input`** hover/focus borders, **`.board-actions`** dropdown styles. | 2026-04-17 | `BoardTableView.jsx`, `styles.css`. |

### Recent work log (since last backlog snapshot)

Entries below mirror the table above in narrative form for quick scanning.

**2026-04-16 — Repository**

- Removed `MEMORY_BANK.md` from `.gitignore` and merged `feature/user-handling` into `main`, then pushed so the memory bank and integrated auth/dashboard work live on `origin/main`.

**2026-04-16 — Frontend**

- Shipped a CSS-first UI pass: expanded tokens, backgrounds, button/input focus and hover behavior, staggered hero entry animation where appropriate, loading state with dot pulse, and glass-style auth card; deleted the orphaned `style.css` asset and consolidated on `styles.css`.

**2026-04-16 — Backend / AWS**

- Defined the single DynamoDB table `AppliCacheData` in SAM and deployed the Post Confirmation Lambda that persists `USER#<sub>` / `PROFILE#<sub>` items after successful sign-up confirmation, with least-privilege IAM and Cognito invoke permission.

**2026-04-16 — Boards API & DynamoDB shape**

- Boards Lambda implements `GET`/`POST` for `/boards`: items include `entityType: BOARD`, ISO `createdAt`/`updatedAt`, server-generated default columns with stable UUID ids, and empty `rows` on create; list returns the same fields for each board.

**2026-04-16 — Dashboard: boards UI & deferred save**

- Connected the SPA to the boards API when `VITE_API_URL` is set; normalized server payloads in `boardFromServer` with `persisted`/`columnsLocked` flags.
- Adopted **deferred persistence**: naming a table in the sidebar creates a **draft** only; the user saves to DynamoDB via the main **Create** action; loading and error states are scoped to that action.
- Sidebar lists drafts with an **(unsaved)** label; the inline create flow uses **Continue** / **Cancel** (no accidental submit on blur).
- **Drafts** allow the **+ add column** control; **persisted** boards hide it via **`columnsLocked`**.

**2026-04-16 — Boards API & dashboard polish (follow-up)**

- **`POST /boards`** accepts an optional **`columns`** array (sanitized, max 64); the SPA sends the draft’s columns when saving so extra columns are stored, not only the default three.
- **`GET /boards/{boardId}`** loads a single board with **`GetItem`**; list and item responses share **`buildBoardDto`**. Selecting a persisted board in the sidebar triggers **`getBoard`** to refresh the main view from DynamoDB.
- **UI**: Introduced **`.dashboard-accent-btn`** for the main **Create** and **Start adding entries** actions (accent link-style, aligned with the sidebar). Draft-save and entries-gate areas use a **light top rule** only (no boxed card). Primary draft line: **“Press Create and start caching your applications!”** Redundant hint under the table body was removed.

**2026-04-17 — Board entries persisted to DynamoDB**

- **API / IaC**: New **`POST /boards/{boardId}/entries`**; boards Lambda IAM extended with **`UpdateItem`**. Handler branches **`POST`** with **`pathParameters.boardId`** (add entry) vs **`POST /boards`** without **`boardId`** (create board, unchanged).
- **DynamoDB**: **`list_append(if_not_exists(rows, []), [newEntry])`**; new entry shape **`rowId`** (UUID), **`cells`** (string map aligned to columns), **`createdAt`** / **`updatedAt`** ISO strings; **`ConditionExpression`** on key existence.
- **Validation**: Reject **`400`** if **`cells`** keys don’t match the board’s column ids one-to-one; **`404`** if board missing.
- **Frontend**: **`addBoardEntry`**; draft rows (**`pendingSave`**) with **Save** (`.dashboard-accent-btn`), **Saving…**, **Enter** to save, **`role="alert"`** error on failure; **`handleCellChange`** only for draft rows; **`+ Add New Entry`** unchanged flow.
- **UX**: **`boardFromServer`** sets **`entriesEnabled`** when the server returns rows so existing data doesn’t require the entries gate; **“Start adding entries”** only when the persisted board has **no rows** and entry mode isn’t on yet.

**2026-04-17 — Board entry handling after POST entries (PATCH, inline edit, layout, icon)**

Work in this stream builds on **`POST /boards/{boardId}/entries`** (documented above). Together these cover full **create + update** for board row entries.

- **API / IaC (PATCH)**  
  - New route **`PATCH /boards/{boardId}/entries/{rowId}`** on the existing REST API, same Cognito authorizer as other board routes.  
  - **CORS**: **`GET,POST,PATCH,OPTIONS`** on the API **`Cors`** config and on **`GatewayResponses`** (**`DEFAULT_4XX`** / **`DEFAULT_5XX`**) so browsers get **`PATCH`** and preflight/error responses correctly.

- **Lambda (`boards/index.js`)**  
  - **`PATCH`**: parse **`boardId`** / **`rowId`**, require JSON **`cells`**, **`GetItem`** the board, **`404`** if missing, **`normalizeCellsForBoard`** → **`400`** on validation mismatch, find existing row by **`rowId`** or **`id`**, **`404`** if not found, merge updated row (preserve **`createdAt`**, set **`updatedAt`**), **`UpdateItem`** with new **`rows`** list and board **`updatedAt`**, **`200`** with **`row`** + board **`updatedAt`** aligned with POST entry response shape.

- **Frontend API**  
  - **`updateBoardEntry(boardId, rowId, { cells })`**: **`PATCH`**, Bearer id token, **`401`** / **`404`** / shared error parsing like **`addBoardEntry`**.

- **Dashboard (`DashboardPage.jsx`)**  
  - State: **`editingRowId`**, **`originalEditRowData`** (`{ rowId, cells }`) for cancel and for reverting when starting edit on a different row.  
  - **`useEffect` on `activeBoardId`**: clears edit state and entry error when switching boards.  
  - **`handleCellChange`**: allows edits for **`pendingSave`** draft rows or for the row whose **`id`** matches **`editingRowId`**.  
  - **`handleUpdateRow`**: builds **`cells`** from current column ids, calls **`updateBoardEntry`**, merges **`data.row`** on success, clears edit state; uses **`savingEntryRowId`** (shared with new-row save).  
  - **`handleStartEditRow`**: does not run while a row save is in flight; snapshots **`cells`** for cancel; restores the previously edited row from **`originalEditRowData`** when changing which row is being edited.

- **`BoardTableView`**  
  - **`showRowActionsColumn`** when the board is persisted, entries are enabled, and there is at least one row (covers draft-only **Save**, saved-row **Edit**, and mixed).  
  - Saved rows: **Edit** control (later an icon only), **Enter** / **Escape** on inputs in edit mode, **Save** / **Cancel** while editing, **Saving…** and disabled inputs when that row is saving.

- **Styles (first pass for PATCH/edit)**  
  - Row hover / keyboard **focus-within** reveals the edit control; **`.board-table__edit-actions`**, **`.board-table__cancel-edit`**, focus rings for accessibility.

- **Styles (layout + edit control)**  
  - Table “box” (**`board-table-wrap`**, **`board-table-scroll`**) uses **`width: fit-content`** and **`max-width: 100%`** so overall width tracks the number of columns and cell content instead of always filling the main column.  
  - **`board-table`**: **`width: auto`** (no forced full width).  
  - Actions header **`min-width`** tuned so icon-only rows stay narrow; **`BoardEditIcon`**: small square-pen SVG, **`aria-hidden`**, button **`aria-label`** carries the edit action name.

**2026-04-17 — Delete board row entries**

- **`DELETE /boards/{boardId}/entries/{rowId}`** removes one row from the board item’s **`rows`** list; CORS allows **`DELETE`** on gateway error responses.
- **Dashboard**: **`deleteBoardEntry`**, **`handleDeleteRow`** with confirm, **`deletingRowId`** loading state, **`focusAfterDelete`** for **`focusAfterDeleteComplete`**; **`BoardTableView`** trash + edit row actions, **`data-board-row-index`** for focus target, **`tabIndex={-1}`** on **`board-table-scroll`** as fallback; when **`entriesEnabled`** and no rows, header-only table plus **+ Add New Entry**.

**2026-04-17 — Board entry validation (non-empty saves)**

- **SPA**: Users cannot submit a new or updated row unless at least one column has non-whitespace text; shared helper and inline **`saveEntryError`**; primary **Save** controls disabled when every field is blank; **`Enter`** still routes through the same validation.
- **API**: Boards Lambda rejects all-blank **`cells`** maps with **`400`** for both **POST** (append entry) and **PATCH** (update entry).
- **Bugfix**: **`setSavingEntryRowId`** runs only after validation succeeds so failed validation does not leave the row stuck in **Saving…**.

**2026-04-17 — Board table copy & edit affordance**

- **Empty state**: Removed the **“No entries yet”** line entirely so an empty board shows only the column header strip (inside the bordered scroll) and **+ Add New Entry**—no extra muted sentence.
- **Edit vs delete styling**: Idle edit icon uses the same muted stroke as the trash control; hover tints the edit icon with the accent color and light blue background so it stays distinct from delete (red hover) without looking “always blue.”

**2026-04-17 — Board metadata editing (name + columns)**

- **API / IaC**  
  - New route **`PATCH /boards/{boardId}`** (SAM **`UpdateBoard`**) on the existing REST API and **`BoardsFunction`**; same Cognito default authorizer and existing CORS (**`PATCH`** already allowed).  
  - **`PATCH`** handler branches on **`pathParameters`**: if **`rowId`** is absent → **board metadata** update; if present → **row entry** update (unchanged).

- **Lambda**  
  - Board update: **`boardName`** and **`columns`** (required, validated); new column **`id`**s generated when blank; **DynamoDB** **`UpdateItem`** sets **`boardName`**, **`columns`**, **`updatedAt`**; **`rows`** not rewritten (**schema-on-read**: removed column ids simply disappear from the UI).  
  - Response **`200`** with full **`buildBoardDto`** shape.

- **Frontend API**  
  - **`updateBoard`** mirrors other board calls (Bearer id token, **`Content-Type: application/json`**).

- **Dashboard**  
  - Local draft for board name and columns while editing; **Save** disabled until names validate (trimmed non-empty board title and every column name).  
  - Entering **Edit Board** cancels an active **row** edit and removes unsaved **pending** draft rows so only one edit context is active.  
  - After successful save, **`boardFromServer`** updates **`activeBoard`** and the sidebar list.

- **Board table UI**  
  - Board title remains above the grid; **⋯** menu sits in the **header row** with column titles (not beside the title).  
  - Edit mode: rename board, rename/reorder/add/remove columns (minimum one column); **Delete Board** remains disabled in the menu.  
  - **Fix**: spacer cell under the ⋯ column uses **`board-table__td--board-menu-spacer`** instead of **`board-table__td--pad`** so it does not inherit the muted gray background used for the **+** column spacer.

## Update Policy

- Do not modify this file unless the user explicitly asks.
- When requested, append completed tasks to the backlog table and keep design decisions current.
