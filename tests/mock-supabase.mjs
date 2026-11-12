// Servidor local de integração. Nunca usar como backend ou credencial de produção.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
const origin = "http://127.0.0.1:54321";
const user = {
  id: "10000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "admin@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-11-12T00:00:00Z",
};
const token = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    }),
  ).toString("base64url"),
  "signature",
].join(".");
const settings = {
  id: 1,
  store_name: "BS Suplementos",
  tagline: "Performance e saúde em Baturité.",
  whatsapp: "5585991665030",
  instagram: "bio.suplementos",
  address: "Baturité/CE",
  logo_url: "/brand/logo-card.jpg",
  hero_image_url: "/brand/card-front.jpg",
  primary_color: "#07883d",
  accent_color: "#c32222",
};
const category = {
  id: "cat-1",
  name: "Suplementos",
  slug: "suplementos",
  description: "Suplementos",
  image_url: null,
  sort_order: 0,
  active: true,
};
const product = {
  id: "p-1",
  category_id: category.id,
  product_type_id: null,
  brand_id: null,
  name: "Whey Protein",
  brand: "BS",
  description: "Proteína para seu treino",
  price: 100,
  promotional_price: 80,
  image_url: `${origin}/storage/v1/object/public/catalog/products/test.jpg`,
  flavors: ["Chocolate", "Morango"],
  active: true,
  featured: true,
  stock_status: "available",
  sort_order: 0,
};
let tables;
let requests;
let uploads;
let failCatalog;
function reset() {
  tables = {
    store_settings: [structuredClone(settings)],
    categories: [structuredClone(category)],
    products: [structuredClone(product)],
    product_types: [],
    brands: [],
    profiles: [{ id: user.id, role: "admin" }],
  };
  requests = {};
  uploads = [];
  failCatalog = false;
}
reset();
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  const url = new URL(req.url, origin);
  const json = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const body = async () => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  };
  if (url.pathname === "/__reset") {
    reset();
    json({ ok: true });
    return;
  }
  if (url.pathname === "/__stats") {
    json({ requests, uploads });
    return;
  }
  if (url.pathname === "/__product") {
    Object.assign(tables.products[0], JSON.parse((await body()).toString()));
    json({ ok: true });
    return;
  }
  if (url.pathname === "/__failure") {
    failCatalog = url.searchParams.get("enabled") === "true";
    json({ ok: true });
    return;
  }
  requests[url.pathname] = (requests[url.pathname] || 0) + 1;
  if (url.pathname === "/auth/v1/token") {
    json({
      access_token: token,
      refresh_token: "test-refresh",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user,
    });
    return;
  }
  if (url.pathname === "/auth/v1/user") {
    json(user);
    return;
  }
  if (url.pathname === "/auth/v1/logout") {
    json({});
    return;
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    if (failCatalog) {
      json({ message: "offline" }, 503);
      return;
    }
    const name = url.pathname.split("/").at(-1);
    const table = tables[name];
    if (!table) {
      json({ message: "not found" }, 404);
      return;
    }
    let rows = table.filter((row) =>
      [...url.searchParams].every(
        ([key, value]) =>
          !value.startsWith("eq.") || String(row[key]) === value.slice(3),
      ),
    );
    if (["POST", "PATCH"].includes(req.method)) {
      const values = JSON.parse((await body()).toString());
      if (req.method === "POST") {
        const newRow = { id: randomUUID(), ...values };
        table.push(newRow);
        rows = [newRow];
      } else rows.forEach((row) => Object.assign(row, values));
    }
    if (req.method === "DELETE")
      tables[name] = table.filter((row) => !rows.includes(row));
    if (req.headers.accept?.includes("object+json")) json(rows[0] || null);
    else json(rows);
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/public/catalog/")) {
    const bytes = await readFile("tests/fixtures/product.jpg");
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": bytes.length,
    });
    res.end(bytes);
    return;
  }
  if (
    url.pathname.startsWith("/storage/v1/object/catalog/") &&
    req.method === "POST"
  ) {
    const bytes = await body();
    const multipart = await new Request(origin, {
      method: "POST",
      headers: { "content-type": req.headers["content-type"] },
      body: bytes,
    }).formData();
    const file = [...multipart.values()].find((value) => value instanceof Blob);
    const image = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(image).metadata();
    uploads.push({
      path: url.pathname,
      bytes: image.length,
      contentType: file.type,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      exif: Boolean(metadata.exif),
      matchesHash: url.pathname.endsWith(
        createHash("sha256").update(image).digest("hex") + ".webp",
      ),
    });
    json({ Key: url.pathname, Id: randomUUID() });
    return;
  }
  json({ error: "not found", path: url.pathname }, 404);
});
server.listen(54321, "127.0.0.1", () =>
  console.log("Supabase de teste em 54321"),
);
