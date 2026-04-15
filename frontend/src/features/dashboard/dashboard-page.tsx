import { useEffect, useMemo, useState } from "react";
import { formatGoalStatusLabel, formatNumberLabel, formatPeriodLabel } from "../../lib/formatting";
import { ApiError, apiRequest } from "../../lib/http";
import type { DashboardResponse } from "../../types/api";
import { DashboardSkeleton, ErrorState, EmptyState } from "../../ui/state-blocks";

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

function getMaxValue(values: number[]) {
  return Math.max(...values, 1);
}

function TrendBars({ trends }: { trends: DashboardResponse["monthlyTrends"] }) {
  const maxCarbon = getMaxValue(trends.map((trend) => getTrendCarbonValue(trend)));

  if (trends.length === 0) {
    return (
      <EmptyState
        title="Trend verisi yok"
        message="Karbon trend grafiği için henüz yeterli dönem verisi görünmüyor."
      />
    );
  }

  return (
    <div className="trend-bars" aria-label="Son dönem karbon trendi">
      {trends.map((trend) => {
        const carbonValue = getTrendCarbonValue(trend);
        const height = Math.max((carbonValue / maxCarbon) * 100, carbonValue > 0 ? 8 : 4);

        return (
          <div key={trend.period} className="trend-bar-item">
            <div className="trend-bar-track">
              <span className="trend-bar-fill" style={{ height: `${height}%` }} />
            </div>
            <span>{formatPeriodLabel(trend.period)}</span>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownBars({
  items,
  emptyTitle,
  emptyMessage
}: {
  items: DashboardResponse["energyByCategory"];
  emptyTitle: string;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="breakdown-list">
      {items.map((item) => (
        <div key={item.category} className="breakdown-row">
          <div className="breakdown-row-top">
            <span>{item.category}</span>
            <strong>
              {formatNumberLabel(item.value)} {item.unit}
            </strong>
          </div>
          <div className="breakdown-track">
            <span
              className="breakdown-fill"
              style={{ width: `${Math.max(0, Math.min(item.percentageOfTotal, 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
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
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return (
      <section className="card">
        <ErrorState
          title="Gösterge paneli verisi alınamadı"
          message={error ?? "Dashboard verisi şu an hazırlanamadı. Oturumu yenileyip tekrar deneyebilirsin."}
        />
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
            <TrendBars trends={dashboard.monthlyTrends} />
          </article>
        </div>
      </section>

      <section className="content-grid">
        <article className="card">
          <p className="eyebrow">Kategori kırılımı</p>
          <h2>Enerji kategorileri</h2>
          <BreakdownBars
            items={dashboard.energyByCategory}
            emptyTitle="Enerji kategorisi verisi yok"
            emptyMessage="Bu ay için kategori bazlı enerji kaydı görünmüyor."
          />
        </article>

        <article className="card">
          <p className="eyebrow">Emisyon kırılımı</p>
          <h2>Karbon kaynakları</h2>
          <BreakdownBars
            items={dashboard.carbonBySource}
            emptyTitle="Karbon kaynağı verisi yok"
            emptyMessage="Karbon girdileri eklendiğinde kaynak dağılımı burada görünür."
          />
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
            <EmptyState
              title="Henüz aktif hedef yok"
              message="İlk sürdürülebilirlik hedefini oluşturduğunda ilerleme burada görünecek."
            />
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
