
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function findJsonFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      return findJsonFiles(fullPath, base);
    }

    if (item.isFile() && item.name.endsWith(".json")) {
      return [path.relative(base, fullPath).split(path.sep).join("/")];
    }

    return [];
  });
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/files") {
    return send(res, 200, JSON.stringify(findJsonFiles(DATA_DIR)));
  }

  if (url.pathname === "/api/questions") {
    const file = url.searchParams.get("file");

    if (!file || path.isAbsolute(file) || file.includes("\\")) {
      return send(res, 400, JSON.stringify({ error: "Invalid file path" }));
    }

    const target = path.resolve(DATA_DIR, file);
    const relative = path.relative(DATA_DIR, target);

    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      path.extname(target) !== ".json"
    ) {
      return send(res, 403, JSON.stringify({ error: "Access denied" }));
    }

    try {
      const questions = JSON.parse(fs.readFileSync(target, "utf8"));

      if (!Array.isArray(questions)) {
        return send(res, 400, JSON.stringify({ error: "Invalid question file" }));
      }

      return send(res, 200, JSON.stringify(questions));
    } catch {
      return send(res, 500, JSON.stringify({ error: "Could not read this JSON file" }));
    }
  }

  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, "Invalid URL", "text/plain; charset=utf-8");
  }

  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = path.resolve(PUBLIC_DIR, requested);
  const relative = path.relative(PUBLIC_DIR, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return send(res, 403, "Access denied", "text/plain; charset=utf-8");
  }

  fs.readFile(target, (err, content) => {
    if (err) {
      return send(res, 404, "File not found", "text/plain; charset=utf-8");
    }

    send(
      res,
      200,
      content,
      mimeTypes[path.extname(target)] || "application/octet-stream"
    );
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Question Bank running on port ${PORT}`);
});
