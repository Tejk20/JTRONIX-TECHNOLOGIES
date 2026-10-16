/* =========================================================
   JTRONIX - login page logic (shared by admin + employee)
   The page's role is read from <body data-role="...">.
   ========================================================= */

(() => {
  "use strict";

  const role = document.body.dataset.role || "employee";
  const roleLabel = role === "admin" ? "Admin" : "Employee";

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("passwordToggle");
  const errorBox = document.getElementById("authError");
  const loginBtn = document.getElementById("loginBtn");
  const btnLabel = loginBtn.querySelector(".btn-label");

  // If already signed in as this role, go straight to the dashboard.
  const existing = Session.get();
  if (existing && existing.role === role) {
    window.location.replace("/dashboard/");
    return;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    btnLabel.textContent = isLoading ? "Signing in…" : "Sign In";
  }

  passwordToggle.addEventListener("click", () => {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    passwordToggle.textContent = show ? "Hide" : "Show";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((data && data.detail) || `Sign in failed (${response.status}).`);
      }

      Session.save(data);
      window.location.replace("/dashboard/");
    } catch (error) {
      showError(error.message);
      setLoading(false);
    }
  });

  usernameInput.focus();
})();
