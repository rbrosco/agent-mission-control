const SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    body: [
      "Visão consolidada da frota inteira. O grafo de rede no hero mostra o orchestrator (nó central) conectado aos 4 especialistas.",
      "Cards de métricas: Active Missions vem de kanban.db (tarefas com status todo/in_progress). O anel de distribuição de carga e o throughput por agente vêm de sessions.session_count agrupado por profile_name em cada state.db.",
    ],
    source: "state.db (sessions) + kanban.db (tasks), lidos via /api/summary",
  },
  {
    id: "agents",
    title: "Agents",
    body: [
      "5 cards: o Orchestrator (conceitual, coordena os outros) e os 4 perfis reais — Dev, Scout, Scribe, Reach.",
      "Cada card mostra: modelo em uso (campo sessions.model da sessão mais recente daquele perfil), contagem de sessões, e um indicador de carga relativo entre os perfis.",
    ],
    source: "state.db (sessions), via /api/sessions agrupado por profile",
  },
  {
    id: "chat",
    title: "Chat",
    body: [
      "Conversa REAL com qualquer um dos 4 agentes (dev/scout/scribe/reach). Ao enviar uma mensagem, o servidor dispara de verdade o comando `<perfil> chat -q \"...\" --oneshot -Q`, que é uma chamada de API real ao modelo — tem custo e pode levar até 2 minutos.",
      "O histórico mostrado é o real daquele perfil, vindo das mesmas tabelas de sessions/messages do restante do painel.",
    ],
    source: "POST /api/chat/send (efeito real) + GET /api/messages (histórico)",
  },
  {
    id: "tasks",
    title: "Tasks",
    body: [
      "Quadro Kanban real, com as colunas To do / In progress / Done mapeadas a partir dos status reais do board (todo, in_progress, blocked, triage, done).",
      "Os 2 cards de exemplo que vêm com o board do servidor são dados reais editáveis, não dados de demonstração — podem ser movidos, editados ou excluídos como qualquer outra tarefa.",
    ],
    source: "kanban.db (global e por perfil), via /api/kanban",
  },
  {
    id: "office",
    title: "Office",
    body: [
      "Cidade 3D: cada agente é um prédio, o Orchestrator é o HQ central. As janelas de um prédio acendem quando aquele perfil teve atividade real nas últimas 2 horas — não é decorativo, é dado real (last_activity_at).",
      "Arraste para orbitar a câmera, use a roda do mouse para zoom, clique em um prédio para ver seu dossiê (sessões e status).",
    ],
    source: "state.db (last_activity_at por sessão), via /api/summary + /api/sessions",
  },
  {
    id: "content",
    title: "Content",
    body: [
      "Biblioteca de \"documentos\" gerados pela frota. Como não existe uma tabela dedicada de documentos neste banco, esta aba usa como proxy honesto as mensagens do papel assistant com mais de 600 caracteres — são respostas reais e longas dos agentes, não texto inventado.",
    ],
    source: "state.db (messages, role=assistant, char_count > 600), via /api/content",
  },
  {
    id: "schedule",
    title: "Schedule",
    body: [
      "Jobs de cron e seu histórico de execuções, agregados de todos os perfis e do diretório global de cron.",
      "Como este servidor não guarda uma tabela separada de \"definição de job\", cada job é derivado da execução mais recente conhecida daquele job_id.",
    ],
    source: "cron/executions.db (global e por perfil), via /api/cron/jobs e /api/cron/executions",
  },
  {
    id: "data-safety",
    title: "Data & Safety",
    body: [
      "Toda leitura de SQLite neste painel é estritamente somente-leitura: cada conexão abre com mode=ro e roda PRAGMA query_only=1 — mesmo um bug no código não conseguiria escrever nos bancos do Hermes.",
      "A única rota com efeito colateral real é o envio de mensagens no Chat (dispara um subprocess real, com whitelist fixa de perfis permitidos, timeout de 120s, e sem shell=True).",
      "Uploads de arquivo (usados para atualizar o template de design) validam extensão por whitelist e bloqueiam qualquer tentativa de path traversal no nome do arquivo.",
    ],
    source: "server.py — arquitetura de segurança",
  },
  {
    id: "controls",
    title: "Controls",
    body: [
      "⌘K / busca: atalho visual no topo, ainda não conectado a uma busca funcional.",
      "Atualização automática: as páginas revalidam dados a cada poucos segundos (Next.js revalidate), então números tendem a ficar atualizados sem precisar recarregar manualmente.",
    ],
    source: "—",
  },
] as const;

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-[#16120F] rounded-2xl px-8 py-10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 15% 0%, rgba(232,98,44,0.35), transparent)",
          }}
        />
        <div className="relative">
          <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#F2EEE7]">
            Know every <span className="italic text-[#EA6A35]">corner.</span>
          </h1>
          <p className="text-sm text-white/50 mt-3 max-w-2xl leading-relaxed">
            A plain-language guide to every tab, panel, and number on your Hermes Mission Control
            dashboard — what it shows, where the data comes from, and how to use it. Nothing here is
            invented: every figure traces back to your real Hermes activity or your local files.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 text-black/50 dark:text-white/50 px-3 py-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            id={s.id}
            className="bg-card dark:bg-cardd rounded-2xl p-6 border border-black/5 dark:border-white/10 scroll-mt-24"
          >
            <h2 className="font-serif text-xl font-medium mb-3">{s.title}</h2>
            <div className="space-y-2">
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-black/60 dark:text-white/60 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/10 text-[11px] text-black/40 dark:text-white/40">
              <span className="font-semibold uppercase tracking-wider">Fonte:</span> {s.source}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
