require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const store = require("./store");

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const ADMIN_RIGHTS = ["unpublish_book", "publish_book", "view_unpublished"];

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("Ошибка: задайте длинный SESSION_SECRET в файле .env");
  process.exit(1);
}

if (!ADMIN_PASSWORD_HASH) {
  console.error("Ошибка: задайте ADMIN_PASSWORD_HASH в файле .env");
  console.error('Сгенерировать: npm run hash-password -- "ваш_пароль"');
  process.exit(1);
}

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "connect-src": ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: "32kb" }));

app.use(
  session({
    name: "listai.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток входа. Попробуйте позже." }
});

function getSessionUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function isAdmin(req) {
  const user = getSessionUser(req);
  return Boolean(user && user.role === "admin");
}

function hasRight(req, right) {
  const user = getSessionUser(req);
  return Boolean(user && Array.isArray(user.rights) && user.rights.includes(right));
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: "Требуется вход администратора." });
  }
  return next();
}

function requireRight(right) {
  return (req, res, next) => {
    if (!hasRight(req, right)) {
      return res.status(403).json({ error: "Недостаточно прав." });
    }
    return next();
  };
}

function sameOriginGuard(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const origin = req.get("origin");
  const host = req.get("host");

  if (!origin) {
    // Запросы без Origin (например, некоторые прямые API-клиенты) отклоняем для мутаций.
    return res.status(403).json({ error: "Запрос отклонён: отсутствует Origin." });
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return res.status(403).json({ error: "Запрос отклонён: чужой Origin." });
    }
  } catch {
    return res.status(403).json({ error: "Запрос отклонён: некорректный Origin." });
  }

  return next();
}

app.use("/api", sameOriginGuard);

app.get("/api/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    login: user.login,
    role: user.role,
    rights: user.rights
  });
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const login = String(req.body?.login || "").trim();
  const password = String(req.body?.password || "");

  // Одинаковый ответ при любой ошибке — сложнее перебирать логин отдельно от пароля.
  const fail = () => res.status(401).json({ error: "Неверный логин или пароль." });

  if (!login || !password) return fail();
  if (login !== ADMIN_LOGIN) {
    await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    return fail();
  }

  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) return fail();

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: "Не удалось создать сессию." });
    }

    req.session.user = {
      login: ADMIN_LOGIN,
      role: "admin",
      rights: [...ADMIN_RIGHTS]
    };

    return res.json({
      authenticated: true,
      login: ADMIN_LOGIN,
      role: "admin",
      rights: [...ADMIN_RIGHTS]
    });
  });
});

app.post("/api/auth/logout", requireAdmin, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Не удалось выйти." });
    }
    res.clearCookie("listai.sid");
    return res.json({ ok: true });
  });
});

app.get("/api/books", (req, res) => {
  const books = store.listBooksForViewer({ isAdmin: isAdmin(req) });
  return res.json({ books });
});

app.get("/api/books/:id", (req, res) => {
  const book = store.getBookById(req.params.id);
  if (!book) {
    return res.status(404).json({ error: "Книга не найдена." });
  }

  const published = store.isPublished(book.id);
  if (!published && !isAdmin(req)) {
    return res.status(404).json({ error: "Книга не найдена." });
  }

  return res.json({
    book: {
      ...book,
      published
    }
  });
});

app.post(
  "/api/books/:id/unpublish",
  requireAdmin,
  requireRight("unpublish_book"),
  (req, res) => {
    const book = store.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Книга не найдена." });
    }
    store.setPublished(book.id, false);
    return res.json({ ok: true, id: book.id, published: false });
  }
);

app.post(
  "/api/books/:id/publish",
  requireAdmin,
  requireRight("publish_book"),
  (req, res) => {
    const book = store.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Книга не найдена." });
    }
    store.setPublished(book.id, true);
    return res.json({ ok: true, id: book.id, published: true });
  }
);

const publicDir = path.join(__dirname, "..");

app.use((req, res, next) => {
  const blocked = [
    /^\/server(?:\/|$)/i,
    /^\/node_modules(?:\/|$)/i,
    /^\/data(?:\/|$)/i,
    /^\/scripts(?:\/|$)/i,
    /^\/\.env/i,
    /^\/package(?:-lock)?\.json$/i,
    /^\/\.gitignore$/i
  ];

  if (blocked.some((pattern) => pattern.test(req.path))) {
    return res.status(404).send("Не найдено");
  }
  return next();
});

app.use(
  express.static(publicDir, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  })
);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Не найдено." });
  }
  return res.status(404).send("Страница не найдена");
});

app.listen(PORT, () => {
  console.log(`Листай запущен: http://localhost:${PORT}`);
  console.log("Открывайте сайт только через этот адрес (не через file://).");
});
