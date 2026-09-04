"use client";

import { useEffect, useRef, useState } from "react";
import { mcFetchJSON } from "@/lib/mc-api";

type AgentKey = "orchestrator" | "dev" | "scout" | "scribe" | "reach";

const AGENT_META: Record<AgentKey, { name: string; role: string; color: string }> = {
  orchestrator: { name: "Orchestrator", role: "COORDINATOR", color: "#E8622C" },
  scout: { name: "Scout", role: "RESEARCH", color: "#1FA6A0" },
  scribe: { name: "Scribe", role: "WRITING", color: "#D9A62E" },
  reach: { name: "Reach", role: "MARKETING", color: "#D6407E" },
  dev: { name: "Dev", role: "ENGINEERING", color: "#3FA85C" },
};

const CHAT_PROFILES: AgentKey[] = ["orchestrator", "dev", "scout", "scribe", "reach"];
const ALLOWED_CHAT_PROFILES = new Set(["dev", "reach", "scout", "scribe"]);

export default function ChatPage() {
  const [selected, setSelected] = useState<AgentKey | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; timestamp?: number }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setMessages([]);
    setError(null);

    // Use the backend's own profile filter (server-side) instead of
    // fetching the last N messages across ALL profiles and filtering
    // client-side — the old approach could starve a less-active agent's
    // history entirely if other profiles were more active recently.
    mcFetchJSON(`/api/messages?limit=30&profile=${encodeURIComponent(selected)}`)
      .then((data) => {
        if (!cancelled) {
          // Real chat history can contain internal turns with no user-
          // facing text: tool-call requests (finish_reason "tool_calls"
          // with empty content) and tool-result turns (role "tool", which
          // can have non-empty content — raw JSON from a tool execution,
          // not agent prose). These are genuine DB rows, not a fetch bug,
          // but showing them as chat bubbles looks exactly like broken UI
          // — only user/assistant turns with real visible text are shown.
          const visible = data.filter(
            (m: any) =>
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0
          );
          setMessages(visible.slice(0, 20).reverse());
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!selected || !input.trim() || sending) return;
    if (!ALLOWED_CHAT_PROFILES.has(selected)) {
      setError("Perfil sem alias de chat direto.");
      return;
    }
    const text = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    try {
      const data = await mcFetchJSON(`/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: selected, message: text }),
      });
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "user", content: text, timestamp: Date.now() / 1000 },
        { id: String(Date.now() + 1), role: "assistant", content: data.response || data.reply || "(sem resposta)", timestamp: Date.now() / 1000 },
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-medium">Talk to the fleet.</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-2">
          Real messages, real replies — sending a message runs an actual model call through the agent CLI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        <div className="bg-card dark:bg-cardd rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
            Agents
          </div>
          <div className="divide-y divide-black/5">
            {CHAT_PROFILES.map((key) => {
              const meta = AGENT_META[key];
              const isDisabled = !ALLOWED_CHAT_PROFILES.has(key);
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors ${
                    selected === key ? "bg-black/5 dark:bg-white/10" : ""
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: meta.color }}
                  >
                    {meta.name[0]}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{meta.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40">{meta.role}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl border border-black/5 dark:border-white/10 flex flex-col h-[620px]">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-black/30 dark:text-white/30 text-sm">
              Selecione um agente à esquerda para começar.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5 dark:border-white/10">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: AGENT_META[selected].color }}
                >
                  {AGENT_META[selected].name[0]}
                </span>
                <div>
                  <div className="text-sm font-semibold">{AGENT_META[selected].name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40">{AGENT_META[selected].role}</div>
                </div>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Ready
                </span>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-sm text-black/40 dark:text-white/40 py-6 text-center">Sem histórico ainda para este perfil.</div>
                )}
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser ? "msg-bubble-user" : "msg-bubble-agent"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        {m.timestamp ? (
                          <div className={`text-[10px] mt-1 ${isUser ? "text-cream/50" : "text-black/35 dark:text-white/35"}`}>
                            {new Date(m.timestamp * 1000).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-black/5 dark:border-white/10 p-4">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    ALLOWED_CHAT_PROFILES.has(selected)
                      ? "Message the agent... (Enter to send, Shift+Enter for newline)"
                      : "Perfil sem chat direto configurado."
                  }
                  disabled={!ALLOWED_CHAT_PROFILES.has(selected) || sending}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-black/10 dark:border-white/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-black/35 dark:text-white/35">
                    {selected === "orchestrator"
                      ? "Orchestrator chat is not wired to a CLI profile yet — history shown only."
                      : "Sending runs a real model call (costs API credits, can take up to 2 min)."}
                  </span>
                  <button
                    onClick={send}
                    disabled={!ALLOWED_CHAT_PROFILES.has(selected) || sending}
                    className="bg-accent hover:bg-accent-light text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full disabled:opacity-40"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
                {error ? <div className="text-red-600 text-xs mt-2">Erro: {error}</div> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
