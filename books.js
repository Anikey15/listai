const BOOK_DESCRIPTION_PLACEHOLDER = "Z".repeat(420);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapSvgText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);

  return lines
    .slice(0, 4)
    .map((line, index) => `<tspan x="40" dy="${index === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`)
    .join("");
}

function coverSvg(book) {
  const title = book.title;
  const genre = escapeXml((book.genres && book.genres[0]) || "");
  const hue = book.hue;
  const accent = (hue + 40) % 360;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 460" role="img" aria-label="Обложка: ${escapeXml(title)}">
      <defs>
        <linearGradient id="g${book.id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 42% 28%)"/>
          <stop offset="100%" stop-color="hsl(${accent} 38% 18%)"/>
        </linearGradient>
      </defs>
      <rect width="320" height="460" fill="url(#g${book.id})"/>
      <rect x="18" y="18" width="284" height="424" fill="none" stroke="hsla(40,40%,90%,0.35)" stroke-width="2"/>
      <circle cx="250" cy="90" r="46" fill="hsla(40,55%,72%,0.18)"/>
      <text x="40" y="210" fill="#f3efe6" font-family="Georgia, serif" font-size="26" font-weight="700">
        ${wrapSvgText(title, 18)}
      </text>
      <text x="40" y="400" fill="hsla(40,40%,90%,0.75)" font-family="Segoe UI, sans-serif" font-size="14">${genre}</text>
    </svg>
  `.trim();
}

function coverDataUrl(book) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coverSvg(book))}`;
}

function formatPrice(price) {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
}

function getAllGenres(books) {
  return [...new Set(books.flatMap((book) => book.genres || []))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
}
