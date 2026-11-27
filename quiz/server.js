// Servidor local do quiz da Fanny Viana.
// Sem dependências: só Node 20+.
// Rodar:  node --env-file=.env server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4321);
const USUARIO = process.env.ADMIN_USUARIO || "fanny";
const SENHA = process.env.ADMIN_SENHA;
if (!SENHA) { console.error("Defina ADMIN_SENHA no arquivo .env"); process.exit(1); }

const RAIZ = __dirname;
const PUBLICO = path.join(RAIZ, "public");
const DADOS = path.join(RAIZ, "data");
const ARQ_LEADS = path.join(DADOS, "leads.json");
fs.mkdirSync(DADOS, { recursive: true });

/* ---------- armazenamento ---------- */
function lerLeads() {
  try { return JSON.parse(fs.readFileSync(ARQ_LEADS, "utf8")); } catch { return []; }
}
function salvarLeads(leads) {
  const tmp = ARQ_LEADS + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(leads, null, 2));
  fs.renameSync(tmp, ARQ_LEADS); // escrita atômica
}

/* ---------- sessões ---------- */
const sessoes = new Map(); // token -> expira (ms)
const DURACAO = 1000 * 60 * 60 * 12; // 12h
const tentativas = new Map(); // ip -> {n, ate}

function token(req) {
  const m = /(?:^|;\s*)fv_sessao=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
  return m && m[1];
}
function logado(req) {
  const t = token(req);
  const exp = t && sessoes.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessoes.delete(t); return false; }
  return true;
}
function igual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ---------- utilitários http ---------- */
const TIPOS = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".json":"application/json" };

function json(res, status, obj, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(obj));
}
function corpo(req, limite = 20000) {
  return new Promise((ok, erro) => {
    let d = "";
    req.on("data", c => { d += c; if (d.length > limite) { erro(new Error("grande")); req.destroy(); } });
    req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch { erro(new Error("json")); } });
    req.on("error", erro);
  });
}
function arquivo(res, rel) {
  const alvo = path.normalize(path.join(PUBLICO, rel));
  if (!alvo.startsWith(PUBLICO)) { res.writeHead(403); return res.end(); }
  let f = alvo;
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); } catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Página não encontrada"); }
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(buf);
  });
}
const limpa = (v, max = 300) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/* ---------- rotas ---------- */
const CAMPOS = ["nome","primeiro_nome","whatsapp","whatsapp_formatado","instagram","objetivo","objetivo_outro","modalidade","prazo","utm_source","utm_medium","utm_campaign","utm_content","utm_term","pagina","referencia"];
const STATUS = ["novo", "contatado", "agendado", "fechado", "descartado"];

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  const rota = url.pathname;

  try {
    // Recebe uma aplicação do quiz (público)
    if (rota === "/api/lead" && req.method === "POST") {
      const b = await corpo(req);
      const lead = { id: crypto.randomUUID(), criado_em: new Date().toISOString(), status: "novo", observacao: "" };
      for (const c of CAMPOS) lead[c] = limpa(b[c], c === "objetivo_outro" ? 600 : 300);
      if (!lead.nome || !lead.whatsapp) return json(res, 400, { erro: "Nome e WhatsApp são obrigatórios." });
      const leads = lerLeads(); leads.push(lead); salvarLeads(leads);
      console.log(`[lead] ${lead.criado_em} · ${lead.nome} · ${lead.whatsapp_formatado} · ${lead.prazo}`);
      return json(res, 201, { ok: true });
    }

    // Login
    if (rota === "/api/login" && req.method === "POST") {
      const ip = req.socket.remoteAddress;
      const t = tentativas.get(ip);
      if (t && t.n >= 5 && t.ate > Date.now()) return json(res, 429, { erro: "Muitas tentativas. Espera 5 minutos e tenta de novo." });
      const b = await corpo(req);
      if (igual(b.usuario || "", USUARIO) && igual(b.senha || "", SENHA)) {
        tentativas.delete(ip);
        const tk = crypto.randomBytes(32).toString("base64url");
        sessoes.set(tk, Date.now() + DURACAO);
        return json(res, 200, { ok: true }, { "Set-Cookie": `fv_sessao=${tk}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DURACAO / 1000}` });
      }
      const n = (t && t.ate > Date.now() ? t.n : 0) + 1;
      tentativas.set(ip, { n, ate: Date.now() + 5 * 60 * 1000 });
      return json(res, 401, { erro: "Usuário ou senha incorretos." });
    }
    if (rota === "/api/logout" && req.method === "POST") {
      const t = token(req); if (t) sessoes.delete(t);
      return json(res, 200, { ok: true }, { "Set-Cookie": "fv_sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
    }
    if (rota === "/api/sessao") return json(res, 200, { logado: logado(req) });

    // Área protegida
    if (rota.startsWith("/api/leads")) {
      if (!logado(req)) return json(res, 401, { erro: "Faça login." });

      if (rota === "/api/leads" && req.method === "GET") {
        return json(res, 200, lerLeads().slice().reverse());
      }
      if (rota === "/api/leads.csv" && req.method === "GET") {
        const cols = ["criado_em", "status", ...CAMPOS, "observacao"];
        const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const linhas = [cols.join(";"), ...lerLeads().map(l => cols.map(c => q(l[c])).join(";"))];
        res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-fanny-${new Date().toISOString().slice(0,10)}.csv"` });
        return res.end("﻿" + linhas.join("\n"));
      }
      const m = /^\/api\/leads\/([0-9a-f-]{36})$/.exec(rota);
      if (m && req.method === "PATCH") {
        const b = await corpo(req);
        const leads = lerLeads();
        const l = leads.find(x => x.id === m[1]);
        if (!l) return json(res, 404, { erro: "Lead não encontrado." });
        if (b.status !== undefined) { if (!STATUS.includes(b.status)) return json(res, 400, { erro: "Status inválido." }); l.status = b.status; }
        if (b.observacao !== undefined) l.observacao = limpa(b.observacao, 1000);
        l.atualizado_em = new Date().toISOString();
        salvarLeads(leads);
        return json(res, 200, l);
      }
      if (m && req.method === "DELETE") {
        const leads = lerLeads();
        const resto = leads.filter(x => x.id !== m[1]);
        if (resto.length === leads.length) return json(res, 404, { erro: "Lead não encontrado." });
        salvarLeads(resto);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { erro: "Rota não encontrada." });
    }

    // Páginas
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    if (rota === "/admin") { res.writeHead(301, { Location: "/admin/" }); return res.end(); }
    return arquivo(res, decodeURIComponent(rota));
  } catch (e) {
    return json(res, 400, { erro: "Requisição inválida." });
  }
});

servidor.listen(PORT, () => {
  console.log(`\n  Quiz:          http://localhost:${PORT}/`);
  console.log(`  Painel leads:  http://localhost:${PORT}/admin/\n`);
});
