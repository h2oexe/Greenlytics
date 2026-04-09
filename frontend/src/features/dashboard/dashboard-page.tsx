import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "../../lib/http";
import type { DashboardResponse } from "../../types/api";

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
}

function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-helper">{helper}</span>
    </article>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
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
          setError(err instanceof ApiError ? err.message : "Dashboard yuklenemedi.");
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

  return (
    <div className="dashboard-page">
      {loading ? (
        <section className="card centered">
          <h2>Dashboard yukleniyor</h2>
          <p className="muted">`/api/reports/dashboard` verisi bekleniyor.</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="card">
          <h2>Veri alinirken hata oldu</h2>
          <p className="error-banner">{error}</p>
          <p className="muted">
            Login basariliysa bu genelde backend tarafinda veri ya da yetki kaynakli bir durumdur.
          </p>
        </section>
      ) : null}

      {!loading && !error && dashboard ? (
        <>
          <section className="metric-grid">
            <MetricCard
              label="Enerji"
              value={`${formatNumber(dashboard.currentMonth.totalEnergyKWh)} kWh`}
              helper="Bu ay toplam tuketim"
            />
            <MetricCard
              label="Su"
              value={`${formatNumber(dashboard.currentMonth.totalWaterLiters)} L`}
              helper="Bu ay toplam tuketim"
            />
            <MetricCard
              label="Atik"
              value={`${formatNumber(dashboard.currentMonth.totalWasteKg)} kg`}
              helper="Bu ay toplam cikti"
            />
            <MetricCard
              label="Karbon"
              value={`${formatNumber(dashboard.currentMonth.totalCO2eKg)} kgCO2e`}
              helper="Bu ay toplam etki"
            />
          </section>

          <section className="dashboard-grid">
            <article className="card">
              <p className="eyebrow">Aylik Ozet</p>
              <h2>Bu ay ve onceki ay karsilastirmasi</h2>
              <div className="list-stack">
                <div className="list-row">
                  <span>Bu ay kayit sayisi</span>
                  <strong>{dashboard.currentMonth.recordCount}</strong>
                </div>
                <div className="list-row">
                  <span>Onceki ay kayit sayisi</span>
                  <strong>{dashboard.lastMonth.recordCount}</strong>
                </div>
                <div className="list-row">
                  <span>Okunmamis bildirim</span>
                  <strong>{dashboard.unreadNotifications}</strong>
                </div>
              </div>
            </article>

            <article className="card">
              <p className="eyebrow">Trendler</p>
              <h2>Son 6 donem karbon etkisi</h2>
              <div className="list-stack">
                {dashboard.monthlyTrends.map((trend) => (
                  <div key={trend.period} className="list-row">
                    <span>{trend.period}</span>
                    <span>{formatNumber(getTrendCarbonValue(trend))} kgCO2e</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="card">
              <p className="eyebrow">Kategori Dagilimi</p>
              <h2>Enerji kategorileri</h2>
              <div className="list-stack">
                {dashboard.energyByCategory.length === 0 ? (
                  <p className="muted">Bu ay enerji kategorisi verisi yok.</p>
                ) : (
                  dashboard.energyByCategory.map((item) => (
                    <div key={item.category} className="list-row">
                      <span>{item.category}</span>
                      <strong>
                        {formatNumber(item.value)} {item.unit}
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="card">
              <p className="eyebrow">Hedefler</p>
              <h2>Aktif ilerleme</h2>
              <div className="list-stack">
                {dashboard.activeGoals.length === 0 ? (
                  <p className="muted">Su an tanimli aktif hedef yok.</p>
                ) : (
                  dashboard.activeGoals.map((goal) => (
                    <div key={goal.goalId} className="goal-row">
                      <div>
                        <strong>{goal.name}</strong>
                        <p className="muted">{goal.status}</p>
                      </div>
                      <span>%{Math.round(goal.progressPercent)}</span>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
