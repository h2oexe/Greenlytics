import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { formatDateLabel, formatNumberLabel, formatRoleLabel } from "../../lib/formatting";
import { apiRequest, ApiError } from "../../lib/http";
import type { EnergyCategory, EnergyEntry, PaginatedResponse } from "../../types/api";

interface EnergyFilterState {
  from: string;
  to: string;
  category: string;
}

interface EnergyFormState {
  category: EnergyCategory;
  categoryName: string;
  kWh: string;
  recordedAt: string;
  notes: string;
}

const energyCategories: Array<{ value: EnergyCategory; label: string }> = [
  { value: 0, label: "Ofis" },
  { value: 1, label: "Fabrika" },
  { value: 2, label: "Depo" },
  { value: 3, label: "Veri merkezi" },
  { value: 4, label: "Mağaza" },
  { value: 5, label: "Diğer" }
];

function getCategoryLabel(category: EnergyCategory) {
  return energyCategories.find((item) => item.value === category)?.label ?? "Bilinmeyen";
}

function toApiDateTime(value: string) {
  return `${value}T12:00:00`;
}

function createInitialFormState(): EnergyFormState {
  return {
    category: 0,
    categoryName: "",
    kWh: "",
    recordedAt: new Date().toISOString().slice(0, 10),
    notes: ""
  };
}

export function EnergyPage() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<EnergyEntry[]>([]);
  const [filters, setFilters] = useState<EnergyFilterState>({ from: "", to: "", category: "" });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<EnergyFormState>(() => createInitialFormState());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const canManage =
    session?.user.role === 0 ||
    session?.user.role === 1 ||
    session?.user.role === "Admin" ||
    session?.user.role === "Manager";

  async function refreshEntries(nextPage = page) {
    const params = new URLSearchParams({
      page: nextPage.toString(),
      pageSize: "8"
    });

    if (filters.from) {
      params.set("from", toApiDateTime(filters.from));
    }

    if (filters.to) {
      params.set("to", toApiDateTime(filters.to));
    }

    if (filters.category) {
      params.set("category", filters.category);
    }

    const response = await apiRequest<PaginatedResponse<EnergyEntry>>(`/api/energy?${params.toString()}`);
    setEntries(response.items);
    setTotalCount(response.totalCount);
    setTotalPages(Math.max(response.totalPages, 1));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      setLoading(true);
      setError(null);

      try {
        if (!cancelled) {
          await refreshEntries(page);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Enerji kayıtları yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [filters.category, filters.from, filters.to, page]);

  const totalKWh = useMemo(() => entries.reduce((sum, entry) => sum + entry.kWh, 0), [entries]);

  function startEditing(entry: EnergyEntry) {
    setEditingEntryId(entry.id);
    setSubmitError(null);
    setSubmitSuccess(null);
    setForm({
      category: entry.category,
      categoryName: entry.categoryName ?? "",
      kWh: entry.kWh.toString(),
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
    setSubmitSuccess(null);

    try {
      await apiRequest<EnergyEntry>(editingEntryId ? `/api/energy/${editingEntryId}` : "/api/energy", {
        method: editingEntryId ? "PUT" : "POST",
        body: {
          category: form.category,
          categoryName: form.categoryName.trim(),
          kWh: Number(form.kWh),
          recordedAt: toApiDateTime(form.recordedAt),
          notes: form.notes.trim()
        }
      });

      const wasEditing = Boolean(editingEntryId);
      resetForm();
      setSubmitSuccess(wasEditing ? "Enerji kaydı güncellendi." : "Yeni enerji kaydı oluşturuldu.");
      setPage(1);
      await refreshEntries(1);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Kayıt oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: EnergyEntry) {
    if (!canManage || !window.confirm("Bu enerji kaydını silmek istediğine emin misin?")) {
      return;
    }

    setDeletingEntryId(entry.id);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await apiRequest<void>(`/api/energy/${entry.id}`, { method: "DELETE" });

      if (editingEntryId === entry.id) {
        resetForm();
      }

      setSubmitSuccess("Enerji kaydı silindi.");
      await refreshEntries(page);
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
          <p className="eyebrow">Enerji Modülü</p>
          <h2>Tüketim kayıtlarını filtrele ve izle</h2>
          <p className="muted">
            Bu ekran `GET /api/energy` ve `POST /api/energy` akışını aynı yerde topluyor.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{formatNumberLabel(totalKWh)} kWh</strong>
              <span>Listelenen kayıtların toplamı</span>
            </div>
            <div className="mini-card soft">
              <strong>{totalCount}</strong>
              <span>Toplam enerji kaydı</span>
            </div>
            <div className="mini-card soft">
              <strong>{formatRoleLabel(session?.user.role)}</strong>
              <span>Aktif kullanıcı rolü</span>
            </div>
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">{editingEntryId ? "Kayıt Düzenle" : "Yeni Kayıt"}</p>
          <h2>{editingEntryId ? "Enerji kaydını güncelle" : "Enerji tüketimi ekle"}</h2>
          <p className="muted">
            {canManage
              ? "Yönetici ve sorumlu kullanıcılar bu formdan yeni enerji kaydı açabilir."
              : "Görüntüleyici rolünde form görünür, ancak kayıt açma yetkisi yoktur."}
          </p>

          <form className="module-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label className="field">
                <span>Kategori</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: Number(event.target.value) as EnergyCategory
                    }))
                  }
                  disabled={!canManage || saving}
                >
                  {energyCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
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
                <span>Tüketim (kWh)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="1250"
                  value={form.kWh}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      kWh: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>

              <label className="field">
                <span>Alt kategori</span>
                <input
                  type="text"
                  placeholder="Ana ofis, Hat 2, veri salonu..."
                  value={form.categoryName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      categoryName: event.target.value
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
                placeholder="Fatura dönemi, sayaç notu veya operasyon açıklaması"
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
            {submitSuccess ? <p className="success-banner">{submitSuccess}</p> : null}

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={!canManage || saving}>
                {saving ? "Kaydediliyor..." : editingEntryId ? "Değişiklikleri kaydet" : "Enerji kaydı ekle"}
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
            <h2>Filtrelenmiş enerji listesi</h2>
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
              <span>Kategori</span>
              <select
                value={filters.category}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, category: event.target.value }));
                  setPage(1);
                }}
              >
                <option value="">Tüm kategoriler</option>
                {energyCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>Enerji kayıtları yükleniyor</strong>
            <span>Filtrelere göre backend verisi getiriliyor.</span>
          </div>
        ) : null}

        {!loading && error ? <p className="error-banner">{error}</p> : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="empty-state">
            <strong>Bu filtrelerde kayıt yok</strong>
            <span>Yeni bir enerji kaydı ekleyebilir veya filtreleri genişletebilirsin.</span>
          </div>
        ) : null}

        {!loading && !error && entries.length > 0 ? (
          <>
            <div className="entry-list">
              {entries.map((entry) => (
                <article key={entry.id} className="entry-card">
                  <div className="entry-card-header">
                    <div>
                      <strong>{getCategoryLabel(entry.category)}</strong>
                      <p className="muted">{entry.categoryName?.trim() || "Ek alt kategori girilmedi"}</p>
                    </div>
                    <span className="entry-value">{formatNumberLabel(entry.kWh)} kWh</span>
                  </div>

                  <div className="entry-meta">
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
