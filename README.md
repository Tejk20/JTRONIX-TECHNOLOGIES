# JTRONIX — Employee Management Web Application

A full-stack **Employee Management Dashboard** built for the JTRONIX Backend
Internship Assessment.

- **Backend:** Python + FastAPI (in-memory data store, no database)
- **Frontend:** HTML, CSS and Vanilla JavaScript (served by FastAPI)
- **Sign-in:** Two roles — **Admin** (full access) and **Employee** (read-only)

The whole app runs locally as a single project — FastAPI serves both the REST
API and the frontend dashboard.

**Live demo:** https://jtronex-employee-management.onrender.com

---

## Demo Accounts

| Role     | Username   | Password      | Access                          |
| -------- | ---------- | ------------- | ------------------------------- |
| Admin    | `admin`    | `admin123`    | Add, update, delete, view       |
| Employee | `employee` | `employee123` | View only                       |

> These are demo-only credentials stored in memory. Do not use this pattern in
> a real application.

---

## Features

### Backend
- Employee model with **ID, name, department and status**
- Token-based sign-in (`/auth/login`, `/auth/logout`, `/auth/me`)
- Role-based access: mutations require an **admin** token
- `GET /employees` — list all employees
- `GET /employees?department=Engineering` — filter by department
- `GET /employees/{id}` — fetch a single employee
- `POST /employees` — add a new employee (auto-generated ID, `Active` by default)
- `PATCH /employees/{id}/status` — update an employee's status
- `DELETE /employees/{id}` — remove an employee
- Validation for:
  - empty / whitespace-only names
  - empty / whitespace-only departments
  - invalid status values (`Active` / `Inactive` only)
  - non-existent employee IDs (`404`)
- In-memory list — **no database required**
- Pre-loaded sample employees:
  1. Rahul Sharma — Engineering — Active
  2. Priya Patel — HR — Active
  3. Amit Verma — Engineering — Inactive

### Frontend
- Landing page with **Admin** and **Employee** sign-in options
- Separate login pages: `/admin/login/` and `/employee/login/`
- Clean SaaS-style dashboard with sidebar + top navigation bar
- Summary cards: **Total**, **Active** and **Inactive** employees
- Employee table with ID, name, department, status badge and action buttons
- Live **search** (name / ID / department) and **department filter**
- **Add Employee** modal with inline validation
- One-click status toggle (Active ⇄ Inactive)
- Delete an employee with a confirmation prompt
- Success / error toast notifications
- Loading spinner and empty states
- Fully responsive (desktop, tablet, mobile)
- Employee-role users get a **read-only** view (no add/delete/status buttons)
- Session stored in the browser and validated against the API on every request
- All data comes from the API via `fetch()` — nothing is hardcoded

---

## Project Structure

```
Trial project/
├── backend/
│   ├── __init__.py
│   └── main.py              # FastAPI app: auth, models, routes, static serving
├── frontend/
│   ├── index.html           # Landing page (choose Admin / Employee)
│   ├── admin/
│   │   └── login/index.html # Admin sign-in page
│   ├── employee/
│   │   └── login/index.html # Employee sign-in page
│   ├── dashboard/
│   │   └── index.html       # Dashboard markup (protected)
│   ├── css/
│   │   └── styles.css       # Shared styling
│   └── js/
│       ├── session.js       # Session (token) helper
│       ├── login.js         # Login page logic
│       └── app.js           # Dashboard fetch() integration + UI logic
├── tests/
│   └── test_api.py          # API + auth test suite (pytest)
├── pytest.ini               # Scopes test discovery to ./tests
├── requirements.txt
└── README.md
```

---

## Installation

> Requires **Python 3.10+**.

1. Open a terminal in the project root.

2. (Recommended) Create and activate a virtual environment:

   **Windows (PowerShell)**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   **macOS / Linux**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

---

## Running the Application

Start the server from the **project root**:

```powershell
python -m uvicorn backend.main:app --reload
```

Then open your browser at:

- **Landing page:** http://127.0.0.1:8000/
- **Admin sign-in:** http://127.0.0.1:8000/admin/login/
- **Employee sign-in:** http://127.0.0.1:8000/employee/login/
- **Dashboard:** http://127.0.0.1:8000/dashboard/
- **Interactive API docs (Swagger UI):** http://127.0.0.1:8000/docs
- **Alternative API docs (ReDoc):** http://127.0.0.1:8000/redoc

Sign in with one of the demo accounts above. The frontend is served by FastAPI,
so there is no separate frontend server to run.

---

## Running the Tests

```powershell
python -m pytest -q
```

Expected output:

```
23 passed
```

---

## API Reference

Base URL: `http://127.0.0.1:8000`

All `/employees` endpoints require a `Authorization: Bearer <token>` header.
Write operations (`POST`, `PATCH`, `DELETE`) require an **admin** token.

| Method  | Endpoint                    | Description                          | Access   |
| ------- | --------------------------- | ------------------------------------ | -------- |
| `POST`  | `/auth/login`               | Sign in, returns a session token     | Public   |
| `GET`   | `/auth/me`                  | Return the current user              | Any      |
| `POST`  | `/auth/logout`              | Invalidate the current token         | Any      |
| `GET`   | `/employees`                | List all employees                   | Any      |
| `GET`   | `/employees?department=HR`  | Filter employees by department       | Any      |
| `GET`   | `/employees/{id}`           | Get one employee by ID               | Any      |
| `POST`  | `/employees`                | Create a new employee                | Admin    |
| `PATCH` | `/employees/{id}/status`    | Update an employee's status          | Admin    |
| `DELETE`| `/employees/{id}`           | Delete an employee                   | Admin    |

### Login request / response

```http
POST /auth/login
Content-Type: application/json

{ "username": "admin", "password": "admin123", "role": "admin" }
```

```json
{
  "token": "eK3m..._token",
  "username": "admin",
  "role": "admin",
  "full_name": "Administrator"
}
```

### Employee object

```json
{
  "id": 1,
  "name": "Rahul Sharma",
  "department": "Engineering",
  "status": "Active"
}
```

- `status` is one of `"Active"` or `"Inactive"`.

---

## Example Requests & Responses

> Examples below assume you signed in and are sending
> `Authorization: Bearer <token>`.

### 1. Get all employees

```http
GET /employees
Authorization: Bearer <token>
```

```json
[
  { "id": 1, "name": "Rahul Sharma", "department": "Engineering", "status": "Active" },
  { "id": 2, "name": "Priya Patel", "department": "HR", "status": "Active" },
  { "id": 3, "name": "Amit Verma", "department": "Engineering", "status": "Inactive" }
]
```

### 2. Filter by department

```http
GET /employees?department=Engineering
```

```json
[
  { "id": 1, "name": "Rahul Sharma", "department": "Engineering", "status": "Active" },
  { "id": 3, "name": "Amit Verma", "department": "Engineering", "status": "Inactive" }
]
```

### 3. Get an employee by ID

```http
GET /employees/2
```

```json
{ "id": 2, "name": "Priya Patel", "department": "HR", "status": "Active" }
```

**Not found (404):**

```json
{ "detail": "Employee with ID 999 not found." }
```

### 4. Create a new employee

```http
POST /employees
Content-Type: application/json

{
  "name": "Sneha Iyer",
  "department": "Design"
}
```

**Response (201 Created)** — ID auto-generated, status defaults to `Active`:

```json
{ "id": 4, "name": "Sneha Iyer", "department": "Design", "status": "Active" }
```

**Validation error (400):**

```json
{ "detail": "Name cannot be empty." }
```

### 5. Update an employee's status

```http
PATCH /employees/4/status
Content-Type: application/json

{ "status": "Inactive" }
```

```json
{ "id": 4, "name": "Sneha Iyer", "department": "Design", "status": "Inactive" }
```

**Invalid status (400):**

```json
{ "detail": "Invalid status 'Paused'. Allowed values: Active, Inactive." }
```

### 6. Delete an employee

```http
DELETE /employees/4
```

**Response (204 No Content)** — empty body. The employee is removed; a later
`GET /employees/4` returns `404`.

---

## Notes / Design Decisions

- Data is stored in an **in-memory Python list**, so it resets when the server
  restarts (by design — no database is used).
- Department filtering is **case-insensitive** (`engineering` matches
  `Engineering`).
- The frontend calls the API for every operation and refreshes the list after a
  successful add or status change, so the UI always reflects the backend state.
- API errors are surfaced to the user through toast notifications.

---

## Deployment

The app ships with a [`render.yaml`](render.yaml) blueprint and deploys to
[Render](https://render.com) as a single Python web service (FastAPI serves both
the API and the frontend).

- **Repository:** https://github.com/Tejk20/JTRONIX-TECHNOLOGIES
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

To deploy your own copy: push the repo to GitHub, then in the Render dashboard
choose **New → Blueprint** and select the repository. Render reads `render.yaml`
and provisions the service automatically.

> On Render's free plan the service sleeps after inactivity, so the first
> request after a while may take a few seconds to wake up.
