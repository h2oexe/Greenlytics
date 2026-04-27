import { useEffect, useMemo, useState } from "react";
import { formatDateTimeLabel } from "../../lib/formatting";
import { apiRequest, ApiError } from "../../lib/http";
import type { DownloadUrlResponse, ExportHistoryItem, ExportResult, ExportType } from "../../types/api";
import { useFeedback } from "../../ui/feedback-context";
import { EmptyState, ErrorState, LoadingState } from "../../ui/state-blocks";

type ReportingFrameworkKey = "ISSB" | "GRI" | "SASB" | "TCFD" | "CDP" | "IR" | "ESRS";

interface ExportFormState {
  type: "pdf" | "excel" | "csv";
  from: string;
  to: string;
  category: string;
  includeEnergy: boolean;
  includeWater: boolean;
  includeWaste: boolean;
  includeCarbon: boolean;
  reportTitle: string;
  companyDisplayName: string;
  preparedBy: string;
  reportDate: string;
  coverTagline: string;
  executiveSummary: string;
  socialHighlights: string;
  governanceHighlights: string;
  futureTargets: string;
  conclusion: string;
  logoDataUrl: string | null;
  logoFileName: string;
  reportingFrameworks: ReportingFrameworkKey[];
}

const exportTypes: Array<{ value: ExportFormState["type"]; label: string; helper: string }> = [
  { value: "pdf", label: "PDF", helper: "Kapak, ESG akisi ve grafiklerle profesyonel rapor" },
  { value: "excel", label: "Excel", helper: "Analiz ve formul tabanli calisma icin" },
  { value: "csv", label: "CSV", helper: "Dis sistem aktarmi ve ham veri cikisi icin" }
];

const reportingFrameworkOptions: Array<{
  value: ReportingFrameworkKey;
  title: string;
  helper: string;
}> = [
  { value: "ISSB", title: "ISSB / IFRS S1-S2", helper: "Genel surdurulebilirlik ve iklim aciklamalari" },
  { value: "GRI", title: "GRI", helper: "Etki ve paydas etkisi odakli anlatim" },
  { value: "SASB", title: "SASB", helper: "Finansal risk ve sektore ozel metrikler" },
  { value: "TCFD", title: "TCFD", helper: "Iklim riski, yonetisim ve senaryo bakisi" },
  { value: "CDP", title: "CDP", helper: "Karbon ve su disclosure hazirligi" },
  { value: "IR", title: "Integrated Reporting", helper: "Finansal ve ESG hikayesini birlestirir" },
  { value: "ESRS", title: "ESRS", helper: "AB uyumlu cift onemlilik yapisi" }
];

const pdfSections = [
  "Kapak",
  "Icindekiler",
  "Yonetici Ozeti",
  "ESG Bolumleri",
  "Grafikler ve kirilimlar",
  "Sonuc ve gelecek hedefler"
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Logo okunamadi."));
    };

    reader.onerror = () => {
      reject(new Error("Logo okunamadi."));
    };

    reader.readAsDataURL(file);
  });
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
    includeCarbon: true,
    reportTitle: "Kurumsal ESG Performans Raporu",
    companyDisplayName: "",
    preparedBy: "",
    reportDate: new Date().toISOString().slice(0, 10),
    coverTagline: "Surdurulebilirlik performansi, riskleri ve sonraki donem hedefleri",
    executiveSummary: "",
    socialHighlights: "",
    governanceHighlights: "",
    futureTargets: "",
    conclusion: "",
    logoDataUrl: null,
    logoFileName: "",
    reportingFrameworks: reportingFrameworkOptions.map((option) => option.value)
  };
}

export function ExportsPage() {
  const { showToast } = useFeedback();
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
          setError(err instanceof ApiError ? err.message : "Export gecmisi yuklenemedi.");
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

  const selectedFrameworkCount = form.reportingFrameworks.length;

  async function refreshHistory() {
    const response = await apiRequest<ExportHistoryItem[]>("/api/export/history");
    setHistory(response);
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setSubmitError("Logo dosyasi en fazla 1.5 MB olabilir.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((current) => ({
        ...current,
        logoDataUrl: dataUrl,
        logoFileName: file.name
      }));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Logo okunamadi.");
    }
  }

  function handleFrameworkToggle(value: ReportingFrameworkKey) {
    setForm((current) => {
      const isSelected = current.reportingFrameworks.includes(value);

      return {
        ...current,
        reportingFrameworks: isSelected
          ? current.reportingFrameworks.filter((item) => item !== value)
          : [...current.reportingFrameworks, value]
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    if (form.type === "pdf" && form.reportingFrameworks.length === 0) {
      setSubmitError("PDF raporu icin en az bir raporlama standardi sec.");
      setSubmitting(false);
      return;
    }

    try {
      const body = {
        from: form.from ? toApiDateTime(form.from) : null,
        to: form.to ? toApiDateTime(form.to) : null,
        category: form.category.trim() || null,
        includeEnergy: form.includeEnergy,
        includeWater: form.includeWater,
        includeWaste: form.includeWaste,
        includeCarbon: form.includeCarbon,
        reportTitle: form.type === "pdf" ? form.reportTitle.trim() || null : null,
        companyDisplayName: form.type === "pdf" ? form.companyDisplayName.trim() || null : null,
        preparedBy: form.type === "pdf" ? form.preparedBy.trim() || null : null,
        reportDate: form.type === "pdf" && form.reportDate ? toApiDateTime(form.reportDate) : null,
        coverTagline: form.type === "pdf" ? form.coverTagline.trim() || null : null,
        executiveSummary: form.type === "pdf" ? form.executiveSummary.trim() || null : null,
        socialHighlights: form.type === "pdf" ? form.socialHighlights.trim() || null : null,
        governanceHighlights: form.type === "pdf" ? form.governanceHighlights.trim() || null : null,
        futureTargets: form.type === "pdf" ? form.futureTargets.trim() || null : null,
        conclusion: form.type === "pdf" ? form.conclusion.trim() || null : null,
        logoDataUrl: form.type === "pdf" ? form.logoDataUrl : null,
        reportingFrameworks: form.type === "pdf" ? form.reportingFrameworks : []
      };

      const response = await apiRequest<ExportResult>(`/api/export/${form.type}`, {
        method: "POST",
        body
      });

      setLatestResult(response);
      await refreshHistory();
      showToast({
        title: "Export hazirlandi",
        message: response.fileName,
        tone: "success"
      });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Export olusturulamadi.");
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
      setError(err instanceof ApiError ? err.message : "Indirme baglantisi olusturulamadi.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="module-stack">
      <section className="module-grid">
        <article className="card">
          <p className="eyebrow">Raporlar</p>
          <h2>Profesyonel ESG ciktilari uret</h2>
          <p className="muted">
            PDF akisi artik kapak, secilen standartlar, ESG bolumleri, grafikler ve gelecek hedefleriyle
            yonetim seviyesi sunuma uygun cikti verecek.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{history.length}</strong>
              <span>Aktif export gecmisi</span>
            </div>
            <div className="mini-card soft">
              <strong>{activeModuleCount}</strong>
              <span>Raporlanan ESG veri modulu</span>
            </div>
            <div className="mini-card soft">
              <strong>{form.type === "pdf" ? selectedFrameworkCount : getExportTypeLabel(latestResult?.type ?? 0)}</strong>
              <span>{form.type === "pdf" ? "Secili raporlama standardi" : "Son olusturulan cikti tipi"}</span>
            </div>
          </div>

          {latestResult ? (
            <div className="download-card">
              <strong>{latestResult.fileName}</strong>
              <span>Gecerlilik: {formatDateTimeLabel(latestResult.expiresAt)}</span>
              <a href={latestResult.downloadUrl} target="_blank" rel="noreferrer" className="download-link">
                Son exportu indir
              </a>
            </div>
          ) : (
            <p className="muted module-insight-list">Bu oturumda henuz yeni bir export uretilmedi.</p>
          )}

          {form.type === "pdf" ? (
            <div className="smart-card report-preview-card">
              <span className="smart-card-title">PDF icerigi</span>
              <div className="report-preview-list">
                {pdfSections.map((section) => (
                  <span key={section} className="feature-chip active">
                    {section}
                  </span>
                ))}
              </div>
              <p className="smart-card-description">
                Logo, rapor tarihi, secilen standartlar ve yonetici ozetleriyle daha kurumsal bir dokuman
                olusturulur.
              </p>
            </div>
          ) : null}
        </article>

        <article className="card">
          <p className="eyebrow">Yeni Export</p>
          <h2>Dosya olustur</h2>
          <p className="muted">Format sec, kapsam belirle ve gerekiyorsa PDF icin rapor briefini doldur.</p>

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
                <span>Baslangic</span>
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
                <span>Bitis</span>
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
                placeholder="Opsiyonel kategori, alt kategori veya kaynak"
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
                <span>Atik</span>
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

            {form.type === "pdf" ? (
              <>
                <div className="report-section-block">
                  <p className="section-label">Kapak bilgileri</p>
                  <div className="field-grid">
                    <label className="field">
                      <span>Rapor basligi</span>
                      <input
                        type="text"
                        value={form.reportTitle}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reportTitle: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Sirket gorunen adi</span>
                      <input
                        type="text"
                        placeholder="Bos birakirsan sistemdeki sirket adi kullanilir"
                        value={form.companyDisplayName}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            companyDisplayName: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="field-grid">
                    <label className="field">
                      <span>Hazirlayan</span>
                      <input
                        type="text"
                        placeholder="Ornek: Sustainability Office"
                        value={form.preparedBy}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            preparedBy: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Rapor tarihi</span>
                      <input
                        type="date"
                        value={form.reportDate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reportDate: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Kapak alt basligi</span>
                    <input
                      type="text"
                      value={form.coverTagline}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          coverTagline: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Sirket logosu</span>
                    <div className="file-upload-shell">
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} />
                      <small className="muted">PNG, JPG veya WEBP. En fazla 1.5 MB.</small>
                      {form.logoFileName ? (
                        <div className="file-upload-meta">
                          <strong>{form.logoFileName}</strong>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                logoDataUrl: null,
                                logoFileName: ""
                              }))
                            }
                          >
                            Kaldir
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </label>
                </div>

                <div className="report-section-block">
                  <div className="section-header">
                    <div className="section-header-copy">
                      <p className="section-label">Raporlama standartlari</p>
                      <p className="muted">
                        PDF icinde secilen standartlara gore uyum notlari ve profesyonel bolum basliklari olusturulur.
                      </p>
                    </div>
                  </div>

                  <div className="report-framework-grid">
                    {reportingFrameworkOptions.map((framework) => {
                      const isActive = form.reportingFrameworks.includes(framework.value);

                      return (
                        <button
                          key={framework.value}
                          type="button"
                          className={isActive ? "report-framework-card active" : "report-framework-card"}
                          onClick={() => handleFrameworkToggle(framework.value)}
                        >
                          <strong>{framework.title}</strong>
                          <span>{framework.helper}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="report-section-block">
                  <p className="section-label">Yonetici ozeti ve ESG anlatimi</p>

                  <label className="field">
                    <span>Yonetici ozeti</span>
                    <textarea
                      rows={4}
                      className="textarea-tall"
                      placeholder="Bu rapor doneminde one cikan performans, risk, iyilesme ve yonetim mesaji"
                      value={form.executiveSummary}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          executiveSummary: event.target.value
                        }))
                      }
                    />
                  </label>

                  <div className="field-grid">
                    <label className="field">
                      <span>Sosyal bolum notlari</span>
                      <textarea
                        rows={5}
                        className="textarea-tall"
                        placeholder="Calisanlar, toplum, tedarik zinciri veya paydas etkisi basliklari"
                        value={form.socialHighlights}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            socialHighlights: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Yonetişim bolum notlari</span>
                      <textarea
                        rows={5}
                        className="textarea-tall"
                        placeholder="Politikalar, sorumluluklar, risk yonetimi ve denetim mekanizmalari"
                        value={form.governanceHighlights}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            governanceHighlights: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="report-section-block">
                  <p className="section-label">Sonuc ve gelecek hedefler</p>

                  <div className="field-grid">
                    <label className="field">
                      <span>Gelecek hedefler</span>
                      <textarea
                        rows={5}
                        className="textarea-tall"
                        placeholder="Maddeler halinde bir sonraki donemin hedefleri"
                        value={form.futureTargets}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            futureTargets: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Sonuc notu</span>
                      <textarea
                        rows={5}
                        className="textarea-tall"
                        placeholder="Yonetim kurulu veya paydaslarla paylasilacak kapanis mesaji"
                        value={form.conclusion}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            conclusion: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </>
            ) : null}

            {submitError ? <p className="error-banner">{submitError}</p> : null}

            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Hazirlaniyor..." : "Export olustur"}
            </button>
          </form>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Gecmis</p>
            <h2>Olusturulan dosyalar</h2>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Export gecmisi yukleniyor" message="Daha once olusturulan dosyalar listeleniyor." />
        ) : null}

        {!loading && error ? <ErrorState title="Export gecmisi alinamadi" message={error} /> : null}

        {!loading && !error && history.length === 0 ? (
          <EmptyState
            title="Export gecmisi bos"
            message="Ilk raporu olusturdugunda burada indirilebilir dosya gecmisi goreceksin."
          />
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
                  <span>Olusturma: {formatDateTimeLabel(item.createdAt)}</span>
                  <span>Bitis: {formatDateTimeLabel(item.expiresAt)}</span>
                </div>

                <div className="history-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleGenerateLink(item.id)}
                    disabled={downloadingId === item.id}
                  >
                    {downloadingId === item.id ? "Baglanti aliniyor..." : "Indirme baglantisi al"}
                  </button>

                  {downloadLinks[item.id] ? (
                    <a
                      href={downloadLinks[item.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="download-link"
                    >
                      Dosyayi indir
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
