const fs = require("fs");
const path = require("path");

const BOOKS_PATH = path.join(__dirname, "..", "data", "books.json");
const UNPUBLISHED_PATH = path.join(__dirname, "..", "data", "unpublished.json");

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getBooks() {
  const books = readJson(BOOKS_PATH, []);
  if (!Array.isArray(books)) return [];
  return books;
}

function getUnpublishedIds() {
  const ids = readJson(UNPUBLISHED_PATH, []);
  if (!Array.isArray(ids)) return [];
  return ids.map(Number).filter((id) => !Number.isNaN(id));
}

function saveUnpublishedIds(ids) {
  writeJson(UNPUBLISHED_PATH, [...new Set(ids.map(Number))]);
}

function isPublished(bookId) {
  return !getUnpublishedIds().includes(Number(bookId));
}

function setPublished(bookId, published) {
  const id = Number(bookId);
  const current = getUnpublishedIds();
  if (published) {
    saveUnpublishedIds(current.filter((item) => item !== id));
  } else {
    saveUnpublishedIds([...current, id]);
  }
}

function getBookById(id) {
  return getBooks().find((book) => book.id === Number(id)) || null;
}

function listBooksForViewer({ isAdmin }) {
  const unpublished = new Set(getUnpublishedIds());
  return getBooks()
    .map((book) => ({
      ...book,
      published: !unpublished.has(book.id)
    }))
    .filter((book) => (isAdmin ? true : book.published));
}

module.exports = {
  getBooks,
  getBookById,
  isPublished,
  setPublished,
  listBooksForViewer
};
