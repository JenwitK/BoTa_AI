import { NextResponse } from 'next/server';

// Stream must not be statically optimized or buffered by Next.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Backend selector: set CHAT_API_URL in .env.local (or Vercel env) to the
// Serpent Chat Space, e.g. https://<user>-serpent-chat.hf.space/chat
const CHAT_API_URL =
  process.env.CHAT_API_URL || 'https://botaai-serpent-chat.hf.space/chat';

// The streaming endpoint lives next to the plain one (.../chat -> .../chat/stream).
const CHAT_STREAM_URL = CHAT_API_URL.replace(/\/chat\/?$/, '/chat/stream');

// Cap only how long we wait to *connect* (the Space may be cold). Once tokens
// start flowing we let the stream run to completion.
const CONNECT_TIMEOUT_MS = 180_000;

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'ไม่สามารถอ่านข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 400 }
    );
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'กรุณาพิมพ์คำถาม' }, { status: 400 });
  }

  const history = Array.isArray(payload?.history) ? payload.history.slice(-6) : [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(CHAT_STREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err?.name === 'AbortError';
    console.error('[POST /api/chat] connect error:', err);
    return NextResponse.json(
      {
        error: aborted
          ? 'ผู้ช่วยงูใช้เวลานานเกินไป (เซิร์ฟเวอร์อาจกำลังตื่น) ลองใหม่อีกครั้ง'
          : 'เชื่อมต่อผู้ช่วยงูไม่ได้ ลองใหม่อีกครั้ง',
      },
      { status: aborted ? 504 : 500 }
    );
  }
  // Connected — the body will stream on its own; stop the connect timer.
  clearTimeout(timer);

  if (!res.ok || !res.body) {
    console.error('[Serpent Chat Error]:', res.status);
    return NextResponse.json(
      { error: `ผู้ช่วยงูขัดข้องชั่วคราว (Error ${res.status})` },
      { status: res.status || 502 }
    );
  }

  // Pass the upstream token stream straight through, unbuffered.
  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
