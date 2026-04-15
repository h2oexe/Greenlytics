import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { formatDateLabel, formatNumberLabel, formatRoleLabel } from "../../lib/formatting";
import { apiRequest, ApiError } from "../../lib/http";
import { useFeedback } from "../../ui/feedback-context";
import { EmptyState, ErrorState, LoadingState } from "../../ui/state-blocks";
import type {
  CarbonFootprintResponse,
  CarbonInput,
  CarbonSource,
  PaginatedResponse,
  TransportType
} from "../../types/api";

interface CarbonFilterState {
  from: string;
  to: string;
  source: string;
}

interface CarbonFormState {
  source: CarbonSource;
  transportType: string;
  description: string;
  value: string;
  unit: string;
  recordedAt: string;
  notes: string;
}

const carbonSources: Array<{ value: CarbonSource; label: string }> = [
  { value: 0, label: "Ulaşım" },
  { value: 1, label: "Elektrik" },
  { value: 2, label: "Doğalgaz" },
  { value: 3, label: "Havacılık" },
  { value: 4, label: "Diğer" }
];

const transportTypes: Array<{ value: TransportType; label: string }> = [
  { value: 0, label: "Araba" },
  { value: 1, label: "Kamyon" },
  { value: 2, label: "Otobüs" },
  { value: 3, label: "Tren" },
  { value: 4, label: "Gemi" },
  { value: 5, label: "Motosiklet" }
];

function getSourceLabel(source: CarbonSource) {
  return carbonSources.find((item) => item.value === source)?.label ?? "Bilinmeyen";
}

function getTransportTypeLabel(transportType: TransportType | null) {
  if (transportType === null) {
    return "Genel";
  }

  return transportTypes.find((item) => item.value === transportType)?.label ?? "Genel";
}

function toApiDateTime(value: string) {
  return `${value}T12:00:00`;
}

function getDefaultUnit(source: CarbonSource) {
  switch (source) {
    case 0:
      return "km";
    case 1:
      return "kwh";
    case 2:
      return "m3";
    case 3:
      return "km";
    case 4:
      return "kg";
    default:
      return "kg";
  }
}

function createInitialFormState(): CarbonFormState {
  return {
    source: 0,
    transportType: "0",
    description: "",
    value: "",
    unit: "km",
    recordedAt: new Date().toISOString().slice(0, 10),
    notes: ""
  };
}

export function CarbonPage() {
  const { session } = useAuth();
  const { confirm, showToast } = useFeedback();
  const [entries, setEntries] = useState<CarbonInput[]>([]);
  const [footprint, setFootprint] = useState<CarbonFootprintResponse | null>(null);
  const [filters, setFilters] = useState<CarbonFilterState>({ from: "", to: "", source: "" });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<CarbonFormState>(() => createInitialFormState());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const canManage =
    session?.user.role === 0 ||
    session?.user.role === 1 ||
    session?.user.role === "Admin" ||
    session?.user.role === "Manager";

  const isTransport = form.source === 0;

  async function refreshData(nextPage = page) {
    const params = new URLSearchParams({ page: nextPage.toString(), pageSize: "8" });
    const footprintParams = new URLSearchParams();

    if (filters.from) {
      const fromValue = toApiDateTime(filters.from);
      params.set("from", fromValue);
      footprintParams.set("from", fromValue);
    }

    if (filters.to) {
      const toValue = toApiDateTime(filters.to);
      params.set("to", toValue);
      footprintParams.set("to", toValue);
    }

    if (filters.source) {
      params.set("source", filters.source);
    }

    const [listResponse, footprintResponse] = await Promise.all([
      apiRequest<PaginatedResponse<CarbonInput>>(`/api/carbon?${params.toString()}`),
      apiRequest<CarbonFootprintResponse>(`/api/carbon/footprint?${footprintParams.toString()}`)
    ]);

    setEntries(listResponse.items);
    setTotalCount(listResponse.totalCount);
    setTotalPages(Math.max(listResponse.totalPages, 1));
    setFootprint(footprintResponse);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        if (!cancelled) {
          await refreshData(page);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Karbon kayıtları yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [filters.from, filters.to, filters.source, page]);

  const filteredCarbonKg = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.cO2eKg, 0),
    [entries]
  );

  function startEditing(entry: CarbonInput) {
    setEditingEntryId(entry.id);
    setSubmitError(null);
    setForm({
      source: entry.source,
      transportType: entry.transportType !== null ? entry.transportType.toString() : "",
      description: entry.description ?? "",
      value: entry.value.toString(),
      unit: entry.unit,
      recordedAt: entry.recordedAt.slice(0, 10),
      notes: entry.notes ?? ""
    });
  }

  function resetForm() {
    setEditingEntryId(null);
    setForm(createInitialFormState());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      await apiRequest<CarbonInput>(editingEntryId ? `/api/carbon/${editingEntryId}` : "/api/carbon", {
        method: editingEntryId ? "PUT" : "POST",
        body: {
          source: form.source,
          transportType: isTransport ? Number(form.transportType) : null,
          description: form.description.trim(),
          value: Number(form.value),
          unit: form.unit.trim().toLowerCase(),
          recordedAt: toApiDateTime(form.recordedAt),
          notes: form.notes.trim()
        }
      });

      const wasEditing = Boolean(editingEntryId);
      resetForm();
      setPage(1);
      await refreshData(1);
      showToast({
        title: wasEditing ? "Karbon girdisi güncellendi" : "Karbon girdisi eklendi",
        message: "Liste ve footprint özeti yenilendi.",
        tone: "success"
      });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Kayıt oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  function handleSourceChange(nextSource: CarbonSource) {
    setForm((current) => ({
      ...current,
      source: nextSource,
      unit: getDefaultUnit(nextSource),
      transportType: nextSource === 0 ? current.transportType || "0" : ""
    }));
  }

  async function handleDelete(entry: CarbonInput) {
    if (!canManage) {
      return;
    }

    const approved = await confirm({
      title: "Karbon girdisi silinsin mi?",
      message: "Bu kayıt listeden kaldırılacak. İşlem tamamlandığında geri alma seçeneği yok.",
      confirmLabel: "Kaydı sil",
      cancelLabel: "Vazgeç",
      tone: "danger"
    });

    if (!approved) {
      return;
    }

    setDeletingEntryId(entry.id);
    setSubmitError(null);

    try {
      await apiRequest<void>(`/api/carbon/${entry.id}`, { method: "DELETE" });

      if (editingEntryId === entry.id) {
        resetForm();
      }

      await refreshData(page);
      showToast({
        title: "Karbon girdisi silindi",
        message: "Liste ve footprint özeti yenilendi.",
        tone: "success"
      });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Kayıt silinemedi.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  return (
    <div className="module-stack">
      <section className="module-grid">
        <article className="card">
          <p className="eyebrow">Karbon Modülü</p>
          <h2>Emisyon girdilerini filtrele ve izle</h2>
          <p className="muted">
            Bu ekran `GET /api/carbon`, `POST /api/carbon` ve `GET /api/carbon/footprint` verilerini birlikte kullanıyor.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{formatNumberLabel(filteredCarbonKg)} kgCO2e</strong>
              <span>Listelenen kayıtların toplam etkisi</span>
            </div>
            <div className="mini-card soft">
              <strong>{formatNumberLabel(footprint?.totalCO2eTonnes ?? 0, 2)} ton</strong>
              <span>Seçilen tarih aralığı toplam ayak izi</span>
            </div>
            <div className="mini-card soft">
              <strong>{formatRoleLabel(session?.user.role)}</strong>
              <span>Aktif kullanıcı rolü</span>
            </div>
          </div>

          <div className="list-stack module-insight-list">
            {(footprint?.bySource ?? []).slice(0, 3).map((item) => (
              <div key={item.category} className="list-row">
                <span>{item.category}</span>
                <strong>{formatNumberLabel(item.value)} kgCO2e</strong>
              </div>
            ))}
            {!footprint || footprint.bySource.length === 0 ? (
              <p className="muted">Henüz kaynak bazlı karbon dağılımı yok.</p>
            ) : null}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">{editingEntryId ? "Kayıt Düzenle" : "Yeni Kayıt"}</p>
          <h2>{editingEntryId ? "Karbon girdisini güncelle" : "Karbon girdisi ekle"}</h2>
          <p className="muted">
            {canManage
              ? "Yönetici ve sorumlu kullanıcılar yeni karbon girdisi açabilir. CO2e backend tarafında otomatik hesaplanır."
              : "Görüntüleyici rolünde form görünür, ancak kayıt açma yetkisi yoktur."}
          </p>

          <form className="module-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label className="field">
                <span>Kaynak</span>
                <select
                  value={form.source}
                  onChange={(event) => handleSourceChange(Number(event.target.value) as CarbonSource)}
                  disabled={!canManage || saving}
                >
                  {carbonSources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Kayıt tarihi</span>
                <input
                  type="date"
                  value={form.recordedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recordedAt: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Değer</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder={isTransport ? "120" : "850"}
                  value={form.value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      value: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>

              <label className="field">
                <span>Birim</span>
                <input
                  type="text"
                  placeholder="km / kwh / m3 / kg"
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Taşıma tipi</span>
                <select
                  value={form.transportType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      transportType: event.target.value
                    }))
                  }
                  disabled={!canManage || saving || !isTransport}
                >
                  {isTransport ? (
                    transportTypes.map((transportType) => (
                      <option key={transportType.value} value={transportType.value}>
                        {transportType.label}
                      </option>
                    ))
                  ) : (
                    <option value="">Bu kaynakta kullanılmıyor</option>
                  )}
                </select>
              </label>

              <label className="field">
                <span>Açıklama</span>
                <input
                  type="text"
                  placeholder="Servis rotası, elektrik faturası, kazan tüketimi..."
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                />
              </label>
            </div>

            <label className="field">
              <span>Not</span>
              <textarea
                rows={4}
                placeholder="Kaynak, varsayım veya operasyon notu"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                disabled={!canManage || saving}
              />
            </label>

            {submitError ? <p className="error-banner">{submitError}</p> : null}

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={!canManage || saving}>
                {saving ? "Kaydediliyor..." : editingEntryId ? "Değişiklikleri kaydet" : "Karbon girdisi ekle"}
              </button>

              {editingEntryId ? (
                <button type="button" className="secondary-button" onClick={resetForm} disabled={saving}>
                  İptal
                </button>
              ) : null}
            </div>
          </form>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-label">Kayıtlar</p>
            <h2>Filtrelenmiş karbon listesi</h2>
          </div>
        </div>

        <div className="filter-panel">
          <div className="filter-row filter-row--panel">
            <label className="field compact">
              <span>Başlangıç</span>
              <input
                type="date"
                value={filters.from}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, from: event.target.value }));
                  setPage(1);
                }}
              />
            </label>

            <label className="field compact">
              <span>Bitiş</span>
              <input
                type="date"
                value={filters.to}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, to: event.target.value }));
                  setPage(1);
                }}
              />
            </label>

            <label className="field compact">
              <span>Kaynak</span>
              <select
                value={filters.source}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, source: event.target.value }));
                  setPage(1);
                }}
              >
                <option value="">Tüm kaynaklar</option>
                {carbonSources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState
            title="Karbon kayıtları yükleniyor"
            message="Liste ve footprint özeti backend'den getiriliyor."
          />
        ) : null}

        {!loading && error ? <ErrorState title="Karbon kayıtları alınamadı" message={error} /> : null}

        {!loading && !error && entries.length === 0 ? (
          <EmptyState
            title="Bu filtrelerde kayıt yok"
            message="Yeni bir karbon girdisi ekleyebilir veya filtreleri genişletebilirsin."
          />
        ) : null}

        {!loading && !error && entries.length > 0 ? (
          <>
            <div className="entry-list">
              {entries.map((entry) => (
                <article key={entry.id} className="entry-card">
                  <div className="entry-card-header">
                    <div>
                      <strong>{getSourceLabel(entry.source)}</strong>
                      <p className="muted">{entry.description?.trim() || getTransportTypeLabel(entry.transportType)}</p>
                    </div>
                    <div className="entry-side">
                      <span className="entry-pill">{formatNumberLabel(entry.emissionFactor, 3)} faktör</span>
                      <span className="entry-value">{formatNumberLabel(entry.cO2eKg)} kgCO2e</span>
                    </div>
                  </div>

                  <div className="entry-meta">
                    <span>
                      {formatNumberLabel(entry.value)} {entry.unit}
                    </span>
                    <span>{formatDateLabel(entry.recordedAt)}</span>
                    <span>Oluşturma: {formatDateLabel(entry.createdAt)}</span>
                  </div>

                  <p className="entry-notes">{entry.notes?.trim() || "Not girilmedi."}</p>

                  {canManage ? (
                    <div className="entry-actions">
                      <button type="button" className="secondary-button" onClick={() => startEditing(entry)}>
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDelete(entry)}
                        disabled={deletingEntryId === entry.id}
                      >
                        {deletingEntryId === entry.id ? "Siliniyor..." : "Sil"}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="pagination-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
              >
                Önceki
              </button>
              <span>
                Sayfa {page} / {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPage((current) => Math.min(current + 1, Math.max(totalPages, 1)))}
                disabled={page >= totalPages}
              >
                Sonraki
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
