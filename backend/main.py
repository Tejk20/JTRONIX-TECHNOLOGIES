"""Employee Management API - FastAPI backend.

Run from the project root:
    python -m uvicorn backend.main:app --reload
"""

import os
import secrets
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = FastAPI(
    title="Employee Management API",
    description="An in-memory Employee Management API with simple token sign-in.",
    version="1.1.0",
)

VALID_STATUSES = ("Active", "Inactive")

# ---------------------------------------------------------------------------
# Demo accounts (in-memory — no database). Passwords are plain text ONLY
# because this is a learning/demo project. Never do this in production.
# ---------------------------------------------------------------------------
USERS = {
    "admin": {
        "password": "admin123",
        "role": "admin",
        "full_name": "Administrator",
    },
    "employee": {
        "password": "employee123",
        "role": "employee",
        "full_name": "Employee User",
    },
}

# Active sessions: token -> {"username", "role", "full_name"}
TOKENS: dict = {}

# ---------------------------------------------------------------------------
# In-memory employee store (no database required)
# ---------------------------------------------------------------------------
employees: List[dict] = [
    {"id": 1, "name": "Rahul Sharma", "department": "Engineering", "status": "Active"},
    {"id": 2, "name": "Priya Patel", "department": "HR", "status": "Active"},
    {"id": 3, "name": "Amit Verma", "department": "Engineering", "status": "Inactive"},
]
next_id = 4


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class Employee(BaseModel):
    id: int
    name: str
    department: str
    status: str


class EmployeeCreate(BaseModel):
    name: str = Field(..., examples=["Sneha Iyer"])
    department: str = Field(..., examples=["Design"])
    status: Optional[str] = Field("Active", examples=["Active"])


class StatusUpdate(BaseModel):
    status: str = Field(..., examples=["Inactive"])


class LoginRequest(BaseModel):
    username: str = Field(..., examples=["admin"])
    password: str = Field(..., examples=["admin123"])
    role: Optional[str] = Field(None, examples=["admin"])


class LoginResponse(BaseModel):
    token: str
    username: str
    role: str
    full_name: str


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------
def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """Return the signed-in user, or raise 401."""
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated. Please sign in.")
    user = TOKENS.get(token)
    if not user:
        raise HTTPException(
            status_code=401, detail="Session expired or invalid. Please sign in again."
        )
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Allow only admin users, or raise 403."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


# ---------------------------------------------------------------------------
# Employee helpers
# ---------------------------------------------------------------------------
def get_employee_or_404(employee_id: int) -> dict:
    for employee in employees:
        if employee["id"] == employee_id:
            return employee
    raise HTTPException(
        status_code=404,
        detail=f"Employee with ID {employee_id} not found.",
    )


def validate_text(value: str, field_label: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail=f"{field_label} cannot be empty.",
        )
    return cleaned


def validate_status(value: str) -> str:
    cleaned = value.strip()
    if cleaned not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{value}'. Allowed values: Active, Inactive.",
        )
    return cleaned


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@app.post("/auth/login", response_model=LoginResponse, tags=["auth"])
def login(payload: LoginRequest):
    """Sign in with a demo account and receive a session token."""
    username = payload.username.strip().lower()
    account = USERS.get(username)

    if account is None or account["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if payload.role and account["role"] != payload.role:
        requested = payload.role.capitalize()
        raise HTTPException(
            status_code=403,
            detail=f"This account is not an {requested} account.",
        )

    token = secrets.token_urlsafe(24)
    session = {
        "username": username,
        "role": account["role"],
        "full_name": account["full_name"],
    }
    TOKENS[token] = session

    return LoginResponse(token=token, **session)


@app.get("/auth/me", response_model=LoginResponse, tags=["auth"])
def me(authorization: Optional[str] = Header(default=None), user: dict = Depends(get_current_user)):
    """Return the currently signed-in user."""
    return LoginResponse(token=_extract_token(authorization), **user)


@app.post("/auth/logout", status_code=204, tags=["auth"])
def logout(authorization: Optional[str] = Header(default=None)):
    """Invalidate the current session token."""
    token = _extract_token(authorization)
    TOKENS.pop(token, None)
    return None


# ---------------------------------------------------------------------------
# Employee routes (all require sign-in; changes require admin)
# ---------------------------------------------------------------------------
@app.get("/employees", response_model=List[Employee], tags=["employees"])
def list_employees(
    department: Optional[str] = Query(None, description="Filter by department"),
    user: dict = Depends(get_current_user),
):
    """Return all employees, optionally filtered by department."""
    if department is not None:
        wanted = department.strip().lower()
        return [e for e in employees if e["department"].lower() == wanted]
    return employees


@app.get("/employees/{employee_id}", response_model=Employee, tags=["employees"])
def get_employee(employee_id: int, user: dict = Depends(get_current_user)):
    """Return a single employee by ID."""
    return get_employee_or_404(employee_id)


@app.post("/employees", response_model=Employee, status_code=201, tags=["employees"])
def create_employee(payload: EmployeeCreate, user: dict = Depends(require_admin)):
    """Create a new employee (admin only). ID is auto-generated, status defaults to Active."""
    global next_id

    name = validate_text(payload.name, "Name")
    department = validate_text(payload.department, "Department")

    status = payload.status if payload.status is not None else "Active"
    status = validate_status(status)

    employee = {
        "id": next_id,
        "name": name,
        "department": department,
        "status": status,
    }
    next_id += 1
    employees.append(employee)
    return employee


@app.patch("/employees/{employee_id}/status", response_model=Employee, tags=["employees"])
def update_status(employee_id: int, payload: StatusUpdate, user: dict = Depends(require_admin)):
    """Update an employee's status between Active and Inactive (admin only)."""
    employee = get_employee_or_404(employee_id)
    employee["status"] = validate_status(payload.status)
    return employee


@app.delete("/employees/{employee_id}", status_code=204, tags=["employees"])
def delete_employee(employee_id: int, user: dict = Depends(require_admin)):
    """Delete an employee by ID (admin only)."""
    employee = get_employee_or_404(employee_id)
    employees.remove(employee)
    return None


# ---------------------------------------------------------------------------
# Serve the frontend (registered last so API routes take priority)
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
