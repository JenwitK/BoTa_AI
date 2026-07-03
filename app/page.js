'use client';

import { useState, useRef, useCallback } from 'react';
import { ImageUp, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILE_MB = MAX_FILE_SIZE / 1024 / 1024;
const API_URL = '/api/predict';
const LOW_CONFIDENCE_THRESHOLD = 0.75;
const EMERGENCY_NUMBER = '1669';

// Model lineup — like Claude's tiers. Add a checkpoint + flip `available`
// to true to ship a new one. `id` is sent to the backend as the `model` field.
const MODELS = [
  {
    id: 'serpent-1.0',
    name: 'Serpent 1.0',
    tier: 'แม่นยำ',
    arch: 'ConvNeXtV2-Tiny',
    resolution: '384 × 384 px',
    desc: 'โมเดลหลัก ความแม่นยำสูง เหมาะกับงานทั่วไป',
    available: true,
  },
  {
    id: 'serpent-lite',
    name: 'Serpent Lite',
    tier: 'เร็ว',
    arch: '—',
    resolution: '—',
    desc: 'เบาและเร็ว เหมาะกับมือถือ',
    available: false,
  },
  {
    id: 'serpent-pro',
    name: 'Serpent Pro',
    tier: 'แม่นสุด',
    arch: '—',
    resolution: '—',
    desc: 'ละเอียดสูงสุด สำหรับเคสยาก',
    available: false,
  },
];

const formatConfidence = (c) => {
  const pct = c * 100;
  if (pct >= 100) return '99.9%';
  return `${pct.toFixed(1)}%`;
};

const barPct = (c) => `${Math.min(c * 100, 99.9).toFixed(1)}%`;

export default function Home() {
  const [status, setStatus]           = useState('idle');
  const [preview, setPreview]         = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [inferenceMs, setInferenceMs] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [modelId, setModelId] = useState('serpent-1.0');

  const fileInputRef = useRef(null);
  const dragCounter  = useRef(0);

  const selectedModel = MODELS.find((m) => m.id === modelId) ?? MODELS[0];

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type))
      return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
    if (file.size > MAX_FILE_SIZE)
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_MB} MB.`;
    return null;
  };

  const processFile = useCallback(async (file) => {
    const err = validateFile(file);
    if (err) { setStatus('error'); setErrorMessage(err); return; }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setPredictions([]);
    setInferenceMs(null);
    setStatus('analyzing');

    const body = new FormData();
    body.append('image', file);
    body.append('model', modelId);

    try {
      const res = await fetch(API_URL, { method: 'POST', body });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Server error ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Prediction failed.');

      setPredictions(json.predictions);
      setInferenceMs(json.inference_ms);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      const isOffline = e instanceof TypeError && e.message.toLowerCase().includes('fetch');
      setErrorMessage(
        isOffline
          ? `Cannot reach the AI backend. Make sure the FastAPI server is running at ${API_URL}.`
          : e.message || 'An unexpected error occurred.'
      );
    }
  }, [preview, modelId]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (status !== 'dragging') setStatus('dragging');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setStatus('idle');
  };

  const handleDragOver  = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPredictions([]);
    setInferenceMs(null);
    setErrorMessage('');
    setStatus('idle');
    dragCounter.current = 0;
  };

  const isProcessing = status === 'analyzing';
  const padRank = (n) => String(n).padStart(2, '0');
  const hasResult = status === 'success' && predictions.length > 0;
  const venomousDetected = hasResult && predictions.some(p => p.isVenomous);

  return (
    <div className={styles.page}>

      {/* ── Top status bar ─────────────────────────────────────── */}
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <h1 className={styles.wordmark}>จำแนกงู</h1>
          <span className={`${styles.wordmarkSub} ${styles.mono}`}>SNAKE&nbsp;ID</span>
        </div>
        <div className={`${styles.sysMeta} ${styles.mono}`}>
          <span className={styles.sysSpec}>131&nbsp;<b>SPECIES</b></span>
          <span className={styles.sysSpec}><b>{selectedModel.name}</b></span>
          <span className={styles.statusChip}>
            <span className={styles.statusDot} aria-hidden="true" />
            SYSTEM READY
          </span>
        </div>
      </div>

      {/* ── Workspace ──────────────────────────────────────────── */}
      <div className={styles.shell}>

        {/* Left column — model + input + output */}
        <div className={styles.colMain}>

          <section className={styles.panel} aria-label="เลือกโมเดล">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ MODEL · เลือกโมเดล ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>00</span>
            </div>
            <div className={styles.modelGrid} role="radiogroup" aria-label="เลือกโมเดล AI">
              {MODELS.map((m) => {
                const active = m.id === modelId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!m.available}
                    onClick={() => m.available && setModelId(m.id)}
                    className={[
                      styles.modelCard,
                      active && styles.modelCardActive,
                      !m.available && styles.modelCardDisabled,
                    ].filter(Boolean).join(' ')}
                  >
                    <span className={styles.modelCardTop}>
                      <span className={styles.modelName}>{m.name}</span>
                      {m.available ? (
                        <span className={`${styles.modelTier} ${styles.mono}`}>{m.tier}</span>
                      ) : (
                        <span className={`${styles.modelSoon} ${styles.mono}`}>เร็ว ๆ นี้</span>
                      )}
                    </span>
                    <span className={styles.modelDesc}>{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.panel} aria-label="อัปโหลดภาพ">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ INPUT · อัปโหลดภาพ ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>01</span>
            </div>

            <div
              className={[
                styles.uploadZone,
                status === 'dragging' && styles.uploadZoneDragging,
                isProcessing          && styles.uploadZoneProcessing,
              ].filter(Boolean).join(' ')}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              role="button"
              tabIndex={isProcessing ? -1 : 0}
              aria-label="อัปโหลดรูปงู — คลิกหรือลากไฟล์มาวาง"
              onKeyDown={(e) => e.key === 'Enter' && !isProcessing && fileInputRef.current?.click()}
            >
              <span className={`${styles.corner} ${styles.cornerTL}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.cornerTR}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.cornerBL}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.cornerBR}`} aria-hidden="true" />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInput}
                className={styles.hiddenInput}
                aria-hidden="true"
                tabIndex={-1}
              />

              {preview ? (
                <img src={preview} alt="ภาพงูที่อัปโหลด" className={styles.previewImage} />
              ) : (
                <div className={styles.uploadPlaceholder}>
                  <span className={styles.uploadMark} aria-hidden="true">
                    <ImageUp size={32} strokeWidth={1.4} />
                  </span>
                  <p className={styles.uploadPrimary}>
                    {status === 'dragging' ? 'วางเพื่ออัปโหลด' : 'ลากรูปงูมาวางที่นี่'}
                  </p>
                  <p className={styles.uploadSecondary}>หรือคลิกเพื่อเลือกไฟล์</p>
                  <span className={`${styles.uploadHint} ${styles.mono}`}>
                    JPEG · PNG · WEBP — ≤ 20 MB
                  </span>
                </div>
              )}

              {isProcessing && (
                <div className={styles.processingOverlay} role="status" aria-live="polite">
                  <p className={`${styles.processingLabel} ${styles.mono}`}>กำลังวิเคราะห์</p>
                  <div className={styles.scanBar} aria-hidden="true" />
                </div>
              )}
            </div>
          </section>

          {status === 'error' && (
            <div className={styles.errorMessage} role="alert">
              <span className={`${styles.errorTag} ${styles.mono}`}>ERROR</span>
              <span>{errorMessage}</span>
              <button className={styles.retryButton} onClick={handleReset}>
                ลองใหม่
              </button>
            </div>
          )}

          {/* Output panel — always present so the layout never feels empty */}
          <section className={styles.panel} aria-label="ผลการจำแนก">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ OUTPUT · ผลการจำแนก ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>
                {hasResult && inferenceMs !== null ? `${inferenceMs.toFixed(0)} MS` : '02'}
              </span>
            </div>

            {venomousDetected && (
              <a
                href={`tel:${EMERGENCY_NUMBER}`}
                className={styles.emergencyButton}
                aria-label={`โทรฉุกเฉิน ${EMERGENCY_NUMBER}`}
              >
                <span>⚠ พบงูพิษ — โทรฉุกเฉิน {EMERGENCY_NUMBER}</span>
                <ArrowRight className={styles.emergencyArrow} size={18} strokeWidth={2} />
              </a>
            )}

            {hasResult ? (
              <>
                <ul className={styles.predictionList} role="list">
                  {predictions.map((pred, index) => {
                    const isTop = index === 0;
                    const displayName = pred.commonName !== pred.species
                      ? pred.commonName
                      : null;
                    const isLowConf  = pred.confidence < LOW_CONFIDENCE_THRESHOLD;
                    const displayPct = formatConfidence(pred.confidence);

                    const tagClass = pred.isVenomous
                      ? styles.venomousYes
                      : isLowConf ? styles.venomousUncertain : styles.venomousNo;
                    const tagText = pred.isVenomous
                      ? 'งูพิษ'
                      : isLowConf ? 'ไม่แน่ใจ' : 'ไม่มีพิษ';
                    const tagAriaLabel = pred.isVenomous
                      ? 'งูมีพิษ'
                      : isLowConf ? 'ความเชื่อมั่นต่ำ' : 'งูไม่มีพิษ';

                    return (
                      <li
                        key={pred.rank}
                        className={[
                          styles.predictionItem,
                          isTop && styles.predictionItemTop,
                        ].filter(Boolean).join(' ')}
                      >
                        <div className={styles.predictionHeader}>
                          <span
                            className={`${styles.predictionRank} ${styles.mono}`}
                            aria-label={`อันดับ ${pred.rank}`}
                          >
                            {padRank(pred.rank)}
                          </span>

                          <div className={styles.predictionNames}>
                            <span className={styles.predictionCommon}>
                              {displayName || pred.species}
                            </span>
                            {displayName && (
                              <span className={styles.predictionSpecies}>{pred.species}</span>
                            )}
                          </div>

                          <span className={`${styles.confidencePct} ${styles.mono}`}>
                            {displayPct}
                          </span>
                        </div>

                        <div className={styles.statusRow}>
                          <span
                            className={`${styles.venomTag} ${tagClass}`}
                            aria-label={tagAriaLabel}
                          >
                            {tagText}
                          </span>
                          <div
                            className={styles.confidenceTrack}
                            role="progressbar"
                            aria-valuenow={displayPct}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-label={`ความเชื่อมั่น ${displayPct}`}
                          >
                            <div
                              className={styles.confidenceFill}
                              style={{ '--pct': barPct(pred.confidence) }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <button className={styles.resetButton} onClick={handleReset}>
                  จำแนกงูตัวใหม่
                </button>
              </>
            ) : (
              <p className={`${styles.emptyOutput} ${styles.mono}`}>
                {isProcessing ? 'กำลังประมวลผล…' : 'ยังไม่มีผล — อัปโหลดภาพเพื่อเริ่มวิเคราะห์'}
              </p>
            )}
          </section>
        </div>

        {/* Right column — guide, legend, spec */}
        <aside className={styles.colAside}>

          <section className={styles.panel} aria-label="วิธีใช้งาน">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ คู่มือด่วน ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>A</span>
            </div>
            <div className={styles.panelBody}>
              <ol className={styles.guideList}>
                <li className={styles.guideStep}>
                  <span className={`${styles.guideNum} ${styles.mono}`}>01</span>
                  ถ่ายหรือเลือกรูปงูที่เห็นหัว ลำตัว และลายชัดเจน
                </li>
                <li className={styles.guideStep}>
                  <span className={`${styles.guideNum} ${styles.mono}`}>02</span>
                  ลากภาพลงช่อง INPUT หรือคลิกเพื่อเลือกไฟล์
                </li>
                <li className={styles.guideStep}>
                  <span className={`${styles.guideNum} ${styles.mono}`}>03</span>
                  อ่านผลและระดับความเชื่อมั่นในช่อง OUTPUT
                </li>
              </ol>
            </div>
          </section>

          <section className={styles.panel} aria-label="สัญลักษณ์">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ สัญลักษณ์ ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>B</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotDanger}`} /> งูพิษ — อันตราย ควรระวัง
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotSafe}`} /> ไม่มีพิษ — ปลอดภัย
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotWarn}`} /> ไม่แน่ใจ — ความเชื่อมั่นต่ำ
                </span>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-label="ข้อมูลระบบ">
            <div className={styles.panelHead}>
              <span className={`${styles.panelLabel} ${styles.mono}`}>[ ข้อมูลโมเดล ]</span>
              <span className={`${styles.panelIndex} ${styles.mono}`}>C</span>
            </div>
            <div className={styles.panelBody}>
              <div className={`${styles.specGrid} ${styles.mono}`}>
                <span className={styles.specKey}>Model</span>
                <span className={styles.specVal}>{selectedModel.name}</span>
                <span className={styles.specKey}>Arch</span>
                <span className={styles.specVal}>{selectedModel.arch}</span>
                <span className={styles.specKey}>Input</span>
                <span className={styles.specVal}>{selectedModel.resolution}</span>
                <span className={styles.specKey}>Classes</span>
                <span className={styles.specVal}>131 species</span>
                <span className={styles.specKey}>Region</span>
                <span className={styles.specVal}>Thailand</span>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-label="ข้อควรระวัง">
            <div className={styles.panelBody}>
              <p className={styles.disclaimerText}>
                <strong>ข้อควรระวัง</strong> — ระบบนี้เป็นเครื่องมือช่วยจำแนกและอาจผิดพลาดได้
                ห้ามใช้ผลลัพธ์ตัดสินใจในสถานการณ์อันตราย หากสงสัยว่าเป็นงูมีพิษ
                ให้รักษาระยะห่างและติดต่อผู้เชี่ยวชาญทันที
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
