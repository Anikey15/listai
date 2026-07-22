let authState = {
  loaded: false,
  authenticated: false,
  login: null,
  role: null,
  rights: []
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: "Некорректный ответ сервера." };
    }
  }

  if (!response.ok) {
    const error = new Error((data && data.error) || "Ошибка запроса.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function refreshAuth() {
  const data = await api("/api/auth/me");
  authState = {
    loaded: true,
    authenticated: Boolean(data.authenticated),
    login: data.login || null,
    role: data.role || null,
    rights: Array.isArray(data.rights) ? data.rights : []
  };
  return authState;
}

function isAdmin() {
  return authState.authenticated && authState.role === "admin";
}

function getAdminSession() {
  return isAdmin()
    ? {
        login: authState.login,
        role: authState.role,
        rights: authState.rights
      }
    : null;
}

async function loginAdmin(login, password) {
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password })
    });
    authState = {
      loaded: true,
      authenticated: true,
      login: data.login,
      role: data.role,
      rights: data.rights || []
    };
    return { ok: true, session: getAdminSession() };
  } catch (error) {
    return { ok: false, error: error.message || "Неверный логин или пароль." };
  }
}

async function logoutAdmin() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Даже при ошибке сети локально сбрасываем UI-состояние.
  }
  authState = {
    loaded: true,
    authenticated: false,
    login: null,
    role: null,
    rights: []
  };
}

async function fetchBooks() {
  const data = await api("/api/books");
  return data.books || [];
}

async function fetchBook(id) {
  const data = await api(`/api/books/${encodeURIComponent(id)}`);
  return data.book;
}

async function unpublishBook(id) {
  try {
    await api(`/api/books/${encodeURIComponent(id)}/unpublish`, { method: "POST" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Не удалось снять публикацию." };
  }
}

async function publishBook(id) {
  try {
    await api(`/api/books/${encodeURIComponent(id)}/publish`, { method: "POST" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Не удалось опубликовать." };
  }
}

async function renderAuthNav() {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  if (!authState.loaded) {
    try {
      await refreshAuth();
    } catch {
      authState.loaded = true;
      authState.authenticated = false;
    }
  }

  nav.querySelectorAll("[data-auth-nav]").forEach((el) => el.remove());

  if (isAdmin()) {
    const adminLink = document.createElement("a");
    adminLink.href = "admin.html";
    adminLink.textContent = "Админ";
    adminLink.dataset.authNav = "true";
    if (location.pathname.endsWith("/admin.html") || location.pathname.endsWith("/admin")) {
      adminLink.setAttribute("aria-current", "page");
    }

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "nav-logout";
    logoutBtn.textContent = "Выйти";
    logoutBtn.dataset.authNav = "true";
    logoutBtn.addEventListener("click", async () => {
      await logoutAdmin();
      window.location.href = "index.html";
    });

    nav.append(adminLink, logoutBtn);
    return;
  }

  const loginLink = document.createElement("a");
  loginLink.href = "login.html";
  loginLink.textContent = "Вход";
  loginLink.dataset.authNav = "true";
  if (location.pathname.endsWith("/login.html") || location.pathname.endsWith("/login")) {
    loginLink.setAttribute("aria-current", "page");
  }
  nav.append(loginLink);
}

document.addEventListener("DOMContentLoaded", () => {
  renderAuthNav();
});
