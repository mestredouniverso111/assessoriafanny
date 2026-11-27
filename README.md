# Assessoria Fanny Viana: Quiz de Consulta Nutricional

Quiz de aplicação para o acompanhamento nutricional da Fanny Viana, com painel de leads protegido por login. O visual segue o biolink fannyviana.com.br.

## Pastas

| Pasta / arquivo | O que é |
|---|---|
| `cloudflare/` | **Versão de produção** (Cloudflare Pages + Functions + D1). Quiz em `/consulta-nutricional`, painel em `/consulta-nutricional-admin`. Passo a passo em [`cloudflare/COMO-SUBIR.md`](cloudflare/COMO-SUBIR.md). |
| `quiz/` | Versão para rodar no computador (Node, sem dependências). Instruções em [`quiz/LEIA-ME.md`](quiz/LEIA-ME.md). |
| `quiz-acompanhamento-fanny.md` | Copy aprovada pela Fanny. |

## Segredos
A senha do painel **não** fica no repositório:
- Produção: variáveis `ADMIN_USUARIO` e `ADMIN_SENHA` no projeto da Cloudflare.
- Local: arquivo `quiz/.env` (ignorado pelo git), no formato:

      PORT=4321
      ADMIN_USUARIO=fanny
      ADMIN_SENHA=uma-senha-forte
