'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, ScanLine, Zap } from 'lucide-react';
import styles from './page.module.css';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const API_URL = '/api/predict';
const LOW_CONFIDENCE_THRESHOLD = 0.75;
const EMERGENCY_NUMBER = '1669';

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

  const fileInputRef = useRef(null);
  const dragCounter  = useRef(0);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type))
      return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
    if (file.size > MAX_FILE_SIZE)
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`;
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
  }, [preview]);

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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIcon}>
          <img
            src="/snakeIcoAI.ico"
            alt="Snake Identifier AI logo"
            width={64}
            height={64}
          />
        </div>
        <h1 className={styles.title}>Snake Identifier</h1>
        <div className={styles.headerDivider} aria-hidden="true" />
        <p className={styles.subtitle}>
          วิเคราะห์สายพันธุ์งูด้วย AI &nbsp;·&nbsp; รวดเร็ว แม่นยำ และปลอดภัย
        </p>
        <div className={styles.featurePills} aria-hidden="true">
          <span className={styles.featurePill}>
            <Camera size={13} strokeWidth={2} />
            ภาพชัดเจน
          </span>
          <span className={styles.featurePill}>
            <ScanLine size={13} strokeWidth={2} />
            หัว · ลำตัว · หาง
          </span>
          <span className={styles.featurePill}>
            <Zap size={13} strokeWidth={2} />
            ผลทันที
          </span>
        </div>
      </header>

      <main className={styles.main}>

        <section
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
          aria-label="Upload snake image — click or drag and drop"
          onKeyDown={(e) => e.key === 'Enter' && !isProcessing && fileInputRef.current?.click()}
        >
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
            <img src={preview} alt="Uploaded snake preview" className={styles.previewImage} />
          ) : (
            <div className={styles.uploadPlaceholder}>
              <div className={styles.uploadIcon} aria-hidden="true">
                {status === 'dragging' ? '📂' : '📁'}
              </div>
              <p className={styles.uploadPrimary}>
                {status === 'dragging' ? 'Release to upload' : 'Drag & drop your image here'}
              </p>
              <p className={styles.uploadSecondary}>or click to browse files</p>
              <span className={styles.uploadHint}>JPEG · PNG · WebP &nbsp;·&nbsp; Max 5 MB</span>
            </div>
          )}

          {isProcessing && (
            <div className={styles.processingOverlay} role="status" aria-live="polite">
              <div className={styles.spinner} aria-hidden="true" />
              <p className={styles.processingLabel}>Analyzing species…</p>
            </div>
          )}
        </section>

        {status === 'error' && (
          <div className={styles.errorMessage} role="alert">
            <span className={styles.errorIcon} aria-hidden="true">⚠</span>
            <span>{errorMessage}</span>
            <button className={styles.retryButton} onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}

        {status === 'success' && predictions.length > 0 && (
          <>
          <article className={styles.resultCard} aria-label="Identification results">

            <div className={styles.resultCardHeader}>
              <h2 className={styles.resultCardTitle}>Top Predictions</h2>
              {inferenceMs !== null && (
                <span className={styles.inferenceTime}>
                  ⚡ {inferenceMs.toFixed(0)} ms
                </span>
              )}
            </div>

            <ul className={styles.predictionList} role="list">
              {predictions.map((pred, index) => {
                const isTop = index === 0;
                const displayName = pred.commonName !== pred.species
                  ? pred.commonName
                  : null;
                const isLowConf  = pred.confidence < LOW_CONFIDENCE_THRESHOLD;
                const displayPct = formatConfidence(pred.confidence);

                const badgeClass = pred.isVenomous
                  ? styles.venomousYes
                  : isLowConf ? styles.venomousUncertain : styles.venomousNo;
                const badgeIcon = pred.isVenomous ? '☠' : isLowConf ? '?' : '✔';
                const badgeText = pred.isVenomous
                  ? 'Venomous'
                  : isLowConf ? 'ไม่แน่ใจ (Low Confidence)' : 'Safe';
                const badgeAriaLabel = pred.isVenomous
                  ? 'Venomous species'
                  : isLowConf ? 'Uncertain — low confidence' : 'Non-venomous species';

                return (
                  <li
                    key={pred.rank}
                    className={[
                      styles.predictionItem,
                      isTop && styles.predictionItemTop,
                    ].filter(Boolean).join(' ')}
                  >
                    <div className={styles.predictionHeader}>
                      <span className={styles.predictionRank} aria-label={`Rank ${pred.rank}`}>
                        #{pred.rank}
                      </span>

                      <div className={styles.predictionNames}>
                        <span className={styles.predictionCommon}>
                          {displayName || pred.species}
                        </span>
                        {displayName && (
                          <span className={styles.predictionSpecies}>{pred.species}</span>
                        )}
                      </div>

                      <div
                        className={`${styles.venomousBadge} ${badgeClass}`}
                        aria-label={badgeAriaLabel}
                      >
                        <span aria-hidden="true">{badgeIcon}</span>
                        {badgeText}
                      </div>
                    </div>

                    <div className={styles.confidenceRow}>
                      <div
                        className={styles.confidenceTrack}
                        role="progressbar"
                        aria-valuenow={displayPct}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label={`Confidence ${displayPct}`}
                      >
                        <div
                          className={styles.confidenceFill}
                          style={{ '--pct': barPct(pred.confidence) }}
                        />
                      </div>
                      <span className={styles.confidencePct}>{displayPct}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {predictions.some(p => p.isVenomous) && (
              <a
                href={`tel:${EMERGENCY_NUMBER}`}
                className={styles.emergencyButton}
                aria-label={`Emergency contact — call ${EMERGENCY_NUMBER}`}
              >
                <span aria-hidden="true"></span>
                ติดต่อเจ้าหน้าที่ฉุกเฉิน — โทร {EMERGENCY_NUMBER}
              </a>
            )}

            <button className={styles.resetButton} onClick={handleReset}>
              Identify Another Snake
            </button>
          </article>

          <div className={styles.disclaimerBox} role="note" aria-label="Safety disclaimer">
            <span className={styles.disclaimerIcon} aria-hidden="true">!</span>
            <p className={styles.disclaimerText}>
              <strong>Bota</strong> เป็นเพียงระบบ AI และอาจเกิดข้อผิดพลาดได้
              ห้ามใช้ผลลัพธ์นี้ตัดสินใจในสถานการณ์อันตราย
              หากสงสัยว่าเป็นงูมีพิษ ให้รักษาระยะห่างและติดต่อผู้เชี่ยวชาญทันที
            </p>
          </div>
        </>
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          Power By BoatJwi On top
        </p>
      </footer>
    </div>
  );
}
