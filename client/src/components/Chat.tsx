/**
 * Room chat.
 *  - Laptop/desktop (wide screens): a WhatsApp-group style panel docked on the side.
 *  - Phones/tablets: a floating 💬 bubble opens the chat; new messages fly in from the side.
 */
import { GAME_CONFIG } from "@shared/config";
import type { ChatMessage, ClientMessage } from "@shared/protocol";
import { truncate } from "@shared/text";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { Avatar } from "./Avatar";

const WIDE = "(min-width: 1100px)";

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const fn = () => setWide(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return wide;
}

const COLLAPSE_KEY = "afsha.chatCollapsed";
const loadCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Messages({ messages, youId }: { messages: ChatMessage[]; youId: string }) {
  const list = useRef<HTMLDivElement>(null);
  // Scroll only the message list (never the page) to the newest message.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  if (messages.length === 0) return <p className="chat-empty">{t.chatEmpty}</p>;
  return (
    <div className="chat-list" ref={list}>
      {messages.map((m) => (
        <div key={m.id} className={`chat-msg ${m.playerId === youId ? "mine" : ""}`}>
          {m.playerId !== youId && <Avatar avatar={m.avatar} size={38} />}
          <div className="bubble">
            {m.playerId !== youId && <strong>{m.name}</strong>}
            <span dir="auto">{m.text}</span>
            <small>{time(m.at)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function Composer({ send }: { send: (m: ClientMessage) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    send({ type: "chat", text });
    setText("");
  };
  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="input input-sm"
        value={text}
        onChange={(e) => setText(truncate(e.target.value, GAME_CONFIG.chatMaxLength))}
        placeholder={t.chatPlaceholder}
        dir="auto"
        enterKeyHint="send"
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim()}>
        {t.chatSend}
      </button>
    </form>
  );
}

export function Chat({
  messages,
  youId,
  send,
  onDocked,
}: {
  messages: ChatMessage[];
  youId: string;
  send: (m: ClientMessage) => void;
  onDocked?: (docked: boolean) => void;
}) {
  const wideScreen = useWide();
  const [collapsed, setCollapsedState] = useState(loadCollapsed);
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      /* private mode */
    }
  };
  // Docked side panel only on wide screens, and only while not collapsed.
  const wide = wideScreen && !collapsed;
  useEffect(() => onDocked?.(wide), [wide, onDocked]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(messages.length ? messages[messages.length - 1].id : "");
  const [flyins, setFlyins] = useState<ChatMessage[]>([]);
  const lastId = useRef(seen);

  // New messages from others → fly-in (phones, chat closed) + unread badge.
  useEffect(() => {
    const idx = messages.findIndex((m) => m.id === lastId.current);
    const fresh = messages.slice(idx + 1).filter((m) => m.playerId !== youId);
    lastId.current = messages[messages.length - 1]?.id ?? "";
    if (!fresh.length || wide || open) return;
    setFlyins((f) => [...f, ...fresh].slice(-3));
    const timers = fresh.map((m) => window.setTimeout(() => setFlyins((f) => f.filter((x) => x.id !== m.id)), 4500));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const visible = wide || open;
  useEffect(() => {
    if (visible) setSeen(messages[messages.length - 1]?.id ?? "");
  }, [visible, messages]);
  const seenIdx = messages.findIndex((m) => m.id === seen);
  const unread = messages.slice(seenIdx + 1).filter((m) => m.playerId !== youId).length;

  if (wide) {
    return (
      <aside className="chat-panel" aria-label={t.chatTitle}>
        <header>
          <span>💬 {t.chatTitle}</span>
          <button type="button" className="chat-collapse" aria-label={t.chatCollapse} title={t.chatCollapse} onClick={() => setCollapsed(true)}>
            {document.documentElement.dir === "rtl" ? "⇤" : "⇥"}
          </button>
        </header>
        <Messages messages={messages} youId={youId} />
        <Composer send={send} />
      </aside>
    );
  }

  return (
    <>
      <div className="flyins" aria-live="polite">
        {flyins.map((m) => (
          <button key={m.id} type="button" className="flyin" onClick={() => (wideScreen ? setCollapsed(false) : setOpen(true))}>
            <Avatar avatar={m.avatar} size={38} />
            <span>
              <strong>{m.name}: </strong>
              <span dir="auto">{m.text}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="chat-fab"
        aria-label={t.chatOpen}
        onClick={() => (wideScreen ? setCollapsed(false) : setOpen(true))}
      >
        💬
        {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={t.chatTitle} onClick={() => setOpen(false)}>
          <div className="sheet chat-sheet" onClick={(e) => e.stopPropagation()}>
            <header>
              <span>💬 {t.chatTitle}</span>
              <button type="button" className="close-x" aria-label={t.close} onClick={() => setOpen(false)}>
                ✕
              </button>
            </header>
            <Messages messages={messages} youId={youId} />
            <Composer send={send} />
          </div>
        </div>
      )}
    </>
  );
}
