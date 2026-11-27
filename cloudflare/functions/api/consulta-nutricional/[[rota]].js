// Cloudflare Pages Function: API do quiz "Consulta Nutricional" da Fanny Viana.
// Atende tudo em /api/consulta-nutricional/*
//
// Precisa no projeto Pages:
//   - Banco D1 ligado com o nome de variável  DB   (tabelas em schema.sql)
//   - Variável  ADMIN_USUARIO  (ex.: fanny)
//   - Segredo   ADMIN_SENHA    (senha do painel)
//
// Rotas:
//   POST   /lead           recebe uma aplicação (público)
//   POST   /login          entra no painel
//   POST   /logout         sai do painel
//   GET    /sessao         diz se está logado
//   GET    /leads          lista os leads              (login)
//   GET    /exportar       baixa planilha CSV          (login)
//   PATCH  /leads/:id      muda status / anotação      (login)
//   DELETE /leads/:id      exclui um lead              (login)

const CAMPOS = ["nome","primeiro_nome","whatsapp","whatsapp_formatado","instagram","objetivo","objetivo_outro","modalidade","prazo","utm_source","utm_medium","utm_campaign","utm_content","utm_term","pagina","referencia"];
const STATUS = ["novo", "contatado", "agendado", "fechado", "descartado"];
const COOKIE = "fv_cn_sessao";
const DURACAO = 60 * 60 * 12; // 12h em segundos
const MAX_TENTATIVAS = 5;
const JANELA_TENTATIVAS = 5 * 60 * 1000; // 5 min

/* ---------- utilitários ---------- */
const json = (status, obj, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }
});
const limpa = (v, max = 300) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function lerJSON(request, limite = 20000) {
  const txt = await request.text();
  if (txt.length > limite) throw new Error("grande");
  return txt ? JSON.parse(txt) : {};
}
async function hmac(segredo, msg) {
  const chave = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", chave, enc.encode(msg)));
}
// comparação em tempo constante (via HMAC dos dois lados)
async function igual(a, b, segredo) {
  const [x, y] = await Promise.all([hmac(segredo, String(a)), hmac(segredo, String(b))]);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
const segredoSessao = env => "sessao|" + env.ADMIN_SENHA; // trocar a senha derruba as sessões abertas

async function criarSessao(env) {
  const exp = Math.floor(Date.now() / 1000) + DURACAO;
  return `${exp}.${await hmac(segredoSessao(env), String(exp))}`;
}
async function logado(request, env) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9]+)\\.([A-Za-z0-9_-]+)`).exec(request.headers.get("Cookie") || "");
  if (!m) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  return igual(m[2], await hmac(segredoSessao(env), m[1]), env.ADMIN_SENHA);
}
const cookieSessao = (valor, maxAge) => `${COOKIE}=${valor}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

/* ---------- handler ---------- */
export async function onRequest(context) {
  const { request, env, params } = context;
  const metodo = request.method;
  const partes = Array.isArray(params.rota) ? params.rota : [params.rota].filter(Boolean);
  const rota = partes.join("/");

  if (!env.DB) return json(500, { erro: "Banco D1 não configurado (variável DB)." });
  if (!env.ADMIN_SENHA) return json(500, { erro: "ADMIN_SENHA não configurada." });
  const usuarioAdmin = env.ADMIN_USUARIO || "fanny";

  try {
    /* ---- público: recebe aplicação ---- */
    if (rota === "lead" && metodo === "POST") {
      // só aceita envios vindos do próprio site
      const origem = request.headers.get("Origin");
      if (origem && new URL(origem).host !== new URL(request.url).host) return json(403, { erro: "Origem não permitida." });
      const b = await lerJSON(request);
      const lead = {};
      for (const c of CAMPOS) lead[c] = limpa(b[c], c === "objetivo_outro" ? 600 : 300);
      if (!lead.nome || !lead.whatsapp) return json(400, { erro: "Nome e WhatsApp são obrigatórios." });
      const id = crypto.randomUUID();
      const agora = new Date().toISOString();
      const cols = ["id", "criado_em", "status", "observacao", ...CAMPOS, "pais"];
      const vals = [id, agora, "novo", "", ...CAMPOS.map(c => lead[c]), limpa(request.cf && request.cf.country, 4)];
      await env.DB.prepare(`INSERT INTO leads (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).bind(...vals).run();
      return json(201, { ok: true });
    }

    /* ---- login / sessão ---- */
    if (rota === "login" && metodo === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "desconhecido";
      const agoraMs = Date.now();
      const t = await env.DB.prepare("SELECT n, ate FROM tentativas_login WHERE ip = ?").bind(ip).first();
      if (t && t.n >= MAX_TENTATIVAS && t.ate > agoraMs) return json(429, { erro: "Muitas tentativas. Espera 5 minutos e tenta de novo." });
      const b = await lerJSON(request);
      const okUser = await igual(b.usuario || "", usuarioAdmin, env.ADMIN_SENHA);
      const okSenha = await igual(b.senha || "", env.ADMIN_SENHA, env.ADMIN_SENHA);
      if (okUser && okSenha) {
        await env.DB.prepare("DELETE FROM tentativas_login WHERE ip = ?").bind(ip).run();
        return json(200, { ok: true }, { "Set-Cookie": cookieSessao(await criarSessao(env), DURACAO) });
      }
      const n = (t && t.ate > agoraMs ? t.n : 0) + 1;
      await env.DB.prepare("INSERT INTO tentativas_login (ip, n, ate) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET n = excluded.n, ate = excluded.ate")
        .bind(ip, n, agoraMs + JANELA_TENTATIVAS).run();
      return json(401, { erro: "Usuário ou senha incorretos." });
    }
    if (rota === "logout" && metodo === "POST") return json(200, { ok: true }, { "Set-Cookie": cookieSessao("", 0) });
    if (rota === "sessao" && metodo === "GET") return json(200, { logado: await logado(request, env) });

    /* ---- área protegida ---- */
    if (rota === "leads" || rota === "exportar" || partes[0] === "leads") {
      if (!(await logado(request, env))) return json(401, { erro: "Faça login." });

      if (rota === "leads" && metodo === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM leads ORDER BY criado_em DESC LIMIT 5000").all();
        return json(200, results);
      }

      if (rota === "exportar" && metodo === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM leads ORDER BY criado_em ASC").all();
        const cols = ["criado_em", "status", ...CAMPOS, "observacao", "pais"];
        // evita que planilhas executem fórmulas vindas das respostas
        const q = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
        const linhas = [cols.join(";"), ...results.map(l => cols.map(c => q(l[c])).join(";"))];
        return new Response("﻿" + linhas.join("\n"), { headers: {
          "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="leads-consulta-nutricional-${new Date().toISOString().slice(0, 10)}.csv"`
        }});
      }

      const id = partes[0] === "leads" && partes[1];
      if (id && /^[0-9a-f-]{36}$/.test(id)) {
        if (metodo === "PATCH") {
          const b = await lerJSON(request);
          const sets = [], vals = [];
          if (b.status !== undefined) { if (!STATUS.includes(b.status)) return json(400, { erro: "Status inválido." }); sets.push("status = ?"); vals.push(b.status); }
          if (b.observacao !== undefined) { sets.push("observacao = ?"); vals.push(limpa(b.observacao, 1000)); }
          if (!sets.length) return json(400, { erro: "Nada para atualizar." });
          sets.push("atualizado_em = ?"); vals.push(new Date().toISOString());
          const r = await env.DB.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run();
          if (!r.meta.changes) return json(404, { erro: "Lead não encontrado." });
          return json(200, await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first());
        }
        if (metodo === "DELETE") {
          const r = await env.DB.prepare("DELETE FROM leads WHERE id = ?").bind(id).run();
          if (!r.meta.changes) return json(404, { erro: "Lead não encontrado." });
          return json(200, { ok: true });
        }
      }
    }

    return json(404, { erro: "Rota não encontrada." });
  } catch (e) {
    return json(400, { erro: "Requisição inválida." });
  }
}
