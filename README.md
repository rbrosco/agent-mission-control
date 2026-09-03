# Agent Mission Control — Hermes Fleet Dashboard

Painel de controle da frota Hermes (Orchestrator + perfis dev/scout/scribe/reach).
Duas camadas: um backend Python (stdlib puro) que expõe dados lidos direto dos
perfis Hermes locais, e um painel Next.js moderno que consome essas APIs.

## Estrutura

```
.
├── server.py                        # Backend HTTP (porta 51763) — API + fallback do painel antigo
├── index.html                       # Painel antigo (HTML/JS puro), servido em "/" como fallback
├── hermes-dashboard-template.html   # Fonte de design "pristina" do painel antigo (não editar direto)
└── next-dashboard/                  # Painel novo (Next.js 15 + React 19 + Tailwind 4), porta 3001
    ├── app/                         # App Router — Overview, Agents, Chat, Tasks, Content, Office, Schedule, Docs
    └── components/                  # DashboardShell, ThemeToggle, Clock
```

## Rodando localmente

### 1. Backend (obrigatório)
```bash
python3 server.py
# escuta em http://127.0.0.1:51763
```
Lê dados de `~/.hermes/profiles/*` (ou `$HERMES_HOME`, se definido) — sessões,
tasks (kanban.db), mensagens, cron jobs. Sem dependências externas.

### 2. Painel novo (Next.js)
```bash
cd next-dashboard
npm install
npm run dev      # dev mode, porta 3001
# produção:
npm run build && npm run start
```

Suba o backend primeiro — o painel depende das APIs dele para renderizar
qualquer aba (fetch client-side e server-side para `http://127.0.0.1:51763`).

## Features

- **8 abas**: Overview (métricas da frota), Agents (status por perfil), Chat
  (conversa direta com cada agente), Tasks (kanban), Content, Office, Schedule
  (cron jobs), Docs.
- **Dark mode**: toggle no header, persistido em `localStorage`, sem flash de
  tema errado no reload (script `beforeInteractive`).
- **CORS habilitado** no backend para o painel Next.js fazer fetch client-side
  de outra origem/porta.

## Notas

- `server.py` também serve o painel antigo (`index.html`) em `/` e redireciona
  para `http://127.0.0.1:3001/` automaticamente quando o Next.js está rodando.
- Backups locais (`*.bak-*`) e dados de runtime (`kanban.db`, `state.db`,
  `node_modules/`, `.next/`) ficam de fora do versionamento — ver `.gitignore`.
