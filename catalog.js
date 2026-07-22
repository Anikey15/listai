const grid = document.getElementById("books-grid");
const emptyState = document.getElementById("catalog-empty");
const meta = document.getElementById("catalog-meta");
const searchInput = document.getElementById("search-input");
const genreSelect = document.getElementById("filter-genre");
const priceMinInput = document.getElementById("price-min");
const priceMaxInput = document.getElementById("price-max");
const filtersPanel = document.getElementById("filters-panel");
const filtersToggle = document.getElementById("filters-toggle");
const filtersApply = document.getElementById("filters-apply");

let catalogBooks = [];

function getSelectedConditions() {
  return [...filtersPanel.querySelectorAll('input[name="condition"]:checked')].map(
    (input) => input.value
  );
}

function getFilters() {
  const minRaw = priceMinInput.value.trim();
  const maxRaw = priceMaxInput.value.trim();

  return {
    query: searchInput.value.trim().toLowerCase(),
    genre: genreSelect.value,
    conditions: getSelectedConditions(),
    priceMin: minRaw === "" ? null : Number(minRaw),
    priceMax: maxRaw === "" ? null : Number(maxRaw)
  };
}

function filterBooks(books, filters) {
  return books.filter((book) => {
    if (filters.query) {
      const inTitle = book.title.toLowerCase().includes(filters.query);
      const inAuthor = book.author.toLowerCase().includes(filters.query);
      if (!inTitle && !inAuthor) return false;
    }

    if (filters.genre && !book.genres.includes(filters.genre)) {
      return false;
    }

    if (filters.conditions.length && !filters.conditions.includes(book.condition)) {
      return false;
    }

    if (filters.priceMin !== null && !Number.isNaN(filters.priceMin) && book.price < filters.priceMin) {
      return false;
    }

    if (filters.priceMax !== null && !Number.isNaN(filters.priceMax) && book.price > filters.priceMax) {
      return false;
    }

    return true;
  });
}

function renderBooks(books) {
  const adminView = isAdmin();

  grid.innerHTML = books
    .map((book) => {
      const unpublishedBadge =
        adminView && !book.published
          ? `<span class="book-card__badge">Снята</span>`
          : "";

      return `
      <a class="book-card ${book.published ? "" : "book-card--unpublished"}" href="book.html?id=${book.id}">
        <div class="book-card__cover">
          ${unpublishedBadge}
          <img
            src="${coverDataUrl(book)}"
            alt="Обложка книги «${escapeXml(book.title)}»"
            width="320"
            height="460"
            loading="lazy"
          >
        </div>
        <div class="book-card__body">
          <h2 class="book-card__title">${escapeXml(book.title)}</h2>
          <p class="book-card__author">${escapeXml(book.author)}</p>
          <p class="book-card__price">${formatPrice(book.price)}</p>
        </div>
      </a>
    `;
    })
    .join("");

  const count = books.length;
  meta.textContent = count ? `Найдено: ${count}` : "Найдено: 0";
  emptyState.hidden = count > 0;
}

function applyFilters() {
  renderBooks(filterBooks(catalogBooks, getFilters()));
}

function fillGenres(books) {
  genreSelect.querySelectorAll("option:not([value=''])").forEach((el) => el.remove());
  getAllGenres(books).forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    genreSelect.append(option);
  });
}

filtersToggle.addEventListener("click", () => {
  const willOpen = filtersPanel.hasAttribute("hidden");
  filtersPanel.toggleAttribute("hidden", !willOpen);
  filtersToggle.setAttribute("aria-expanded", String(willOpen));
});

filtersApply.addEventListener("click", applyFilters);

filtersPanel.addEventListener("reset", () => {
  window.setTimeout(applyFilters, 0);
});

searchInput.addEventListener("input", applyFilters);

(async function initCatalog() {
  meta.textContent = "Загрузка…";
  try {
    await refreshAuth();
    await renderAuthNav();
    catalogBooks = await fetchBooks();
    fillGenres(catalogBooks);
    applyFilters();
  } catch (error) {
    meta.textContent = "Не удалось загрузить каталог. Запустите сервер: npm start";
    emptyState.hidden = false;
    emptyState.textContent =
      error.message || "Сервер недоступен. Откройте сайт через http://localhost:3000";
  }
})();
