/* =========================================================
   JTRONIX Employee Management Dashboard - Frontend logic
   Talks to the FastAPI backend with fetch().
   ========================================================= */

(() => {
  "use strict";

  const API = "/employees";

  // ------------------------------------------------------
  // Authentication guard
  // ------------------------------------------------------
  const session = Session.get();
  if (!session || !session.token) {
    window.location.replace("/");
    return;
  }

  const isAdmin = session.role === "admin";

  // ------------------------------------------------------
  // State
  // ------------------------------------------------------
  const state = {
    all: [],          // every employee (for summary cards + department list)
    visible: [],      // employees currently shown in the table
    search: "",
    department: "",
  };

  // ------------------------------------------------------
  // Element references
  // ------------------------------------------------------
  const el = {
    cardTotal: document.getElementById("cardTotal"),
    cardActive: document.getElementById("cardActive"),
    cardInactive: document.getElementById("cardInactive"),

    searchInput: document.getElementById("searchInput"),
    departmentFilter: document.getElementById("departmentFilter"),
    refreshBtn: document.getElementById("refreshBtn"),
    addEmployeeBtn: document.getElementById("addEmployeeBtn"),

    tableBody: document.getElementById("employeeTableBody"),
    loading: document.getElementById("loading"),
    emptyState: document.getElementById("emptyState"),
    emptyStateText: document.getElementById("emptyStateText"),
    resultCount: document.getElementById("resultCount"),
    employeesPanel: document.getElementById("employeesPanel"),

    sidebar: document.getElementById("sidebar"),
    sidebarBackdrop: document.getElementById("sidebarBackdrop"),
    menuToggle: document.getElementById("menuToggle"),

    modalOverlay: document.getElementById("modalOverlay"),
    modalClose: document.getElementById("modalClose"),
    modalCancel: document.getElementById("modalCancel"),
    modalSubmit: document.getElementById("modalSubmit"),
    employeeForm: document.getElementById("employeeForm"),
    nameInput: document.getElementById("nameInput"),
    departmentInput: document.getElementById("departmentInput"),
    statusInput: document.getElementById("statusInput"),
    departmentOptions: document.getElementById("departmentOptions"),
    nameError: document.getElementById("nameError"),
    departmentError: document.getElementById("departmentError"),

    toastStack: document.getElementById("toastStack"),

    actionsHeader: document.getElementById("actionsHeader"),
    userName: document.getElementById("userName"),
    userRole: document.getElementById("userRole"),
    userAvatar: document.getElementById("userAvatar"),
    signOutBtn: document.getElementById("signOutBtn"),
    brandSubtitle: document.getElementById("brandSubtitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
  };

  // ------------------------------------------------------
  // API helpers
  // ------------------------------------------------------
  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      Session.clear();
      window.location.replace("/");
      throw new Error("Your session expired. Please sign in again.");
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      let message = `Request failed (${response.status}).`;
      if (data && typeof data.detail === "string") {
        message = data.detail;
      } else if (data && Array.isArray(data.detail) && data.detail.length) {
        message = data.detail[0].msg || message;
      }
      throw new Error(message);
    }
    return data;
  }

  // ------------------------------------------------------
  // Data loading
  // ------------------------------------------------------
  async function loadAll() {
    state.all = await apiRequest(API);
    updateCards();
    populateDepartments();
  }

  async function loadTable() {
    const url = state.department
      ? `${API}?department=${encodeURIComponent(state.department)}`
      : API;

    setLoading(true);
    try {
      state.visible = await apiRequest(url);
      applySearchAndRender();
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      await Promise.all([loadAll(), loadTable()]);
    } catch (error) {
      showToast("error", "Could not load employees", error.message);
    }
  }

  // ------------------------------------------------------
  // Rendering
  // ------------------------------------------------------
  function updateCards() {
    const total = state.all.length;
    const active = state.all.filter((e) => e.status === "Active").length;
    const inactive = total - active;

    el.cardTotal.textContent = total;
    el.cardActive.textContent = active;
    el.cardInactive.textContent = inactive;
  }

  function populateDepartments() {
    const departments = [...new Set(state.all.map((e) => e.department))].sort(
      (a, b) => a.localeCompare(b)
    );

    const current = el.departmentFilter.value;

    el.departmentFilter.innerHTML =
      '<option value="">All Departments</option>' +
      departments
        .map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)
        .join("");

    // Keep the current selection if it still exists.
    if (current && departments.includes(current)) {
      el.departmentFilter.value = current;
    }

    el.departmentOptions.innerHTML = departments
      .map((d) => `<option value="${escapeHtml(d)}"></option>`)
      .join("");
  }

  function applySearchAndRender() {
    const query = state.search.trim().toLowerCase();

    const rows = state.visible.filter((employee) => {
      if (!query) return true;
      return (
        employee.name.toLowerCase().includes(query) ||
        String(employee.id).includes(query) ||
        employee.department.toLowerCase().includes(query)
      );
    });

    renderTable(rows);
  }

  function renderTable(rows) {
    el.tableBody.innerHTML = "";

    const hasFilters = state.search.trim() !== "" || state.department !== "";
    const total = state.visible.length;

    if (rows.length === 0) {
      el.emptyState.hidden = false;
      el.emptyStateText.textContent = hasFilters
        ? "Try adjusting your search or filters."
        : "Add your first employee to get started.";
      el.resultCount.textContent = "No employees to display";
      return;
    }

    el.emptyState.hidden = true;
    el.resultCount.textContent =
      rows.length === total
        ? `Showing ${total} employee${total === 1 ? "" : "s"}`
        : `Showing ${rows.length} of ${total} employees`;

    const fragment = document.createDocumentFragment();
    rows.forEach((employee) => fragment.appendChild(buildRow(employee)));
    el.tableBody.appendChild(fragment);
  }

  function buildRow(employee) {
    const tr = document.createElement("tr");

    const isActive = employee.status === "Active";
    const targetStatus = isActive ? "Inactive" : "Active";

    const actionsCell = isAdmin
      ? `
      <td>
        <div class="row-actions">
          <button class="toggle-btn" data-target="${targetStatus}" data-id="${employee.id}">
            Mark ${targetStatus}
          </button>
          <button class="delete-btn" data-id="${employee.id}" title="Delete employee" aria-label="Delete employee">
            <svg viewBox="0 0 24 24" class="icon"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>`
      : "";

    tr.innerHTML = `
      <td class="cell-id">#${employee.id}</td>
      <td>
        <div class="cell-name">
          <span class="name-avatar" style="background:${avatarColor(employee.name)}">
            ${initials(employee.name)}
          </span>
          <span>${escapeHtml(employee.name)}</span>
        </div>
      </td>
      <td><span class="dept-chip">${escapeHtml(employee.department)}</span></td>
      <td><span class="badge ${isActive ? "badge--active" : "badge--inactive"}">${escapeHtml(employee.status)}</span></td>
      ${actionsCell}
    `;

    if (isAdmin) {
      const toggleButton = tr.querySelector(".toggle-btn");
      toggleButton.addEventListener("click", () => toggleStatus(employee, toggleButton));

      const deleteButton = tr.querySelector(".delete-btn");
      deleteButton.addEventListener("click", () => deleteEmployee(employee, deleteButton));
    }

    return tr;
  }

  function setLoading(isLoading) {
    el.loading.hidden = !isLoading;
  }

  // ------------------------------------------------------
  // Actions
  // ------------------------------------------------------
  async function toggleStatus(employee, button) {
    const newStatus = employee.status === "Active" ? "Inactive" : "Active";
    button.disabled = true;
    button.textContent = "Updating…";

    try {
      await apiRequest(`${API}/${employee.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(
        "success",
        "Status updated",
        `${employee.name} is now ${newStatus}.`
      );
      await refresh();
    } catch (error) {
      showToast("error", "Update failed", error.message);
      button.disabled = false;
      button.textContent = `Mark ${newStatus}`;
    }
  }

  async function deleteEmployee(employee, button) {
    const confirmed = window.confirm(
      `Delete "${employee.name}" (#${employee.id})? This cannot be undone.`
    );
    if (!confirmed) return;

    button.disabled = true;
    try {
      await apiRequest(`${API}/${employee.id}`, { method: "DELETE" });
      showToast("success", "Employee deleted", `${employee.name} was removed.`);
      await refresh();
    } catch (error) {
      showToast("error", "Delete failed", error.message);
      button.disabled = false;
    }
  }

  async function submitEmployee(event) {
    event.preventDefault();

    const name = el.nameInput.value.trim();
    const department = el.departmentInput.value.trim();
    const status = el.statusInput.value;

    clearFieldErrors();

    let valid = true;
    if (!name) {
      setFieldError(el.nameInput, el.nameError, "Name cannot be empty.");
      valid = false;
    }
    if (!department) {
      setFieldError(el.departmentInput, el.departmentError, "Department cannot be empty.");
      valid = false;
    }
    if (!valid) return;

    setSubmitLoading(true);
    try {
      const created = await apiRequest(API, {
        method: "POST",
        body: JSON.stringify({ name, department, status }),
      });
      closeModal();
      showToast("success", "Employee added", `${created.name} was added successfully.`);
      await refresh();
    } catch (error) {
      showToast("error", "Could not add employee", error.message);
    } finally {
      setSubmitLoading(false);
    }
  }

  // ------------------------------------------------------
  // Modal
  // ------------------------------------------------------
  function openModal() {
    clearFieldErrors();
    el.employeeForm.reset();
    el.statusInput.value = "Active";
    el.modalOverlay.hidden = false;
    setTimeout(() => el.nameInput.focus(), 30);
  }

  function closeModal() {
    el.modalOverlay.hidden = true;
  }

  function setSubmitLoading(isLoading) {
    el.modalSubmit.disabled = isLoading;
    el.modalSubmit.querySelector(".btn-label").textContent = isLoading
      ? "Adding…"
      : "Add Employee";
  }

  function setFieldError(input, errorEl, message) {
    input.classList.add("is-invalid");
    errorEl.textContent = message;
  }

  function clearFieldErrors() {
    el.nameInput.classList.remove("is-invalid");
    el.departmentInput.classList.remove("is-invalid");
    el.nameError.textContent = "";
    el.departmentError.textContent = "";
  }

  // ------------------------------------------------------
  // Toasts
  // ------------------------------------------------------
  const TOAST_ICONS = {
    success:
      '<svg viewBox="0 0 24 24" class="icon toast__icon"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" class="icon toast__icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    info: '<svg viewBox="0 0 24 24" class="icon toast__icon"><path d="M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
  };

  function showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      ${TOAST_ICONS[type] || TOAST_ICONS.info}
      <div class="toast__body">
        <p class="toast__title">${escapeHtml(title)}</p>
        ${message ? `<p class="toast__msg">${escapeHtml(message)}</p>` : ""}
      </div>
    `;

    el.toastStack.appendChild(toast);

    const remove = () => {
      toast.classList.add("is-hiding");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    };

    setTimeout(remove, 3600);
    toast.addEventListener("click", remove);
  }

  // ------------------------------------------------------
  // Utilities
  // ------------------------------------------------------
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function avatarColor(name) {
    const palette = [
      "linear-gradient(135deg,#6366f1,#4f46e5)",
      "linear-gradient(135deg,#0ea5e9,#0284c7)",
      "linear-gradient(135deg,#10b981,#059669)",
      "linear-gradient(135deg,#f59e0b,#d97706)",
      "linear-gradient(135deg,#ec4899,#db2777)",
      "linear-gradient(135deg,#8b5cf6,#7c3aed)",
    ];
    return palette[hashString(name) % palette.length];
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function closeSidebar() {
    el.sidebar.classList.remove("is-open");
    el.sidebarBackdrop.classList.remove("is-open");
  }

  // ------------------------------------------------------
  // UI personalization
  // ------------------------------------------------------
  function applyRoleUI() {
    if (isAdmin) return;

    el.addEmployeeBtn.hidden = true;
    el.actionsHeader.hidden = true;
    el.brandSubtitle.textContent = "Employee Portal";
    el.pageSubtitle.textContent = "View your team directory";
  }

  function applyUserInfo() {
    el.userName.textContent = session.full_name || session.username;
    el.userRole.textContent = isAdmin ? "Administrator" : "Employee";
    el.userAvatar.textContent = (session.username || "?").charAt(0).toUpperCase();
  }

  async function signOut() {
    el.signOutBtn.disabled = true;
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch (_) {
      /* Ignore network errors on logout. */
    }
    Session.clear();
    window.location.replace("/");
  }

  // ------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------
  el.searchInput.addEventListener(
    "input",
    debounce((event) => {
      state.search = event.target.value;
      applySearchAndRender();
    }, 220)
  );

  el.departmentFilter.addEventListener("change", async (event) => {
    state.department = event.target.value;
    try {
      await loadTable();
    } catch (error) {
      showToast("error", "Filter failed", error.message);
    }
  });

  el.refreshBtn.addEventListener("click", refresh);
  el.addEmployeeBtn.addEventListener("click", openModal);

  el.modalClose.addEventListener("click", closeModal);
  el.modalCancel.addEventListener("click", closeModal);
  el.employeeForm.addEventListener("submit", submitEmployee);

  el.modalOverlay.addEventListener("click", (event) => {
    if (event.target === el.modalOverlay) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.modalOverlay.hidden) closeModal();
  });

  // Mobile sidebar
  el.menuToggle.addEventListener("click", () => {
    el.sidebar.classList.add("is-open");
    el.sidebarBackdrop.classList.add("is-open");
  });

  el.sidebarBackdrop.addEventListener("click", closeSidebar);

  el.signOutBtn.addEventListener("click", signOut);

  // Sidebar navigation
  const navItems = document.querySelectorAll(".nav-item[data-nav]");
  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      navItems.forEach((nav) => nav.classList.remove("is-active"));
      item.classList.add("is-active");

      const target = item.dataset.nav;
      if (target === "dashboard") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        refresh();
      } else if (target === "employees" || target === "directory") {
        el.employeesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (target === "reports") {
        showToast("info", "Reports", "Reporting is not part of this assessment build.");
      }

      closeSidebar();
    });
  });

  // ------------------------------------------------------
  // Init
  // ------------------------------------------------------
  applyUserInfo();
  applyRoleUI();
  refresh();
})();
