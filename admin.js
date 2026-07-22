const sessionBox = document.getElementById("admin-session");
const tableBody = document.getElementById("admin-books-body");

async function ensureAdmin() {
  await refreshAuth();
  await renderAuthNav();
  if (!isAdmin()) {
    window.location.replace("login.html");
    return false;
  }
  return true;
}

function renderAdminTable(books) {
  const rows = books
    .map((book) => {
      const published = Boolean(book.published);
      const statusClass = published ? "is-published" : "is-unpublished";
      const statusText = published ? "Опубликована" : "Снята с публикации";
      const actionLabel = published ? "Снять с публикации" : "Опубликовать снова";
      const actionClass = published ? "btn btn--danger" : "btn btn--primary";

      return `
      <tr data-book-id="${book.id}">
        <td>
          <a class="admin-book-link" href="book.html?id=${book.id}">${escapeXml(book.title)}</a>
        </td>
        <td>${escapeXml(book.author)}</td>
        <td><span class="admin-status ${statusClass}">${statusText}</span></td>
        <td>
          <button
            type="button"
            class="${actionClass} admin-action"
            data-action="${published ? "unpublish" : "publish"}"
            data-id="${book.id}"
          >
            ${actionLabel}
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  tableBody.innerHTML = rows;
}

async function reloadTable() {
  const books = await fetchBooks();
  renderAdminTable(books);
}

tableBody.addEventListener("click", async (event) => {
  const button = event.target.closest(".admin-action");
  if (!button) return;

  button.disabled = true;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const result = action === "unpublish" ? await unpublishBook(id) : await publishBook(id);

  if (!result.ok) {
    window.alert(result.error);
    button.disabled = false;
    return;
  }

  await reloadTable();
});

(async function initAdmin() {
  try {
    const ok = await ensureAdmin();
    if (!ok) return;

    const session = getAdminSession();
    sessionBox.innerHTML = `
      <p><strong>${escapeXml(session.login)}</strong></p>
      <p class="admin-session__rights">Права проверяются на сервере</p>
    `;

    await reloadTable();
  } catch (error) {
    sessionBox.innerHTML = `<p>${escapeXml(error.message || "Ошибка загрузки")}</p>`;
  }
})();
