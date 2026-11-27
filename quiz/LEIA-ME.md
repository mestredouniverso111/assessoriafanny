# Quiz de aplicação: Acompanhamento Nutricional Fanny Viana

## Rodar no computador
Abra o Terminal nesta pasta (`quiz`) e rode:

    node --env-file=.env server.js

Depois abra:
- **Quiz:** http://localhost:4321/
- **Painel de leads (com login):** http://localhost:4321/admin/

Para desligar, aperte `Ctrl + C` no Terminal.

## Login do painel
O usuário e a senha ficam no arquivo `.env` (ADMIN_USUARIO e ADMIN_SENHA).
Para trocar a senha, edite o `.env` e reinicie o servidor.

## Onde ficam os leads
Em `data/leads.json`. No painel dá para:
- mudar o status (novo, contatado, agendado, fechado, descartado);
- fazer anotações;
- chamar a pessoa no WhatsApp com uma mensagem pronta;
- exportar tudo em planilha (CSV, abre no Excel e no Google Planilhas).

## Campanhas
Os links com utm (ex.: `?utm_source=ig&utm_campaign=stories`) ficam salvos em cada lead e aparecem como "Origem" no painel.

## Estrutura
- `public/index.html`: o quiz
- `public/admin/index.html`: login e painel
- `server.js`: servidor (só precisa de Node 20 ou mais novo, sem instalar nada)
- `.env`: porta, usuário e senha (não compartilhar)
