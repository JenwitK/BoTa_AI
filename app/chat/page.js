'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';
import chat from './chat.module.css';

// Stream straight from the Space (CORS is open there). Going through the Next
// route handler buffers the response in dev, which defeats streaming — so the
// browser talks to the Space directly for the token stream.
const CHAT_STREAM_URL =
  process.env.NEXT_PUBLIC_CHAT_STREAM_URL ||
  'https://botaai-serpent-chat.hf.space/chat/stream';

const SUGGESTED = [
  'งูเห่ามีพิษไหม อันตรายแค่ไหน',
  'โดนงูกัดต้องปฐมพยาบาลยังไง',
  'เจองูในบ้านควรทำอย่างไร',
  'งูเขียวหางไหม้กับงูเขียวไม่มีพิษต่างกันยังไง',
];

// "species:Naja kaouthia" -> "Naja kaouthia" ; "general" -> "ความรู้ทั่วไป"
const prettySource = (s) => {
  if (!s) return '';
  if (s === 'general') return 'ความรู้ทั่วไป';
  return s.replace(/^species:/, '');
};

export default function ChatPage() {
  const [messages, setMessages] = useState([]);   // {role:'user'|'assistant', content, sources?}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const logRef = useRef(null);
  const textareaRef = useRef(null);

  // Keep the log pinned to the latest message.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const send = useCallback(async (text) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    setError('');
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    // Add the user turn + an empty assistant placeholder we'll fill as tokens stream in.
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: '', sources: [], streaming: true },
    ]);
    setLoading(true);

    // Update the last message (the streaming assistant) immutably.
    const patchLast = (patch) =>
      setMessages((prev) => {
        const copy = [...prev];
        const i = copy.length - 1;
        copy[i] = { ...copy[i], ...patch(copy[i]) };
        return copy;
      });

    try {
      const res = await fetch(CHAT_STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'ผู้ช่วยงูขัดข้อง');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErr = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let obj;
          try { obj = JSON.parse(line); } catch { continue; }

          if (obj.error) { streamErr = obj.error; continue; }
          if (obj.sources) patchLast(() => ({ sources: obj.sources }));
          if (obj.token) patchLast((m) => ({ content: m.content + obj.token }));
        }
      }

      if (streamErr) throw new Error(streamErr);
      patchLast(() => ({ streaming: false }));
    } catch (e) {
      // Drop an empty placeholder; keep a partial reply but stop the spinner.
      setMessages((prev) => {
        const copy = [...prev];
        const i = copy.length - 1;
        const last = copy[i];
        if (last?.role === 'assistant') {
          if (!last.content) copy.pop();
          else copy[i] = { ...last, streaming: false };
        }
        return copy;
      });
      setError(e.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className={styles.page}>

      {/* ── Top status bar ─────────────────────────────────────── */}
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <h1 className={styles.wordmark}>Serpent AI</h1>
          <span className={`${styles.wordmarkSub} ${styles.mono}`}>SERPENT&nbsp;CHAT</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>จำแนก</Link>
          <Link href="/chat" className={`${styles.navLink} ${styles.navLinkActive}`}>พูดคุยกับ Serpent AI</Link>
        </nav>
        <div className={`${styles.sysMeta} ${styles.mono}`}>
          <span className={styles.sysSpec}><b>RAG</b>&nbsp;+&nbsp;LLM</span>
          <span className={styles.statusChip}>
            <span className={styles.statusDot} aria-hidden="true" />
            SYSTEM READY
          </span>
        </div>
      </div>

      {/* ── Workspace ──────────────────────────────────────────── */}
      <div className={styles.shell}>

        {/* Left column — the chat */}
        <div className={styles.colMain}>
          <section className={`${styles.panel} ${chat.chatPanel}`} aria-label="ผู้ช่วยตอบคำถามเรื่องงู">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ CHAT · Serpent AI ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>
                {hasMessages ? String(messages.length).padStart(2, '0') : '00'}
              </span>
            </div>

            <div className={chat.log} ref={logRef} role="log" aria-live="polite">
              {!hasMessages && !loading && (
                <div className={chat.intro}>
                  <p className={chat.introTitle}>ถามอะไรก็ได้เกี่ยวกับงูในไทย</p>
                  <p className={chat.introHint}>
                    เช่น งูชนิดนี้มีพิษไหม · ถูกกัดต้องทำยังไง · เจองูในบ้านควรทำอย่างไร
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`${chat.msg} ${m.role === 'user' ? chat.msgUser : chat.msgBot}`}
                >
                  <span className={`${chat.msgRole} ${styles.mono}`}>
                    {m.role === 'user' ? 'คุณ' : 'SERPENT'}
                  </span>
                  <div className={chat.bubble}>
                    {m.role === 'assistant' && m.streaming && !m.content ? (
                      <span className={chat.typing} aria-label="กำลังพิมพ์">
                        <span /><span /><span />
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.role === 'assistant' && !m.streaming && m.sources?.length > 0 && (
                    <div className={chat.sources}>
                      {[...new Set(m.sources.map(prettySource))].filter(Boolean).map((s) => (
                        <span key={s} className={`${chat.sourceChip} ${styles.mono}`}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <div className={chat.chatError} role="alert">{error}</div>}

            <div className={chat.inputBar}>
              <textarea
                ref={textareaRef}
                className={chat.textarea}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoGrow(); }}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์คำถามเรื่องงู แล้วกด Enter"
                rows={1}
                aria-label="พิมพ์คำถาม"
              />
              <button
                type="button"
                className={chat.sendButton}
                onClick={() => send()}
                disabled={loading || !input.trim()}
              >
                ส่ง
              </button>
            </div>
          </section>
        </div>

        {/* Right column — suggestions, how-it-works, disclaimer */}
        <aside className={styles.colAside}>

          <section className={styles.panel} aria-label="คำถามตัวอย่าง">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ คำถามตัวอย่าง ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>A</span>
            </div>
            <div className={styles.panelBody}>
              <div className={chat.suggestList}>
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={chat.suggestItem}
                    onClick={() => send(q)}
                    disabled={loading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-label="ผู้ช่วยนี้ทำงานยังไง">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ ทำงานยังไง ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>B</span>
            </div>
            <div className={styles.panelBody}>
              <ol className={styles.guideList}>
                <li className={styles.guideStep}>
                  <span className={`${styles.guideNum} ${styles.mono}`}>01</span>
                  ค้นคลังความรู้งูไทยที่ตรงกับคำถาม
                </li>
                <li className={styles.guideStep}>
                  <span className={`${styles.guideNum} ${styles.mono}`}>02</span>
                  ให้โมเดลเรียบเรียงคำตอบจากข้อมูลที่ค้นได้เท่านั้น
                </li>
                <li className={styles.guideStep}>
                  <span className={`${styles.guideNum} ${styles.mono}`}>03</span>
                  เรื่องงูพิษหรือถูกกัด จะเตือนให้รีบพบแพทย์หรือโทร 1669
                </li>
              </ol>
            </div>
          </section>

          <section className={styles.panel} aria-label="ข้อควรระวัง">
            <div className={styles.panelBody}>
              <p className={styles.disclaimerText}>
                <strong>ข้อควรระวัง</strong> — ผู้ช่วยนี้เป็น AI ช่วยให้ข้อมูลเบื้องต้น
                อาจตอบผิดพลาดได้ ห้ามใช้แทนคำวินิจฉัยของแพทย์ หากถูกงูกัดหรือสงสัยว่าเป็นงูพิษ
                ให้รีบไปโรงพยาบาลหรือโทร 1669 ทันที
              </p>
            </div>
          </section>

        </aside>
      </div>

      <footer className={styles.footer}>
        <p className={styles.mono}>POWER BY BOATJWI</p>
        <p className={styles.mono}>THAI SNAKE IDENTIFIER · v1.0</p>
      </footer>
    </div>
  );
}
