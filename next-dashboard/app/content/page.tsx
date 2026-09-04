import { mcFetchJSON } from "@/lib/mc-api";

async function getContent() {
  return mcFetchJSON(`/api/content?limit=60`);
}

function timeAgo(sec?: number) {
  if (!sec) return "—";
  const diff = Date.now() / 1000 - sec;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default async function ContentPage() {
  const data = await getContent();
  const items = data.documents || [];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium">Content</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-2">Conteúdo gerado pela frota: roteiros, posts, revisões e deliverables.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.length === 0 && (
            <div className="text-sm text-black/40 dark:text-white/40 py-8 text-center md:col-span-2">Sem conteúdo gerado no momento.</div>
          )}
          {items.map((item: any) => (
            <div key={item.id} className="bg-card dark:bg-cardd rounded-2xl p-5 shadow-sm border border-black/5 dark:border-white/10 hover:border-black/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold truncate pr-3">{item.title || "(untitled)"}</div>
                <div className="text-[11px] text-black/40 dark:text-white/40 tabular-nums shrink-0">{timeAgo(item.timestamp)}</div>
              </div>
              <div className="text-xs text-black/50 dark:text-white/50 line-clamp-3 leading-relaxed">{item.excerpt}</div>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-black/40 dark:text-white/40">
                <span className="uppercase tracking-wider">{item.profile}</span>
                <span>·</span>
                <span>{item.char_count?.toLocaleString?.() ?? item.char_count} chars</span>
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
