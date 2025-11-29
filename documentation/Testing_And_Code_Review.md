# Testing and Code Review

## 1. Change History

| **Change Date** | **Modified Sections** | **Rationale** |
|-----------------|-----------------------|---------------|
| 29.11.2025 | 2.1.1 | Updated backend test chart with correct line numbers after refactor, listed specific mocked components |
| 27.11.2025 | 4.1 | More detailed setup instructions|
| 27.11.2025 | 3.2, 4.* | Moved the frontend nonfunctional from frontend to nonfunctional|

---

## 2. Back-end Test Specification: APIs

### 2.1. Locations of Back-end Tests and Instructions to Run Them

#### 2.1.1. Tests

##### Notes API

+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| Interface                 | Describe Group Location, No Mocks                                   | Describe Group Location, With Mocks                                | Mocked Components                                    |
+===========================+=====================================================================+====================================================================+======================================================+
| POST `/api/notes`         | `backend/src/__tests__/\                                            | `backend/src/__tests__/\                                           | `noteService`,\                                      |
|                           | unmocked/notes.normal.\                                             | mocked/notes.mocked.\                                              | OpenAI embeddings client                             |
|                           | test.ts#L46`                                                        | test.ts#L66`                                                       |                                                      |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| PUT `/api/notes/:id`      | `#L288`                                                             | `#L219`                                                            | `noteService`,\                                      |
|                           |                                                                     |                                                                    | OpenAI embeddings client                             |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| DELETE `/api/notes/:id`   | `#L406`                                                             | `#L315`                                                            | `noteService`                                        |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/notes/:id`      | `#L470`                                                             | `#L270`                                                            | `noteService`                                        |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/notes`          | `#L537`                                                             | `#L360`                                                            | `noteService`,\                                      |
|                           |                                                                     |                                                                    | `workspaceModel`,\                                   |
|                           |                                                                     |                                                                    | OpenAI embeddings client                             |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/notes/:id/\     | `#L910`                                                             | `#L643`                                                            | `noteService`                                        |
| workspaces`               |                                                                     |                                                                    |                                                      |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/notes/:id/\    | `#L671`                                                             | `#L688`                                                            | `noteService`,\                                      |
| share`                    |                                                                     |                                                                    | `workspaceModel`,\                                   |
|                           |                                                                     |                                                                    | `noteModel`                                          |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/notes/:id/\    | `#L793`                                                             | `#L787`                                                            | `noteService`,\                                      |
| copy`                     |                                                                     |                                                                    | `noteModel`                                          |
+---------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
##### Workspaces API

+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| Interface                                    | Describe Group Location, No Mocks                                   | Describe Group Location, With Mocks                                | Mocked Components                                    |
+==============================================+=====================================================================+====================================================================+======================================================+
| POST `/api/workspace`                        | `backend/src/__tests__/\                                            | `backend/src/__tests__/\                                           | `workspaceService`                                   |
|                                              | unmocked/workspace.normal.\                                         | mocked/workspace.mocked.\                                          |                                                      |
|                                              | test.ts#L44`                                                        | test.ts#L51`                                                       |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/personal`                | `#L166`                                                             | `#L94`                                                             | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/user`                    | `#L281`                                                             | `#L147`                                                            | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/:id`                     | `#L343`                                                             | `#L181`                                                            | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/:id/members`             | `#L401`                                                             | `#L215`                                                            | `workspaceService`,\                                 |
|                                              |                                                                     |                                                                    | `notificationService`                                |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/:id/tags`                | `#L445`                                                             | `#L265`                                                            | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/:id/\                    | `#L527`                                                             | `#L299`                                                            | `workspaceService`                                   |
| membership/:userId`                          |                                                                     |                                                                    |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/workspace/:id/members`            | `#L610`                                                             | `#L333`                                                            | `workspaceService`,\                                 |
|                                              |                                                                     |                                                                    | `notificationService`,\                              |
|                                              |                                                                     |                                                                    | `userModel`                                          |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/workspace/:id/leave`              | `#L838`                                                             | `#L570`                                                            | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| PUT `/api/workspace/:id`                     | `#L950`                                                             | `#L588`                                                            | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| PUT `/api/workspace/:id/picture`             | `#L1042`                                                            | `#L624`                                                            | `workspaceService`,\                                 |
|                                              |                                                                     |                                                                    | `mediaService`                                       |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| DELETE `/api/workspace/:id/\                 | `#L1147`                                                            | `#L660`                                                            | `workspaceService`                                   |
| members/:userId`                             |                                                                     |                                                                    |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| DELETE `/api/workspace/:id`                  | `#L1314`                                                            | `#L694`                                                            | `workspaceService`,\                                 |
|                                              |                                                                     |                                                                    | `notificationService`                                |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/workspace/:id/poll`                | `#L1420`                                                            | `#L728`                                                            | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+

##### Authentication API

+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| Interface                                    | Describe Group Location, No Mocks                                   | Describe Group Location, With Mocks                                | Mocked Components                                    |
+==============================================+=====================================================================+====================================================================+======================================================+
| POST `/api/auth/signup`                      | `backend/src/__tests__/\                                            | `backend/src/__tests__/\                                           | `authService`,\                                      |
|                                              | unmocked/auth.normal.\                                              | mocked/auth.mocked.\                                               | `workspaceService`,\                                 |
|                                              | test.ts#L57`                                                        | test.ts#L57`                                                       | Google OAuth2Client                                  |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/auth/signin`                      | `#L105`                                                             | `#L453`                                                            | `authService`,\                                      |
|                                              |                                                                     |                                                                    | Google OAuth2Client                                  |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/auth/dev-login`                   | `#L122`                                                             | `#L655`                                                            | `authService`,\                                      |
|                                              |                                                                     |                                                                    | `userModel`                                          |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+

##### User API

+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| Interface                                    | Describe Group Location, No Mocks                                   | Describe Group Location, With Mocks                                | Mocked Components                                    |
+==============================================+=====================================================================+====================================================================+======================================================+
| GET `/api/user/profile`                      | `backend/src/__tests__/\                                            | —                                                                  | —                                                    |
|                                              | unmocked/user.normal.\                                              |                                                                    |                                                      |
|                                              | test.ts#L44`                                                        |                                                                    |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| PUT `/api/user/profile`                      | `#L76`                                                              | `backend/src/__tests__/\                                           | `userModel`,\                                        |
|                                              |                                                                     | mocked/user.mocked.\                                               | `workspaceModel`                                     |
|                                              |                                                                     | test.ts#L52`                                                       |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| DELETE `/api/user/profile`                   | `#L279`                                                             | `#L125`                                                            | `workspaceModel`,\                                   |
|                                              |                                                                     |                                                                    | `workspaceService`                                   |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/user/fcm-token`                   | `#L494`                                                             | `#L176`                                                            | `userModel`                                          |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/user/:id`                          | `#L630`                                                             | `#L247`                                                            | `userModel`                                          |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| GET `/api/user/email/:email`                 | `#L700`                                                             | `#L349`                                                            | `userModel`                                          |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+

##### Message API

+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| Interface                                    | Describe Group Location, No Mocks                                   | Describe Group Location, With Mocks                                | Mocked Components                                    |
+==============================================+=====================================================================+====================================================================+======================================================+
| GET `/api/messages/\                         | `backend/src/__tests__/\                                            | `backend/src/__tests__/\                                           | `messageModel`                                       |
| workspace/:\                                 | unmocked/message.normal.\                                           | mocked/message.mocked.\                                            |                                                      |
| workspaceId`                                 | test.ts#L40`                                                        | test.ts#L48`                                                       |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| POST `/api/messages/\                        | `#L181`                                                             | `#L72`                                                             | `messageModel`,\                                     |
| workspace/:workspaceId`                      |                                                                     |                                                                    | `workspaceModel`                                     |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| DELETE `/api/messages/:messageId`            | `#L268`                                                             | `#L115`                                                            | `messageModel`                                       |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+

##### Media API

+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
| Interface                                    | Describe Group Location, No Mocks                                   | Describe Group Location, With Mocks                                | Mocked Components                                    |
+==============================================+=====================================================================+====================================================================+======================================================+
| POST `/api/media/upload`                     | `backend/src/__tests__/\                                            | `backend/src/__tests__/\                                           | `mediaService`                                       |
|                                              | unmocked/media.normal.\                                             | mocked/media.mocked.\                                              |                                                      |
|                                              | test.ts#L78`                                                        | test.ts#L54`                                                       |                                                      |
+----------------------------------------------+---------------------------------------------------------------------+--------------------------------------------------------------------+------------------------------------------------------+
#### 2.1.2. Commit Hash Where Tests Run
`c5f46d61177b82ff74c9c30dfd32a5e24de5d683`

#### 2.1.3. How to Run the Tests

1. `cd backend`
2. `npm install`
3. `npm test`

---

### 2.2. GitHub Actions Configuration Location
`~/.github/workflows/backend-tests.yml`

### 2.3. Jest Coverage Report Screenshots (Without Mocking)

![image info](./graphics/UnmockedTests.png)

### 2.4. Jest Coverage Report Screenshots (With Mocking)

![image info](./graphics/MockedTests.png)

### 2.5. Combined Jest Coverage Reports (With & Without Mocking)

![image info](./graphics/TotalTestCoverage.png)

---

## 3. Back-end Non-functional Requirements

### 3.1. Test Locations

+--------------------------------------+------------------------------------------------------------------------------+
| **Non-Functional Requirement**       | **Location in Git**                                                          |
+======================================+==============================================================================+
| Backend – Search Speed               | `ThingSpace.ts/backend/src/\                                                 |
|                                      | __tests__/notes.latency.\                                                    |
|                                      | test.ts`                                                                     |
+--------------------------------------+------------------------------------------------------------------------------+
| Frontend – Two-Click Navigation      | `frontend/app/src/androidTest/\                                              |
|                                      | java/com/cpen321/\                                                           |
|                                      | usermanagement/\                                                             |
|                                      | TestReachWithTwoClicks.kt`                                                   |
+--------------------------------------+------------------------------------------------------------------------------+

#### Backend – Search Speed (`notes.latency.test.ts`)
- **How to run:** `cd backend && npm test -- __tests__/non-func-tests`
- **What it checks:** Seeds 400 notes, issues three representative search queries, and reports the mean latency. Latest runs average ~1.1s/query, comfortably under the 5s budget.

#### Frontend – Two-Click Navigation (`TestReachWithTwoClicks.kt`)
- **How to run:** `cd frontend && ./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunner
Arguments.class=com.cpen321.usermanagement.TestReachWithTwoClicks`
- **What it checks:** Starting from the main workspace screen, the test traverses to note, template, and chat views—both within the current workspace and across other workspaces—counting taps to confirm every note-bearing screen is reachable in ≤2 clicks.

### 3.2. Test Verification and Logs

#### Performance: Search Speed

- Creates 400 notes, runs 3 queries, average ~1.1s (<5s target)
- Logs:

![image info](./graphics/backend-nonfunc-testlog.png)

#### Accessibility: Reach Note Screens in ≤2 Clicks (`TestReachWith2Clicks.kt`)

This test verifies that from a workspace main screen, users can reach:

- templates screen
- chat screen
- content/templates/chat of another workspace

All screens must be reachable in **2 clicks or fewer**.

The test counts the number of clicks for each navigation path.

- Logs:

![image info](./graphics/frontend-nonfunct-testlog.png)


---

## 4. Front-end Test Specification

### 4.1. Location in Git
`./frontend/app/src/androidTest/java/com.cpen321.usermanagement`

To run the frontend tests, one needs to have a working backend (deployed in the cloud or locally)
on top of that it is necessary to update the `frontend/local.properties` file:
sdk.dir= ...sdk folder location on your computer
API_BASE_URL= "...url_to_backend/api"
IMAGE_BASE_URL="...path to a port on the emulator localhost"
GOOGLE_CLIENT_ID="...google client id"

Google client Id can be obtained by setting up a project in the Aoogle OAuth console and creating a web application. The client ID of the web application has to be posted into local.properties. On top of that, one needs to register the frontend app inside the Google OAuth Console. To do that one needs to obtain the development SHA-1 key of the application, generated by the gradle signingReport task. With the key obtained, one can enter the package name: com.cpen321.usermanagement, and the key into the Android client creation menu. While it is vital to create the android client, its Google client id should not be pasted into local.properties, only the backend Google client id.

To set up the content inside the app one can either sign in on their Android Emulator with Thing4G and Friedrich van Aukstin dummy users, which have the right notes and workspaces pre-created, or create two accounts and fill in their bios. In the latter case, one will need to pre-create notes and workspaces as per requirements of a specific test (the per test requirements are listed in comments at the beginning of each test file). One would also need to modify the test file's constants to reflect account names and gmails of the accounts used.

### 4.2. Tests Included
### Test of the “Collaborate” Feature (`TestCollaborate.kt`)

**Prerequisite:**

1. Need 2 user accounts:
   - Workspace Manager  
   - Workspace Member
2. Workspace Manager must have a workspace named **“Test”**
3. There must be **no existing workspaces** named *“Study”* or *“Study v2”*

#### Scenario Steps and Test Case Steps

| Scenario Steps | Test Case Steps |
|---|---|
| **Create Workspace** | |
| 1. The user opens the “Create Workspace” screen. | Open the “Create Workspace” screen. |
| 2. The app shows input fields and a disabled button. | Verify “Pick a workspace name” and disabled “Create Workspace” button. |
| 3a. User enters workspace title already taken. | Pre-create workspace “Test”. Enter “Test” and click Create. |
| 3a1. App shows error. | Check for dialog: **“Failed to create workspace.”** |
| 3. User enters valid title. | Enter “Studies”. Verify “Create” button enabled. |
| 4. User clicks “Create”. | Click “Create”. Verify workspace setup screen shown and “Studies” appears in list. |
| **Update Workspace** | |
| 10. Manager navigates to “Edit Workspace”. | <After workspace creation, one is already at the edit workspace screen> |
| 11. Edit title and bio. | Change title to “Studies v2” and bio “Study group”; click Save; expect “Profile updated successfully.” |
| **Invite to Workspace** | |
| 5. Member selects “Invite User”. | Open Studies v2 → Manage Workspace → Invite icon. |
| 6. App shows input and button. | Verify email field + “Invite to Workspace” button visible. |
| 7a. Enter invalid email. | Enter “invalidemail”, click Invite. |
| 7a1. Error message shown. | Check: **“Could not retrieve profile matching the given email!”** |
| 7. Enter valid email. | Input teammate email → click Invite → expect **“The user got added to the workspace.”** |
| 7b. Invite already-member user. | Enter existing member email and click Invite. |
| 7b1. Error message. | **“The user is already a member!”** |
| **Send Chat Message** | |
| 8. User opens workspace chat. | Open chat icon; verify chat screen shown. |
| 9a. Empty message. | Send blank message; verify no change. |
| 9. Valid message. | Send “Hello team!”; verify appears with picture & timestamp. |
| **Update Workspace as Non-Manager** | |
| 10a. Non-manager tries editing workspace. | Log out as the manager. Open edit screen as non-manager → fields should be greyed out. |
| **Leave Workspace (Non-Manager)** | |
| 12. Non-manager clicks Leave. | Open Studies v2 → Leave Workspace. |
| 13. App removes user. | Studies v2 no longer appears in workspace list. |
| **Ban Users** | |
| 14. Manager opens Members screen. | Log in as manager → Workspaces Screen → <select "Studies v2"> → Manage Workspace → Members icon. |
| 15. Manager bans user. | Click trash next to user. |
| 16. User banned permanently. | User removed, cannot be re-invited → **“That user is banned”** message should show upon an invite attempt |
| **Delete Workspace** | |
| 17. Manager deletes workspace. | Click Delete Workspace (trash icon). |
| 18. Workspace deleted. | Studies v2 disappears and an appropriate success meassage is shown. |

![image info](./graphics/frontend-collaborate-testlog.png)

---

### Test of the “Manage Notes” Feature (`TestNotes.kt`)

**Prerequisite:**  
Two pre-existing workspaces.

| Scenario Steps | Test Case Steps |
|---|---|
| **Create Note** | |
| 1. Open “Create Note” screen. | Tap pencil icon. |
| 2. App shows metadata fields and create button. | Verify “Note Type”, “Tags”, “Fields”. |
| 3a. Create note with no fields. | Click Create with no fields. |
| 3a1. Error. | **“Please add at least one field”** |
| 3b. Create note with empty field label. | Add field but leave label blank; click Create. |
| 3b1. Error. | **“All fields must have a label”** |
| 3. User fills fields. | Add tag(s), add field “Notes”, enter content. |
| 4. Click Create. | |
| 5. Note created. | Verify note appears. |
| **Update Note** | |
| 6. Open note to edit. | Click pencil icon on note. |
| 7. App shows editable fields. | Verify tag add/remove. |
| 8. Modify content & tags. | |
| 9. Click Save. | |
| 10. Note updated. | Verify new values. |
| **Share Note** | |
| 11. Select “Share Note”. | Click Share icon. |
| 12. Workspace selection dialog. | Verify “Share Note” + workspace list. |
| 13. Select workspace & confirm. | Click Share. |
| 14. Note shared. | **“Note shared to workspace successfully”**, note moves workspaces. |
| **Copy Note** | |
| 15. Select “Copy Note”. | Click Copy icon. |
| 16. Workspace selection. | Verify UI. |
| 17. Select workspace. | Click Copy. |
| 18. Note copied. | Appears in both workspaces. |
| **Delete Note** | |
| 19. Select “Delete Note”. | Tap trash. |
| 20. Confirmation dialog. | **“Are you sure… cannot be undone”** |
| 21. Confirm. | Click Delete. |
| 22. Note deleted. | Verify removal. |

![image info](./graphics/frontend-manage-notes-testlog.png)

---

### Test of the “Retrieve Notes” Feature (`TestRetrieveNotes.kt`)

**Prerequisite:**  
Existing workspace with notes.

| Scenario Steps | Test Case Steps |
|---|---|
| **Search Notes** | |
| 1. Open workspace. | Navigate to workspace. |
| 2. Search bar visible. | Verify presence. |
| 3a. Empty query. | Search blank. |
| 3a1. All notes shown. | Verify list. |
| 3. Enter query. | Input string → Search. |
| 4. Matching notes shown. | Relevant notes at top. |
| **Filter Notes by Tags** | |
| 5. Click filter icon. | |
| 6. Tag selection screen. | Verify “All” + checkboxes. |
| 7. Select “All”. | All tags selected. |
| 9. Deselect “All”. | All tags cleared. |
| 11. Select specific tags. | |
| 12. Go back. | |
| 13. Filter applied. | Only matching notes. Ordered according to the search query |

![image info](./graphics/frontend-retrieve-notes-testlog.png)

---

## 5. Automated Code Review Results

### 5.1. Commit Hash Where Codacy Ran
`96e4c5520f47503662f56029212714c229f3617f`

### 5.2. Unfixed Issues per Codacy Category
![image info](./graphics/CodacyCategory.png)

### 5.3. Unfixed Issues per Codacy Code Pattern
![image info](./graphics/CodacyCodePattern.png)

### 5.4. Justifications for Unfixed Issues

No unfixed codacy issues
---
