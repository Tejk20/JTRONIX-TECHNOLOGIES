/* =========================================================
   JTRONIX - session helper
   Stores the signed-in user (token + role) in localStorage.
   Shared by the login pages and the dashboard.
   ========================================================= */

const Session = (() => {
  "use strict";

  const KEY = "jtronix.session";

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function token() {
    const session = get();
    return session ? session.token : null;
  }

  function isAdmin() {
    const session = get();
    return !!session && session.role === "admin";
  }

  return { get, save, clear, token, isAdmin };
})();
