import { NextResponse } from 'next/server';

// Backend selector: set PREDICT_API_URL in .env.local to test a local model
// (e.g. http://localhost:8000/predict); falls back to the HF Space in prod.
const PREDICT_API_URL =
  process.env.PREDICT_API_URL || 'https://botaai-bota-api.hf.space/predict';

export async function POST(request) {
  try {
    // 1. รับข้อมูลจากหน้าเว็บ
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถอ่านข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    const imageFile = formData.get('image');

    if (!imageFile || typeof imageFile === 'string') {
      return NextResponse.json(
        { success: false, error: 'ไม่พบไฟล์รูปภาพ กรุณาอัปโหลดรูปภาพที่ถูกต้อง' },
        { status: 400 }
      );
    }

    // 2. ส่งรูปภาพข้ามไปให้ Hugging Face ประมวลผล (ตรงนี้แหละคือจุดเชื่อมต่อ!)
    const hfResponse = await fetch(PREDICT_API_URL, {
      method: 'POST',
      body: formData, // ส่งรูปแบบตรงๆ ไปเลย
    });

    // ถ้าระบบ Hugging Face มีปัญหา (เช่น เซิร์ฟเวอร์หลับ หรือ Error)
    if (!hfResponse.ok) {
      console.error('[Hugging Face Error]:', hfResponse.status);
      return NextResponse.json(
        { success: false, error: `ระบบ AI ขัดข้องชั่วคราว (Error ${hfResponse.status})` },
        { status: hfResponse.status }
      );
    }

    // 3. รับผลลัพธ์ของจริงจาก AI แล้วส่งกลับไปโชว์ที่หน้าเว็บ
    const data = await hfResponse.json();
    return NextResponse.json(data);

  } catch (err) {
    console.error('[POST /api/predict] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}

// ป้องกันคนเข้าผ่าน URL พิมพ์ตรงๆ
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}