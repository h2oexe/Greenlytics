import { useEffect, useMemo, useState } from "react";
import { formatGoalStatusLabel, formatNumberLabel, formatPeriodLabel } from "../../lib/formatting";
import { ApiError, apiRequest } from "../../lib/http";
import type { DashboardResponse } from "../../types/api";

interface StatTileProps {
  label: string;
  value: string;
  helper: string;
  progress?: number;
}

function StatTile({ label, value, helper, progress }: StatTileProps) {
  return (
    <article className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-helper">{helper}</span>
      {typeof progress === "number" ? (
        <div className="progress-track progress-track--compact">
          <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function getTrendCarbonValue(value: DashboardResponse["monthlyTrends"][number]) {
  return value.cO2eKg ?? 0;
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest<DashboardResponse>("/api/reports/dashboard");

        if (!cancelled) {
          setDashboard(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Gösterge paneli yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const headlineProgress = useMemo(() => {
    if (!dashboard) {
      return 0;
    }

    const current = dashboard.currentMonth.recordCount;
    const previous = Math.max(dashboard.lastMonth.recordCount, 1);
    return Math.min((current / previous) * 100, 100);
  }, [dashboard]);

  if (loading) {
    return (
      <section className="card centered">
        <h2>Gösterge paneli yükleniyor</h2>
        <p className="muted">`/api/reports/dashboard` verisi hazırlanıyor.</p>
      </section>
    );
  }

  if (error || !dashboard) {
    return (
      <section className="card">
        <h2>Veri alınırken hata oldu</h2>
        <p className="error-banner">{error ?? "Gösterge paneli verisi bulunamadı."}</p>
        <p className="muted">
          Bu durum genelde backend tarafında veri ya da yetki kaynaklı olur. Oturumu yenileyip tekrar
          deneyebilirsin.
        </p>
      </section>
    );
  }

  const featuredGoal = dashboard.activeGoals[0];

  return (
    <div className="dashboard-page page-stack">
      <section className="page-hero page-hero--split">
        <div>
          <p className="page-kicker">Kontrol merkezi / Genel görünüm</p>
          <h1 className="page-title">Sürdürülebilirlik operasyonunun canlı özeti</h1>
          <p className="page-description">
            Bu ayın tüketim, emisyon ve hedef performansını tek ekranda izle. Kritik farklar, trendler
            ve aksiyon gerektiren alanlar burada öne çıkar.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="primary-button">
            Rapor oluştur
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatTile
          label="Enerji"
          value={`${formatNumberLabel(dashboard.currentMonth.totalEnergyKWh)} kWh`}
          helper="Bu ay toplam tüketim"
        />
        <StatTile
          label="Su"
          value={`${formatNumberLabel(dashboard.currentMonth.totalWaterLiters)} L`}
          helper="Bu ay toplam tüketim"
        />
        <StatTile
          label="Atık"
          value={`${formatNumberLabel(dashboard.currentMonth.totalWasteKg)} kg`}
          helper="Bu ay toplam çıktı"
        />
        <StatTile
          label="Karbon"
          value={`${formatNumberLabel(dashboard.currentMonth.totalCO2eKg)} kgCO2e`}
          helper="Aylık toplam etki"
          progress={headlineProgress}
        />
      </section>

      <section className="spotlight-grid">
        <article className="spotlight-card">
          <div className="spotlight-card-inner">
            <div className="spotlight-topline">
              <span className="spotlight-chip">Canlı özet</span>
              <span className="spotlight-caption">CO2</span>
            </div>

            <div className="spotlight-content">
              <h2>Bu ay operasyonel görünüm dengeli ilerliyor</h2>
              <p>
                Toplam kayıt sayısı {formatNumberLabel(dashboard.currentMonth.recordCount, 0)}. Bir
                önceki aya göre kıyas çizgisi ve aktif hedefler aşağıda.
              </p>
            </div>

            <div className="spotlight-progress">
              <div className="spotlight-progress-row">
                <span>Bu ay / geçen ay kayıt yoğunluğu</span>
                <strong>%{formatNumberLabel(headlineProgress, 0)}</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${headlineProgress}%` }} />
              </div>
            </div>

            <div className="spotlight-meta">
              <span>Bu ay: {formatNumberLabel(dashboard.currentMonth.recordCount, 0)} kayıt</span>
              <span>Geçen ay: {formatNumberLabel(dashboard.lastMonth.recordCount, 0)} kayıt</span>
            </div>
          </div>
        </article>

        <div className="spotlight-side">
          <article className="insight-card">
            <p className="eyebrow">Bildirimler</p>
            <h3>Takip gerektiren alanlar</h3>
            <div className="list-stack">
              <div className="list-row">
                <span>Okunmamış bildirim</span>
                <strong>{dashboard.unreadNotifications}</strong>
              </div>
              <div className="list-row">
                <span>Aktif hedef</span>
                <strong>{dashboard.activeGoals.length}</strong>
              </div>
              <div className="list-row">
                <span>Trend dönemi</span>
                <strong>{dashboard.monthlyTrends.length}</strong>
              </div>
            </div>
          </article>

          <article className="insight-card">
            <p className="eyebrow">Trendler</p>
            <h3>Son dönem karbon etkisi</h3>
            <div className="compact-list">
              {dashboard.monthlyTrends.map((trend) => (
                <div key={trend.period} className="compact-list-row">
                  <span>{formatPeriodLabel(trend.period)}</span>
                  <strong>{formatNumberLabel(getTrendCarbonValue(trend))} kgCO2e</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="content-grid">
        <article className="card">
          <p className="eyebrow">Kategori kırılımı</p>
          <h2>Enerji kategorileri</h2>
          <div className="list-stack">
            {dashboard.energyByCategory.length === 0 ? (
              <p className="muted">Bu ay enerji kategorisi verisi yok.</p>
            ) : (
              dashboard.energyByCategory.map((item) => (
                <div key={item.category} className="list-row">
                  <span>{item.category}</span>
                  <strong>
                    {formatNumberLabel(item.value)} {item.unit}
                  </strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Hedef sağlığı</p>
          <h2>Aktif ilerleme</h2>
          {featuredGoal ? (
            <div className="featured-goal-summary">
              <div className="featured-goal-header">
                <div>
                  <strong>{featuredGoal.name}</strong>
                  <p className="muted">{formatGoalStatusLabel(featuredGoal.status)}</p>
                </div>
                <span className="entry-pill">%{formatNumberLabel(featuredGoal.progressPercent, 0)}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(featuredGoal.progressPercent, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="muted">Henüz aktif hedef bulunmuyor.</p>
          )}

          <div className="compact-list">
            {dashboard.activeGoals.length === 0 ? (
              <div className="compact-list-row">
                <span>Durum</span>
                <strong>Hedef yok</strong>
              </div>
            ) : (
              dashboard.activeGoals.map((goal) => (
                <div key={goal.goalId} className="compact-list-row">
                  <span>{goal.name}</span>
                  <strong>%{formatNumberLabel(goal.progressPercent, 0)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
