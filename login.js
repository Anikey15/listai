const form = document.getElementById("login-form");
const loginInput = document.getElementById("login-input");
const passwordInput = document.getElementById("password-input");
const errorEl = document.getElementById("login-error");

(async function initLogin() {
  try {
    await refreshAuth();
    await renderAuthNav();
    if (isAdmin()) {
      window.location.replace("admin.html");
    }
  } catch {
    errorEl.textContent = "Сервер недоступен. Запустите: npm start и откройте http://localhost:3000";
    errorEl.hidden = false;
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  errorEl.textContent = "";

  const result = await loginAdmin(loginInput.value, passwordInput.value);

  if (!result.ok) {
    errorEl.textContent = result.error;
    errorEl.hidden = false;
    return;
  }

  window.location.href = "admin.html";
});
