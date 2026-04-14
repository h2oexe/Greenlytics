import { useEffect, useMemo, useState } from "react";
import { formatDateTimeLabel } from "../../lib/formatting";
import { apiRequest, ApiError } from "../../lib/http";
import type { DownloadUrlResponse, ExportHistoryItem, ExportResult, ExportType } from "../../types/api";

interface ExportFormState {
  type: "pdf" | "excel" | "csv";
  from: string;
  to: string;
  category: string;
  includeEnergy: boolean;
  includeWater: boolean;
  includeWaste: boolean;
  includeCarbon: boolean;
}

const exportTypes: Array<{ value: ExportFormState["type"]; label: string; helper: string }> = [
  { value: "pdf", label: "PDF", helper: "Sunum ve yönetim paylaşımı için" },
  { value: "excel", label: "Excel", helper: "Analiz ve formül tabanlı çalışma için" },
  { value: "csv", label: "CSV", helper: "Dış sistem aktarımı için" }
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExportTypeLabel(type: ExportType) {
  switch (type) {
    case 0:
      return "PDF";
    case 1:
      return "Excel";
    case 2:
      return "CSV";
    default:
      return "Dosya";
  }
}

function toApiDateTime(value: string) {
  return `${value}T12:00:00`;
}

function createInitialFormState(): ExportFormState {
  return {
    type: "pdf",
    from: "",
    to: "",
    category: "",
    includeEnergy: true,
    includeWater: true,
    includeWaste: true,
    includeCarbon: true
  };
}

export function ExportsPage() {
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ExportResult | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ExportFormState>(() => createInitialFormState());

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest<ExportHistoryItem[]>("/api/export/history");

        if (!cancelled) {
          setHistory(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Export geçmişi yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeModuleCount = useMemo(
    () =>
      [form.includeEnergy, form.includeWater, form.includeWaste, form.includeCarbon].filter(Boolean).length,
    [form.includeCarbon, form.includeEnergy, form.includeWaste, form.includeWater]
  );

  async function refreshHistory() {
    const response = await apiRequest<ExportHistoryItem[]>("/api/export/history");
    setHistory(response);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const body = {
        from: form.from ? toApiDateTime(form.from) : null,
        to: form.to ? toApiDateTime(form.to) : null,
        category: form.category.trim() || null,
        includeEnergy: form.includeEnergy,
        includeWater: form.includeWater,
        includeWaste: form.includeWaste,
        includeCarbon: form.includeCarbon
      };

      const response = await apiRequest<ExportResult>(`/api/export/${form.type}`, {
        method: "POST",
        body
      });

      setLatestResult(response);
      setSubmitSuccess(`${response.fileName} hazırlandı.`);
      await refreshHistory();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Export oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateLink(id: string) {
    setDownloadingId(id);

    try {
      const response = await apiRequest<DownloadUrlResponse>(`/api/export/${id}/download`);
      setDownloadLinks((current) => ({ ...current, [id]: response.downloadUrl }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İndirme bağlantısı oluşturulamadı.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="module-stack">
      <section className="module-grid">
        <article className="card">
          <p className="eyebrow">Raporlar</p>
          <h2>Rapor dosyalarını üret ve indir</h2>
          <p className="muted">
            Bu ekran `POST /api/export/pdf|excel|csv` ve `GET /api/export/history` akışını birlikte yönetiyor.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{history.length}</strong>
              <span>Aktif export geçmişi</span>
            </div>
            <div className="mini-card soft">
              <strong>{activeModuleCount}</strong>
              <span>Exporta dahil modüller</span>
            </div>
            <div className="mini-card soft">
              <strong>{latestResult ? getExportTypeLabel(latestResult.type) : "Hazır değil"}</strong>
              <span>Son oluşturulan çıktı</span>
            </div>
          </div>

          {latestResult ? (
            <div className="download-card">
              <strong>{latestResult.fileName}</strong>
              <span>Geçerlilik: {formatDateTimeLabel(latestResult.expiresAt)}</span>
              <a href={latestResult.downloadUrl} target="_blank" rel="noreferrer" className="download-link">
                Son exportu indir
              </a>
            </div>
          ) : (
            <p className="muted module-insight-list">Henüz bu oturumda yeni bir export oluşturulmadı.</p>
          )}
        </article>

        <article className="card">
          <p className="eyebrow">Yeni Export</p>
          <h2>Dosya oluştur</h2>
          <p className="muted">Plan uygunsa seçilen formatta rapor ve veri dışa aktarımı üretilir.</p>

          <form className="module-form" onSubmit={handleSubmit}>
            <div className="selection-grid">
              {exportTypes.map((option) => (
                <label
                  key={option.value}
                  className={form.type === option.value ? "selection-card active" : "selection-card"}
                >
                  <input
                    type="radio"
                    name="exportType"
                    value={option.value}
                    checked={form.type === option.value}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        type: option.value
                      }))
                    }
                  />
                  <strong>{option.label}</strong>
                  <span>{option.helper}</span>
                </label>
              ))}
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Başlangıç</span>
                <input
                  type="date"
                  value={form.from}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      from: event.target.value
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Bitiş</span>
                <input
                  type="date"
                  value={form.to}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      to: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>Kategori filtresi</span>
              <input
                type="text"
                placeholder="Opsiyonel kategori veya alt kategori"
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value
                  }))
                }
              />
            </label>

            <div className="checkbox-grid">
              <label className="check-card">
                <input
                  type="checkbox"
                  checked={form.includeEnergy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      includeEnergy: event.target.checked
                    }))
                  }
                />
                <span>Enerji</span>
              </label>

              <label className="check-card">
                <input
                  type="checkbox"
                  checked={form.includeWater}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      includeWater: event.target.checked
                    }))
                  }
                />
                <span>Su</span>
              </label>

              <label className="check-card">
                <input
                  type="checkbox"
                  checked={form.includeWaste}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      includeWaste: event.target.checked
                    }))
                  }
                />
                <span>Atık</span>
              </label>

              <label className="check-card">
                <input
                  type="checkbox"
                  checked={form.includeCarbon}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      includeCarbon: event.target.checked
                    }))
                  }
                />
                <span>Karbon</span>
              </label>
            </div>

            {submitError ? <p className="error-banner">{submitError}</p> : null}
            {submitSuccess ? <p className="success-banner">{submitSuccess}</p> : null}

            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Hazırlanıyor..." : "Export oluştur"}
            </button>
          </form>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Geçmiş</p>
            <h2>Oluşturulan dosyalar</h2>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>Export geçmişi yükleniyor</strong>
            <span>Daha önce oluşturulan dosyalar listeleniyor.</span>
          </div>
        ) : null}

        {!loading && error ? <p className="error-banner">{error}</p> : null}

        {!loading && !error && history.length === 0 ? (
          <div className="empty-state">
            <strong>Export geçmişi boş</strong>
            <span>İlk raporu oluşturduğunda burada indirilebilir dosya geçmişi göreceksin.</span>
          </div>
        ) : null}

        {!loading && !error && history.length > 0 ? (
          <div className="entry-list">
            {history.map((item) => (
              <article key={item.id} className="entry-card">
                <div className="entry-card-header">
                  <div>
                    <strong>{item.fileName}</strong>
                    <p className="muted">{getExportTypeLabel(item.exportType)} exportu</p>
                  </div>
                  <div className="entry-side">
                    <span className="entry-pill">{formatFileSize(item.fileSizeBytes)}</span>
                    <span className="entry-value">{getExportTypeLabel(item.exportType)}</span>
                  </div>
                </div>

                <div className="entry-meta">
                  <span>Oluşturma: {formatDateTimeLabel(item.createdAt)}</span>
                  <span>Bitiş: {formatDateTimeLabel(item.expiresAt)}</span>
                </div>

                <div className="history-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleGenerateLink(item.id)}
                    disabled={downloadingId === item.id}
                  >
                    {downloadingId === item.id ? "Bağlantı alınıyor..." : "İndirme bağlantısı al"}
                  </button>

                  {downloadLinks[item.id] ? (
                    <a
                      href={downloadLinks[item.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="download-link"
                    >
                      Dosyayı indir
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
