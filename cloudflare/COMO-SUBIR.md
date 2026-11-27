# Como subir o quiz no fannyviana.com.br (Cloudflare Pages)

Endereços finais:
- Quiz: **fannyviana.com.br/consulta-nutricional**
- Painel de leads: **fannyviana.com.br/consulta-nutricional-admin**

## O que tem nesta pasta

| Arquivo / pasta | Vai para onde no projeto do biolink |
|---|---|
| `consulta-nutricional/index.html` | dentro da pasta publicada do site (a mesma onde está o `index.html` do biolink) |
| `consulta-nutricional-admin/index.html` | dentro da pasta publicada do site |
| `_headers` | dentro da pasta publicada do site. **Se já existir um `_headers`, só cole estas linhas no fim dele** |
| `functions/api/consulta-nutricional/[[rota]].js` | na pasta `functions/` na **raiz do projeto** (crie se não existir) |
| `schema.sql` | não precisa ir para o site, é só para criar o banco (passo 2) |

> Se o projeto tiver um arquivo `_routes.json`, inclua `/api/consulta-nutricional/*` na lista `include`.

## Passo a passo

### 1. Copiar os arquivos
Copie os arquivos para o projeto do biolink conforme a tabela acima.

### 2. Criar o banco de dados (D1)
No painel da Cloudflare:
1. **Storage & Databases → D1 → Create database**. Nome sugerido: `quiz-consulta-nutricional`.
2. Abra o banco, vá em **Console**, cole todo o conteúdo de `schema.sql` e clique em **Execute**.

### 3. Ligar o banco ao site
No projeto Pages do biolink:
1. **Settings → Bindings → Add → D1 database**
2. Variable name: `DB` (exatamente assim)
3. D1 database: `quiz-consulta-nutricional`
4. Faça isso para **Production** (e para Preview, se quiser testar antes).

### 4. Criar o login do painel
Ainda em **Settings → Variables and Secrets**:
- `ADMIN_USUARIO` → tipo *Text* → ex.: `fanny`
- `ADMIN_SENHA` → tipo **Secret** → uma senha forte e nova (não use a do teste local)

### 5. Publicar
Suba as mudanças do jeito que vocês já fazem com o biolink (push no GitHub ou upload na Cloudflare).
Bindings e variáveis só passam a valer **depois de um novo deploy**.

### 6. Testar
1. Abra `fannyviana.com.br/consulta-nutricional`, responda o quiz com dados de teste.
2. Abra `fannyviana.com.br/consulta-nutricional-admin`, entre com o usuário e a senha do passo 4.
3. O lead de teste deve aparecer. Exclua ele pelo botão de lixeira.

## Dia a dia
- **Trocar a senha:** mude `ADMIN_SENHA` na Cloudflare e faça um novo deploy. Quem estava logado sai automaticamente.
- **Links de campanha:** use utm, ex.: `fannyviana.com.br/consulta-nutricional?utm_source=ig&utm_campaign=stories`. Aparece como "Origem" no painel.
- **Backup / planilha:** botão "Exportar planilha" no painel (abre no Excel e no Google Planilhas).
- **Segurança:** o login bloqueia o IP por 5 minutos depois de 5 senhas erradas. O painel não aparece no Google.

## Se algo der errado
- Quiz mostra "Ops, sua aplicação não foi enviada" → o banco não está ligado (passo 3) ou o arquivo da função não está em `functions/` na raiz do projeto.
- Painel diz "Banco D1 não configurado" → falta o binding `DB` (passo 3) ou o deploy depois dele.
- Painel diz "ADMIN_SENHA não configurada" → falta o passo 4 ou o deploy depois dele.
