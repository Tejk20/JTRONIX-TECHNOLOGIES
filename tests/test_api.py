"""API tests for the Employee Management backend.

Run with:
    pytest -q
"""

import pytest
from fastapi.testclient import TestClient

from backend import main


SAMPLE_EMPLOYEES = [
    {"id": 1, "name": "Rahul Sharma", "department": "Engineering", "status": "Active"},
    {"id": 2, "name": "Priya Patel", "department": "HR", "status": "Active"},
    {"id": 3, "name": "Amit Verma", "department": "Engineering", "status": "Inactive"},
]

ADMIN = {"username": "admin", "password": "admin123", "role": "admin"}
EMPLOYEE = {"username": "employee", "password": "employee123", "role": "employee"}


@pytest.fixture(autouse=True)
def reset_state():
    """Give every test a clean, predictable in-memory store."""
    main.employees.clear()
    main.employees.extend({**e} for e in SAMPLE_EMPLOYEES)
    main.next_id = 4
    main.TOKENS.clear()
    yield


def _client_for(credentials):
    client = TestClient(main.app)
    response = client.post("/auth/login", json=credentials)
    token = response.json()["token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def admin_client():
    return _client_for(ADMIN)


@pytest.fixture
def employee_client():
    return _client_for(EMPLOYEE)


@pytest.fixture
def anon_client():
    return TestClient(main.app)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
def test_login_success():
    client = TestClient(main.app)
    response = client.post("/auth/login", json=ADMIN)
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["username"] == "admin"
    assert body["token"]


def test_login_wrong_password():
    client = TestClient(main.app)
    response = client.post(
        "/auth/login", json={"username": "admin", "password": "nope", "role": "admin"}
    )
    assert response.status_code == 401


def test_login_wrong_role():
    client = TestClient(main.app)
    response = client.post(
        "/auth/login", json={"username": "employee", "password": "employee123", "role": "admin"}
    )
    assert response.status_code == 403


def test_me_returns_current_user(admin_client):
    response = admin_client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_logout_invalidates_token(admin_client):
    assert admin_client.post("/auth/logout").status_code == 204
    assert admin_client.get("/employees").status_code == 401


def test_endpoints_require_auth(anon_client):
    assert anon_client.get("/employees").status_code == 401
    assert anon_client.post("/employees", json={"name": "X", "department": "Y"}).status_code == 401


def test_employee_cannot_modify(employee_client):
    assert employee_client.post(
        "/employees", json={"name": "X", "department": "Y"}
    ).status_code == 403
    assert employee_client.patch(
        "/employees/1/status", json={"status": "Inactive"}
    ).status_code == 403
    assert employee_client.delete("/employees/1").status_code == 403


def test_employee_can_read(employee_client):
    assert employee_client.get("/employees").status_code == 200
    assert employee_client.get("/employees/1").status_code == 200


# ---------------------------------------------------------------------------
# Employee reads
# ---------------------------------------------------------------------------
def test_list_all_employees(admin_client):
    response = admin_client.get("/employees")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_filter_by_department(admin_client):
    response = admin_client.get("/employees", params={"department": "Engineering"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(e["department"] == "Engineering" for e in data)


def test_filter_is_case_insensitive(admin_client):
    response = admin_client.get("/employees", params={"department": "engineering"})
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_employee_by_id(admin_client):
    response = admin_client.get("/employees/2")
    assert response.status_code == 200
    assert response.json()["name"] == "Priya Patel"


def test_get_employee_not_found(admin_client):
    response = admin_client.get("/employees/999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Employee writes (admin)
# ---------------------------------------------------------------------------
def test_create_employee_generates_id_and_defaults_active(admin_client):
    response = admin_client.post(
        "/employees", json={"name": "Sneha Iyer", "department": "Design"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 4
    assert body["status"] == "Active"
    assert body["name"] == "Sneha Iyer"

    assert admin_client.get("/employees/4").status_code == 200
    assert len(admin_client.get("/employees").json()) == 4


def test_create_employee_rejects_empty_name(admin_client):
    response = admin_client.post(
        "/employees", json={"name": "   ", "department": "Design"}
    )
    assert response.status_code == 400
    assert "name" in response.json()["detail"].lower()


def test_create_employee_rejects_empty_department(admin_client):
    response = admin_client.post("/employees", json={"name": "John Doe", "department": ""})
    assert response.status_code == 400
    assert "department" in response.json()["detail"].lower()


def test_create_employee_rejects_invalid_status(admin_client):
    response = admin_client.post(
        "/employees",
        json={"name": "John Doe", "department": "Design", "status": "On Leave"},
    )
    assert response.status_code == 400
    assert "invalid status" in response.json()["detail"].lower()


def test_update_status(admin_client):
    response = admin_client.patch("/employees/1/status", json={"status": "Inactive"})
    assert response.status_code == 200
    assert response.json()["status"] == "Inactive"
    assert admin_client.get("/employees/1").json()["status"] == "Inactive"


def test_update_status_invalid_value(admin_client):
    response = admin_client.patch("/employees/1/status", json={"status": "Paused"})
    assert response.status_code == 400


def test_update_status_unknown_employee(admin_client):
    response = admin_client.patch("/employees/999/status", json={"status": "Active"})
    assert response.status_code == 404


def test_delete_employee(admin_client):
    response = admin_client.delete("/employees/2")
    assert response.status_code == 204
    assert admin_client.get("/employees/2").status_code == 404
    assert len(admin_client.get("/employees").json()) == 2


def test_delete_unknown_employee(admin_client):
    response = admin_client.delete("/employees/999")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
def test_frontend_is_served(anon_client):
    response = anon_client.get("/")
    assert response.status_code == 200
    assert "JTRONIX" in response.text
