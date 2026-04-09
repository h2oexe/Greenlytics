import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { apiRequest, ApiError } from "../../lib/http";
import type { EnergyCategory, EnergyEntry, PaginatedResponse, UserRole } from "../../types/api";

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
  { value: 4, label: "Magaza" },
  { value: 5, label: "Diger" }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

function getRoleName(role: UserRole | undefined) {
  switch (role) {
    case 0:
    case "Admin":
      return "Admin";
    case 1:
    case "Manager":
      return "Manager";
    case 2:
    case "Viewer":
      return "Viewer";
    default:
      return "User";
  }
}

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

  const canManage = session?.user.role === 0 || session?.user.role === 1 || session?.user.role === "Admin" || session?.user.role === "Manager";

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
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

      try {
        const response = await apiRequest<PaginatedResponse<EnergyEntry>>(`/api/energy?${params.toString()}`);

        if (!cancelled) {
          setEntries(response.items);
          setTotalCount(response.totalCount);
          setTotalPages(Math.max(response.totalPages, 1));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Enerji kayitlari yuklenemedi.");
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

  const totalKWh = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.kWh, 0),
    [entries]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    setSaving(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await apiRequest<EnergyEntry>("/api/energy", {
        method: "POST",
        body: {
          category: form.category,
          categoryName: form.categoryName.trim() || null,
          kWh: Number(form.kWh),
          recordedAt: toApiDateTime(form.recordedAt),
          notes: form.notes.trim() || null
        }
      });

      setForm(createInitialFormState());
      setSubmitSuccess("Yeni enerji kaydi olusturuldu.");
      setPage(1);

      const params = new URLSearchParams({ page: "1", pageSize: "8" });
      if (filters.from) params.set("from", toApiDateTime(filters.from));
      if (filters.to) params.set("to", toApiDateTime(filters.to));
      if (filters.category) params.set("category", filters.category);

      const response = await apiRequest<PaginatedResponse<EnergyEntry>>(`/api/energy?${params.toString()}`);
      setEntries(response.items);
      setTotalCount(response.totalCount);
      setTotalPages(Math.max(response.totalPages, 1));
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Kayit olusturulamadi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-stack">
      <section className="module-grid">
        <article className="card">
          <p className="eyebrow">Enerji Modulu</p>
          <h2>Tuketim kayitlarini filtrele ve izle</h2>
          <p className="muted">
            Bu ekran `GET /api/energy` ve `POST /api/energy` akisini ayni yerde topluyor.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{formatNumber(totalKWh)} kWh</strong>
              <span>Listelenen kayitlarin toplami</span>
            </div>
            <div className="mini-card soft">
              <strong>{totalCount}</strong>
              <span>Toplam enerji kaydi</span>
            </div>
            <div className="mini-card soft">
              <strong>{getRoleName(session?.user.role)}</strong>
              <span>Aktif kullanici rolu</span>
            </div>
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Yeni Kayit</p>
          <h2>Enerji tuketimi ekle</h2>
          <p className="muted">
            {canManage
              ? "Admin ve manager rolleri bu formdan yeni enerji kaydi acabilir."
              : "Viewer rolunde form gorunur, ancak kayit acma yetkisi yoktur."}
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
                <span>Kayit tarihi</span>
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
                <span>Tuketim (kWh)</span>
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
                  placeholder="Ana ofis, Hat 2, Veri saloni..."
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
                placeholder="Fatura donemi, sayac notu veya operasyon aciklamasi"
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

            <button type="submit" className="primary-button" disabled={!canManage || saving}>
              {saving ? "Kaydediliyor..." : "Enerji kaydi ekle"}
            </button>
          </form>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Kayitlar</p>
            <h2>Filtrelenmis enerji listesi</h2>
          </div>

          <div className="filter-row">
            <label className="field compact">
              <span>Baslangic</span>
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
              <span>Bitis</span>
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
                <option value="">Tum kategoriler</option>
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
            <strong>Enerji kayitlari yukleniyor</strong>
            <span>Filtrelere gore backend verisi getiriliyor.</span>
          </div>
        ) : null}

        {!loading && error ? <p className="error-banner">{error}</p> : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="empty-state">
            <strong>Bu filtrelerde kayit yok</strong>
            <span>Yeni bir enerji kaydi ekleyebilir veya filtreleri genisletebilirsin.</span>
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
                      <p className="muted">
                        {entry.categoryName?.trim() || "Ek alt kategori girilmedi"}
                      </p>
                    </div>
                    <span className="entry-value">{formatNumber(entry.kWh)} kWh</span>
                  </div>

                  <div className="entry-meta">
                    <span>{formatDate(entry.recordedAt)}</span>
                    <span>Olusturma: {formatDate(entry.createdAt)}</span>
                  </div>

                  <p className="entry-notes">{entry.notes?.trim() || "Not girilmedi."}</p>
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
                Onceki
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
