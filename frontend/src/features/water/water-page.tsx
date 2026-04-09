import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { apiRequest, ApiError } from "../../lib/http";
import type { PaginatedResponse, UserRole, WaterCategory, WaterEntry } from "../../types/api";

interface WaterFilterState {
  from: string;
  to: string;
  category: string;
}

interface WaterFormState {
  category: WaterCategory;
  categoryName: string;
  liters: string;
  recordedAt: string;
  notes: string;
}

const waterCategories: Array<{ value: WaterCategory; label: string }> = [
  { value: 0, label: "Ofis" },
  { value: 1, label: "Sulama" },
  { value: 2, label: "Uretim" },
  { value: 3, label: "Sogutma" },
  { value: 4, label: "Diger" }
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

function getCategoryLabel(category: WaterCategory) {
  return waterCategories.find((item) => item.value === category)?.label ?? "Bilinmeyen";
}

function toApiDateTime(value: string) {
  return `${value}T12:00:00`;
}

function createInitialFormState(): WaterFormState {
  return {
    category: 0,
    categoryName: "",
    liters: "",
    recordedAt: new Date().toISOString().slice(0, 10),
    notes: ""
  };
}

export function WaterPage() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [filters, setFilters] = useState<WaterFilterState>({ from: "", to: "", category: "" });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<WaterFormState>(() => createInitialFormState());

  const canManage =
    session?.user.role === 0 ||
    session?.user.role === 1 ||
    session?.user.role === "Admin" ||
    session?.user.role === "Manager";

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
        const response = await apiRequest<PaginatedResponse<WaterEntry>>(`/api/water?${params.toString()}`);

        if (!cancelled) {
          setEntries(response.items);
          setTotalCount(response.totalCount);
          setTotalPages(Math.max(response.totalPages, 1));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Su kayitlari yuklenemedi.");
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

  const totalLiters = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.liters, 0),
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
      await apiRequest<WaterEntry>("/api/water", {
        method: "POST",
        body: {
          category: form.category,
          categoryName: form.categoryName.trim() || null,
          liters: Number(form.liters),
          recordedAt: toApiDateTime(form.recordedAt),
          notes: form.notes.trim() || null
        }
      });

      setForm(createInitialFormState());
      setSubmitSuccess("Yeni su kaydi olusturuldu.");
      setPage(1);

      const params = new URLSearchParams({ page: "1", pageSize: "8" });
      if (filters.from) params.set("from", toApiDateTime(filters.from));
      if (filters.to) params.set("to", toApiDateTime(filters.to));
      if (filters.category) params.set("category", filters.category);

      const response = await apiRequest<PaginatedResponse<WaterEntry>>(`/api/water?${params.toString()}`);
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
          <p className="eyebrow">Su Modulu</p>
          <h2>Tuketim kayitlarini filtrele ve izle</h2>
          <p className="muted">
            Bu ekran `GET /api/water` ve `POST /api/water` akisini ayni yerde topluyor.
          </p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{formatNumber(totalLiters)} L</strong>
              <span>Listelenen kayitlarin toplami</span>
            </div>
            <div className="mini-card soft">
              <strong>{totalCount}</strong>
              <span>Toplam su kaydi</span>
            </div>
            <div className="mini-card soft">
              <strong>{getRoleName(session?.user.role)}</strong>
              <span>Aktif kullanici rolu</span>
            </div>
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Yeni Kayit</p>
          <h2>Su tuketimi ekle</h2>
          <p className="muted">
            {canManage
              ? "Admin ve manager rolleri bu formdan yeni su kaydi acabilir."
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
                      category: Number(event.target.value) as WaterCategory
                    }))
                  }
                  disabled={!canManage || saving}
                >
                  {waterCategories.map((category) => (
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
                <span>Tuketim (L)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="5400"
                  value={form.liters}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      liters: event.target.value
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
                  placeholder="Bahce sulama, sogutma hattı, mutfak..."
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
                placeholder="Sayaç okuma, fatura donemi veya tesis notu"
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
              {saving ? "Kaydediliyor..." : "Su kaydi ekle"}
            </button>
          </form>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Kayitlar</p>
            <h2>Filtrelenmis su listesi</h2>
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
                {waterCategories.map((category) => (
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
            <strong>Su kayitlari yukleniyor</strong>
            <span>Filtrelere gore backend verisi getiriliyor.</span>
          </div>
        ) : null}

        {!loading && error ? <p className="error-banner">{error}</p> : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="empty-state">
            <strong>Bu filtrelerde kayit yok</strong>
            <span>Yeni bir su kaydi ekleyebilir veya filtreleri genisletebilirsin.</span>
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
                    <span className="entry-value">{formatNumber(entry.liters)} L</span>
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
