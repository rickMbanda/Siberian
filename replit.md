# Overview

Spring Valley Academic Report System is a comprehensive student information management system built for tracking and managing academic performance across different grade levels. The system is designed as a desktop application using Electron with a React frontend and Express.js backend, connected to MongoDB for data persistence. The application manages student exam results across three assessment types (opener, midterm, endterm) for multiple grade levels from Playgroup through Grade 9, with subject-specific curriculum tailored to each grade level.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 19.1.0 with Create React App as the foundation
- **Routing**: React Router DOM for navigation between different exam modules and reports
- **State Management**: Context API for authentication state management with AuthProvider
- **UI Components**: Custom CSS styling with modular component-based architecture
- **Data Visualization**: Chart.js with react-chartjs-2 for performance analytics and reporting
- **PDF Generation**: jsPDF and html2canvas for generating printable academic reports

## Backend Architecture
- **Runtime**: Node.js with Express.js 5.1.0 server
- **API Design**: RESTful API with two route namespaces:
  - `/api/results` — backward-compatible read/write endpoints (reports use these)
  - `/api/students` — new structured endpoints with upsert logic
- **Data Layer**: Mongoose ODM for MongoDB integration with schema validation
- **Data Integrity**: Unique compound indexing on student records to prevent duplicates
- **CORS**: Cross-origin resource sharing enabled for frontend-backend communication

## Desktop Application Layer
- **Platform**: Electron 37.2.2 for cross-platform desktop application deployment
- **Build System**: Electron Builder for packaging and distribution
- **Development**: Concurrent development server setup with hot-reload capabilities

## Data Architecture

### StudentRecord Schema (Primary — server/models/StudentRecord.js)
All marks for a student are stored in ONE document per student per academic year.
Marks are nested by term → exam type:

```
StudentRecord {
  name, class, academicYear, nameKey, classKey, academicYearKey,
  term1: {
    opener:  { examStatus, maths, english, ..., mean, rubric },
    midterm: { examStatus, maths, english, ..., mean, rubric },
    endterm: { examStatus, maths, english, ..., mean, rubric },
    termlyAverage: Number,   // computed when all 3 exams present
    termlyRubric:  String    // rubric for the termly average
  },
  term2: { ... },
  term3: { ... }
}
```

- **Upsert Logic**: `POST /api/students/upsert` finds the student by (name+class+year), then stamps the specific term/examType slot. Creates a new document if the student doesn't exist yet.
- **Termly Average**: Weighted — Opener 30%, Midterm 30%, End-term 40%. Computed automatically once all three exam types for a term have non-null means.
- **Unique Index**: One document per (nameKey, classKey, academicYearKey).

### Legacy Result Schema (server/models/Result.js)
Kept for backward compatibility. All 2,519 historical flat records were migrated into StudentRecord via bulk upsert. The `/api/results` GET endpoints now read from StudentRecord (flattened to the same format) so reports continue to work unchanged.

- **Database**: MongoDB with Mongoose schemas for flexible document storage
- **Data Normalization**: Automated field normalization for consistent data storage and querying
- **Academic Year Support**: Multi-year data management with academic year filtering

## Frontend API Layer
- **src/api/results.js** — all GET/POST/PUT/DELETE endpoints; auth token included in every request
- **src/api/students.js** — new upsert and structured query functions used by exam entry pages

## Authentication & Authorization
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **User Roles**: Two roles - `admin` (full access) and `teacher` (mark entry only)
- **Session Management**: JWT tokens persisted in localStorage with 8-hour expiry
- **Access Control**: Route-level protection on both frontend and backend middleware
- **User Management**: Admin can create, edit, delete, and reset passwords for teacher accounts
- **Password Management**: Teachers can change their own passwords; admin can reset any user's password
- **Default Admin**: Auto-created on first server startup (username: admin)

# Key Files

| File | Purpose |
|------|---------|
| server/models/StudentRecord.js | New nested schema (one doc per student per year) |
| server/controllers/studentController.js | Upsert logic + termly average calculation + flat-output helpers |
| server/routes/students.js | `/api/students` endpoints |
| server/routes/results.js | `/api/results` endpoints (reads from StudentRecord, flat format) |
| src/api/students.js | Frontend API for upsert and structured queries |
| src/api/results.js | Frontend API for report-compatible queries (auth headers added) |
| src/Pages/OpenerExam.jsx | Loads existing opener marks on mount, saves via upsert |
| src/Pages/MidtermExam.jsx | Loads existing midterm marks on mount, saves via upsert |
| src/Pages/EndTermExam.jsx | Loads existing endterm marks on mount, saves via upsert |
| src/Pages/Reports.jsx | Reports area: academic-year filter drives the data fetch; student picker is deduped to one entry per StudentRecord; per-section Term + Exam Type pickers let users navigate any (term × opener/midterm/endterm) combo for the chosen student or class. Class Marklist requires a single (class, term, examType) selection so the count matches the real class size. |
| src/Components/IndividualReport.jsx | Renders an individual report; subtitle now includes the academic year. |
| src/Components/ClassMarklist.jsx | Renders a class marklist; accepts a `selectedAcademicYear` prop and shows it in the subtitle. |
| src/Utils/subjectsByClass.js | Subject lists per grade |
| src/contexts/AuthContext.js | JWT session management |

# Reports Page Behavior (post-fix)

- **Year selector** at the top drives `fetchResults(year)`. Defaults to the current year. Available options are 2024 → currentYear+1, plus any years observed in the data.
- **Individual Report** → pick Class → pick Student (deduped: one entry per StudentRecord) → pick Term + Exam Type. The picker disables (term, examType) combinations that the student has no record for.
- **Class Marklist** → pick Class + Term + Exam Type. Shows one row per student with proper academic ranking, and the "Showing N students" counter reflects the real class size.
- The flat-row "2519 students" bug is fixed: the backend still returns one flat row per (student × term × examType), but the UI now deduplicates by `studentRecordId` (or `name|class` fallback) wherever a unique-student count is shown.

# Data Reset (April 2026)

- All student records were wiped via `server/wipe-students.js` (deleted 68 StudentRecord docs + 68 legacy Result rows). Database now starts fresh.

# Roster as Single Source of Truth (April 2026 redesign)

The system now has one canonical roster of students per class/year. All exam pages, the marks editor, and reports read from this roster.

- **Admin-only Student Manager** (`src/Pages/StudentManager.jsx`, route `/students`): the only place new students can be added. Admin picks Class + Academic Year, sees the current roster, and adds students by name. Backed by `POST /api/students/roster` and `GET /api/students/roster/class/:className`.
- **Roster API** (`server/controllers/studentController.js`):
  - `createRosterStudent` — creates a StudentRecord with empty term1/2/3 marks (roster entry only).
  - `getRosterByClass` — returns the class roster for an academic year.
  - `upsertMarks` — now **404s if the student is not in the roster**. Mark entry can never auto-create a student.
- **Frontend roster loading** (`src/Utils/loadGradingRows.js`): fetches the roster via the new endpoint and merges in any existing marks for the (term × examType) being entered.
- **Exam pages** (`OpenerExam.jsx`, `MidtermExam.jsx`, `EndTermExam.jsx`): no longer create empty trailing rows or expose any "add student" UI. They render exactly the roster.
- **DataEntryGrid** (`src/Components/DataEntryGrid.jsx`): name field is read-only; no add-row button; no datalist; shows an empty-state message linking to Manage Students if the roster is empty.
- **ResultsManager** (`src/Pages/ResultsManager.js`): the "Add Result" form is removed. It is now an edit-only marks editor; the name field on the edit form is read-only. A banner directs users to Manage Students for adding/removing students.
- **Navigation**: admin-only "Students" link added to `ExamNavigation`; "Manage Students" button added to the Dashboard.

# Delete Semantics (April 2026)

Two distinct delete operations are now exposed, with no overlap:

- **Delete an exam record only** — `DELETE /api/results/:id` (composite id `<mongoId>_termN_examType`) → `studentController.clearExamSlot`. Wipes the marks for that single (term × examType) slot, recomputes the termly average for that term, and saves. **The student stays in the roster.** This is what the trash-can button in Results Manager does.
- **Delete a student entirely** — `DELETE /api/students/:id` (raw Mongo id) → `studentController.deleteRecord`. Removes the entire StudentRecord (the roster entry + every term's marks). This is what the "Remove" button in Manage Students does, behind a confirm dialog.

# Dashboard Exam Picker (April 2026)

The three coloured Opener / Midterm / Endterm tiles on `src/Pages/Dashboard.jsx` were replaced with a single **"Exam Type"** button that opens a dropdown menu listing the three exam types. Selecting one navigates to the matching exam page (`/opener`, `/midterm`, `/endterm`) carrying the chosen class/term/year via router state, exactly as before. The dropdown closes on outside click.

# Manage Students — Search & Bulk Import (April 2026)

`src/Pages/StudentManager.jsx` now includes:

- **Live name search** — a search input above the roster filters by case-insensitive substring. The count badge shows "X of Y shown" while filtering, with a clear-button (✕) inside the input. The search auto-resets when class or academic year changes.
- **Bulk Import modal** — a "📥 Bulk Import…" button under the add-student form opens a modal where admins can paste names (newline- or comma-separated) or upload a CSV/TXT file. Backed by `POST /api/students/roster/bulk` → `studentController.bulkCreateRosterStudents`, which:
  - Trims and normalises each name, ignores blank lines, dedupes within the payload (case/space-insensitive via `normalizeStudentName`).
  - Skips names that already exist on the roster for that class/year (matched on `nameKey`).
  - Inserts the rest with `insertMany({ ordered: false })` so a single duplicate-key collision can't abort the whole batch.
  - Returns `{ submitted, created, skippedExisting[], duplicatesInPayload[], blanks, createdNames[] }` so the UI can show a per-name summary.

# External Dependencies

## Database Services
- **MongoDB**: Primary database for storing student results and academic data
- **Mongoose**: ODM for MongoDB schema management and data validation

## Development & Build Tools
- **Create React App**: React application foundation and build tooling
- **Electron**: Desktop application framework for cross-platform deployment
- **Concurrently**: Development tool for running multiple processes simultaneously
- **Wait-on**: Development dependency for service startup coordination

## UI & Visualization Libraries
- **Chart.js**: Data visualization library for academic performance charts
- **React-ChartJS-2**: React wrapper for Chart.js integration
- **HTML2Canvas**: DOM to canvas conversion for PDF generation
- **jsPDF**: Client-side PDF generation library

## Utility Libraries
- **React Router DOM**: Client-side routing and navigation
- **CORS**: Cross-origin resource sharing middleware
- **dotenv**: Environment variable management for configuration

## Testing Framework
- **React Testing Library**: Component testing utilities
- **Jest DOM**: Extended DOM testing matchers
- **User Event**: User interaction simulation for testing

## Production Dependencies
- **Express.js**: Backend web server framework
- **React-to-Print**: Component printing functionality
- **Web Vitals**: Performance monitoring and analytics
