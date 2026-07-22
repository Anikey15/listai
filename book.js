const bookPage = document.getElementById("book-page");
const params = new URLSearchParams(window.location.search);
const bookId = params.get("id");

function renderMissing(message) {
  document.title = "Книга не найдена — Листай";
  bookPage.innerHTML = `
    <section class="book-missing">
      <p>${escapeXml(message)}</p>
      <a class="btn btn--primary" href="catalog.html">Вернуться в каталог</a>
    </section>
  `;
}

function renderAdminControls(book) {
  if (!isAdmin()) return "";

  const published = Boolean(book.published);
  const action = published ? "unpublish" : "publish";
  const label = published ? "Снять с публикации" : "Опубликовать снова";
  const btnClass = published ? "btn btn--danger" : "btn btn--primary";
  const status = published
    ? `<span class="admin-status is-published">Опубликована</span>`
    : `<span class="admin-status is-unpublished">Снята с публикации</span>`;

  return `
    <section class="book-admin-panel" aria-label="Действия администратора">
      <div class="gold-rule" aria-hidden="true"></div>
      <p class="book-admin-panel__title">Панель администратора</p>
      <p class="book-admin-panel__status">Статус: ${status}</p>
      <div class="book-detail__actions">
        <button type="button" class="${btnClass}" id="admin-publish-toggle" data-action="${action}">
          ${label}
        </button>
        <a class="btn btn--outline" href="admin.html">Все публикации</a>
      </div>
    </section>
  `;
}

function renderBook(book) {
  document.title = `${book.title} — Листай`;

  const genres = book.genres
    .map((genre) => `<span class="book-detail__tag">${escapeXml(genre)}</span>`)
    .join("");

  bookPage.innerHTML = `
    <nav class="book-breadcrumb" aria-label="Навигация по разделам">
      <a href="catalog.html">Каталог</a>
      <span class="book-breadcrumb__sep" aria-hidden="true">/</span>
      <span>${escapeXml(book.title)}</span>
    </nav>

    <article class="book-detail">
      <div class="book-detail__frame">
        <div class="book-detail__layout">
          <div class="book-detail__cover">
            <img
              src="${coverDataUrl(book)}"
              alt="Обложка книги «${escapeXml(book.title)}»"
              width="320"
              height="460"
            >
          </div>

          <div class="book-detail__info">
            <p class="book-detail__eyebrow">Карточка издания</p>
            <h1 class="book-detail__title">${escapeXml(book.title)}</h1>
            <p class="book-detail__author">Автор: ${escapeXml(book.author)}</p>

            <div class="gold-rule" aria-hidden="true"></div>

            <dl class="book-detail__facts">
              <div class="book-detail__fact">
                <dt>Жанр</dt>
                <dd class="book-detail__tags">${genres}</dd>
              </div>
              <div class="book-detail__fact">
                <dt>Состояние</dt>
                <dd>${escapeXml(book.condition)}</dd>
              </div>
              <div class="book-detail__fact">
                <dt>Цена</dt>
                <dd class="book-detail__price">${formatPrice(book.price)}</dd>
              </div>
            </dl>

            <div class="gold-rule" aria-hidden="true"></div>

            <section class="book-detail__description" aria-labelledby="desc-title">
              <h2 id="desc-title">Описание</h2>
              <p class="book-detail__placeholder">${BOOK_DESCRIPTION_PLACEHOLDER}</p>
            </section>

            <div class="book-detail__actions">
              <a class="btn btn--outline" href="catalog.html">Назад в каталог</a>
            </div>

            ${renderAdminControls(book)}
          </div>
        </div>
      </div>
    </article>
  `;

  const toggle = document.getElementById("admin-publish-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", async () => {
    const action = toggle.dataset.action;
    const result = action === "unpublish" ? await unpublishBook(book.id) : await publishBook(book.id);

    if (!result.ok) {
      window.alert(result.error);
      return;
    }

    book.published = action !== "unpublish";
    renderBook(book);
  });
}

(async function initBookPage() {
  try {
    await refreshAuth();
    await renderAuthNav();

    if (!bookId) {
      renderMissing("Книга не найдена.");
      return;
    }

    const book = await fetchBook(bookId);
    renderBook(book);
  } catch (error) {
    if (error.status === 404) {
      renderMissing("Книга не найдена или снята с публикации.");
      return;
    }
    renderMissing("Не удалось загрузить книгу. Запустите сервер: npm start");
  }
})();
