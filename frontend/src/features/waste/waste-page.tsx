import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { formatDateLabel, formatNumberLabel, formatRoleLabel } from "../../lib/formatting";
import { apiRequest, ApiError } from "../../lib/http";
import type { PaginatedResponse, WasteCategory, WasteEntry } from "../../types/api";
import { useFeedback } from "../../ui/feedback-context";
import { EmptyState, ErrorState, LoadingState } from "../../ui/state-blocks";

interface WasteFilterState {
  from: string;
  to: string;
  category: string;
  recyclable: string;
}

interface WasteFormState {
  category: WasteCategory;
  categoryName: string;
  isRecyclable: string;
  kg: string;
  recordedAt: string;
  notes: string;
}

const wasteCategories: Array<{ value: WasteCategory; label: string }> = [
  { value: 0, label: "Genel atık" },
  { value: 1, label: "Geri dönüştürülebilir" },
  { value: 2, label: "Tehlikeli" },
  { value: 3, label: "Elektronik" },
  { value: 4, label: "Organik" },
  { value: 5, label: "Diğer" }
];

function getCategoryLabel(category: WasteCategory) {
  return wasteCategories.find((item) => item.value === category)?.label ?? "Bilinmeyen";
}

function toApiDateTime(value: string) {
  return `${value}T12:00:00`;
}

function createInitialFormState(): WasteFormState {
  return {
    category: 0,
    categoryName: "",
    isRecyclable: "true",
    kg: "",
    recordedAt: new Date().toISOString().slice(0, 10),
    notes: ""
  };
}

export function WastePage() {
  const { session } = useAuth();
  const { confirm, showToast } = useFeedback();
  const [entries, setEntries] = useState<WasteEntry[]>([]);
  const [filters, setFilters] = useState<WasteFilterState>({
    from: "",
    to: "",
    category: "",
    recyclable: ""
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<WasteFormState>(() => createInitialFormState());
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

    if (filters.recyclable) {
      params.set("recyclable", filters.recyclable);
    }

    const response = await apiRequest<PaginatedResponse<WasteEntry>>(`/api/waste?${params.toString()}`);
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
          setError(err instanceof ApiError ? err.message : "Atık kayıtları yüklenemedi.");
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
  }, [filters.category, filters.from, filters.recyclable, filters.to, page]);

  const totalKg = useMemo(() => entries.reduce((sum, entry) => sum + entry.kg, 0), [entries]);
  const recyclableCount = useMemo(() => entries.filter((entry) => entry.isRecyclable).length, [entries]);

  function startEditing(entry: WasteEntry) {
    setEditingEntryId(entry.id);
    setSubmitError(null);
    setForm({
      category: entry.category,
      categoryName: entry.categoryName ?? "",
      isRecyclable: entry.isRecyclable ? "true" : "false",
      kg: entry.kg.toString(),
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
      await apiRequest<WasteEntry>(editingEntryId ? `/api/waste/${editingEntryId}` : "/api/waste", {
        method: editingEntryId ? "PUT" : "POST",
        body: {
          category: form.category,
          categoryName: form.categoryName.trim(),
          isRecyclable: form.isRecyclable === "true",
          kg: Number(form.kg),
          recordedAt: toApiDateTime(form.recordedAt),
          notes: form.notes.trim()
        }
      });

      const wasEditing = Boolean(editingEntryId);
      resetForm();
      setPage(1);
      await refreshEntries(1);
      showToast({
        title: wasEditing ? "Atık kaydı güncellendi" : "Atık kaydı eklendi",
        message: "Liste en güncel haliyle yenilendi.",
        tone: "success"
      });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Kayıt oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: WasteEntry) {
    if (!canManage) {
      return;
    }

    const approved = await confirm({
      title: "Atık kaydı silinsin mi?",
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
      await apiRequest<void>(`/api/waste/${entry.id}`, { method: "DELETE" });

      if (editingEntryId === entry.id) {
        resetForm();
      }

      await refreshEntries(page);
      showToast({
        title: "Atık kaydı silindi",
        message: "Liste güncellendi.",
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
          <p className="eyebrow">Atık Modülü</p>
          <h2>Atık çıktılarını filtrele ve izle</h2>
          <p className="muted">
            Bu ekran `GET /api/waste` ve `POST /api/waste` akışını geri dönüşüm durumu ile birlikte topluyor.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{formatNumberLabel(totalKg)} kg</strong>
              <span>Listelenen kayıtların toplamı</span>
            </div>
            <div className="mini-card soft">
              <strong>{recyclableCount}</strong>
              <span>Geri dönüştürülebilir kayıt sayısı</span>
            </div>
            <div className="mini-card soft">
              <strong>{formatRoleLabel(session?.user.role)}</strong>
              <span>Aktif kullanıcı rolü</span>
            </div>
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">{editingEntryId ? "Kayıt Düzenle" : "Yeni Kayıt"}</p>
          <h2>{editingEntryId ? "Atık kaydını güncelle" : "Atık girdisi ekle"}</h2>
          <p className="muted">
            {canManage
              ? "Yönetici ve sorumlu kullanıcılar yeni atık kaydı açabilir."
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
                      category: Number(event.target.value) as WasteCategory
                    }))
                  }
                  disabled={!canManage || saving}
                >
                  {wasteCategories.map((category) => (
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
                <span>Miktar (kg)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="320"
                  value={form.kg}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      kg: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>

              <label className="field">
                <span>Geri dönüşüm durumu</span>
                <select
                  value={form.isRecyclable}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isRecyclable: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                >
                  <option value="true">Geri dönüştürülebilir</option>
                  <option value="false">Geri dönüştürülemez</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Alt kategori</span>
              <input
                type="text"
                placeholder="Karton, pil, plastik kap, yemek artığı..."
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

            <label className="field">
              <span>Not</span>
              <textarea
                rows={4}
                placeholder="Toplama noktası, bertaraf notu veya operasyon açıklaması"
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
                {saving ? "Kaydediliyor..." : editingEntryId ? "Değişiklikleri kaydet" : "Atık kaydı ekle"}
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
            <h2>Filtrelenmiş atık listesi</h2>
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
                {wasteCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field compact">
              <span>Geri dönüşüm</span>
              <select
                value={filters.recyclable}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, recyclable: event.target.value }));
                  setPage(1);
                }}
              >
                <option value="">Tümü</option>
                <option value="true">Geri dönüştürülebilir</option>
                <option value="false">Geri dönüştürülemez</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Atık kayıtları yükleniyor" message="Filtrelere göre backend verisi getiriliyor." />
        ) : null}

        {!loading && error ? <ErrorState title="Atık kayıtları alınamadı" message={error} /> : null}

        {!loading && !error && entries.length === 0 ? (
          <EmptyState
            title="Bu filtrelerde kayıt yok"
            message="Yeni bir atık kaydı ekleyebilir veya filtreleri genişletebilirsin."
          />
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
                    <div className="entry-side">
                      <span className="entry-pill">{entry.isRecyclable ? "Dönüşür" : "Bertaraf"}</span>
                      <span className="entry-value">{formatNumberLabel(entry.kg)} kg</span>
                    </div>
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
