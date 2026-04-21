import { useEffect, useMemo, useState } from "react";
import {
  formatDateLabel,
  formatGoalHealthLabel,
  formatGoalStatusLabel,
  formatNumberLabel,
  formatPeriodLabel,
  getGoalHealthPercent
} from "../../lib/formatting";
import { ApiError, apiRequest } from "../../lib/http";
import type { CategoryBreakdown, DashboardResponse, GoalProgress, Trend } from "../../types/api";
import { DashboardSkeleton, EmptyState, ErrorState } from "../../ui/state-blocks";

interface StatTileProps {
  label: string;
  value: string;
  helper: string;
  progress?: number;
  deltaLabel?: string;
  tone?: "default" | "good" | "warning";
}

interface SmartSignal {
  title: string;
  value: string;
  description: string;
  tone: "default" | "good" | "warning";
}

interface DashboardNarrative {
  chip: string;
  headline: string;
  summary: string;
  actionLabel: string;
  actionNote: string;
  tone: "good" | "warning" | "default";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function getPercentChange(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function getTrendCarbonValue(value: Trend) {
  return value.cO2eKg ?? 0;
}

function getMaxValue(values: number[]) {
  return Math.max(...values, 1);
}

function formatDeltaLabel(change: number, suffix = "") {
  const absolute = formatNumberLabel(Math.abs(change), 0);

  if (change > 0) {
    return `+%${absolute}${suffix}`;
  }

  if (change < 0) {
    return `-%${absolute}${suffix}`;
  }

  return `%0${suffix}`;
}

function getPrimaryBreakdownItem(items: CategoryBreakdown[]) {
  return [...items].sort((left, right) => right.value - left.value)[0] ?? null;
}

function getGoalRiskSummary(goals: GoalProgress[]) {
  const overdue = goals.filter((goal) => goal.isOverdue);
  const lowProgress = goals.filter((goal) => !goal.isAchieved && getGoalHealthPercent(goal) < 70);

  return {
    overdue,
    lowProgress,
    healthyCount: goals.filter((goal) => getGoalHealthPercent(goal) >= 85 || goal.isAchieved).length
  };
}

function getDashboardNarrative(dashboard: DashboardResponse): DashboardNarrative {
  const carbonChange = getPercentChange(
    dashboard.currentMonth.totalCO2eKg,
    dashboard.lastMonth.totalCO2eKg
  );
  const recordChange = getPercentChange(
    dashboard.currentMonth.recordCount,
    dashboard.lastMonth.recordCount
  );
  const topEnergy = getPrimaryBreakdownItem(dashboard.energyByCategory);
  const topCarbon = getPrimaryBreakdownItem(dashboard.carbonBySource);
  const { overdue, lowProgress } = getGoalRiskSummary(dashboard.activeGoals);

  if (dashboard.currentMonth.recordCount === 0) {
    return {
      chip: "Veri akışı zayıf",
      headline: "Bu ay operasyon görünürlüğü henüz oluşmamış durumda",
      summary:
        "Dashboard karar verecek kadar veri toplamamış. Enerji, su veya karbon modüllerine birkaç kayıt girildiğinde kıyas ve içgörü alanları dolacak.",
      actionLabel: "Öncelik",
      actionNote: "İlk veri girişlerini tamamla ve trendleri başlat.",
      tone: "warning"
    };
  }

  if (overdue.length > 0 || lowProgress.length > 1) {
    return {
      chip: "Dikkat gerekiyor",
      headline: "Hedef ve operasyon akışı yakın takip istiyor",
      summary: `${overdue.length} geciken hedef ve düşük ilerleyen alanlar var. ${
        topCarbon ? `${topCarbon.category} şu an en baskın emisyon kaynağı.` : "Karbon tarafını yakından izle."
      }`,
      actionLabel: "Önerilen aksiyon",
      actionNote: "Önce riskli hedefleri ve en yüksek emisyon kaynağını ele al.",
      tone: "warning"
    };
  }

  if (carbonChange <= -8 && recordChange >= 0) {
    return {
      chip: "Güçlü iyileşme",
      headline: "Operasyonel verim ve emisyon dengesi doğru yönde ilerliyor",
      summary: `Karbon etkisi geçen aya göre ${formatDeltaLabel(carbonChange)} seviyesinde iyileşti. ${
        topEnergy ? `${topEnergy.category} hâlâ en büyük enerji yükünü taşıyor.` : "Enerji dağılımı dengeli görünüyor."
      }`,
      actionLabel: "Sıradaki adım",
      actionNote: "İyileşen alanları standartlaştır ve başarılı pratiği diğer modüllere taşı.",
      tone: "good"
    };
  }

  return {
    chip: "Canlı özet",
    headline: "Bu ay operasyonel görünüm dengeli ama izleme gerektiriyor",
    summary: `${
      topEnergy ? `${topEnergy.category} enerji tüketiminde öne çıkıyor.` : "Enerji dağılımı dengeli ilerliyor."
    } ${
      topCarbon ? `${topCarbon.category} emisyon etkisinde en yüksek paya sahip.` : "Karbon kaynak dağılımı henüz sınırlı."
    }`,
    actionLabel: "Takip notu",
    actionNote: "Trend çizgisini koru ve hedef sağlığını haftalık kontrol et.",
    tone: "default"
  };
}

function buildSignals(dashboard: DashboardResponse): SmartSignal[] {
  const topEnergy = getPrimaryBreakdownItem(dashboard.energyByCategory);
  const topCarbon = getPrimaryBreakdownItem(dashboard.carbonBySource);
  const { overdue, lowProgress, healthyCount } = getGoalRiskSummary(dashboard.activeGoals);
  const carbonChange = getPercentChange(
    dashboard.currentMonth.totalCO2eKg,
    dashboard.lastMonth.totalCO2eKg
  );
  const waterChange = getPercentChange(
    dashboard.currentMonth.totalWaterLiters,
    dashboard.lastMonth.totalWaterLiters
  );

  return [
    {
      title: "En baskın enerji alanı",
      value: topEnergy
        ? `${topEnergy.category} · %${formatNumberLabel(topEnergy.percentageOfTotal, 0)}`
        : "Veri bekleniyor",
      description: topEnergy
        ? `${formatNumberLabel(topEnergy.value)} ${topEnergy.unit} ile toplam tüketimin büyük kısmını taşıyor.`
        : "Enerji kaydı geldikçe kategori önceliği burada görünecek.",
      tone: topEnergy && topEnergy.percentageOfTotal >= 45 ? "warning" : "default"
    },
    {
      title: "Karbon yönü",
      value: formatDeltaLabel(carbonChange),
      description: topCarbon
        ? `${topCarbon.category} şu an emisyon dağılımında ilk sırada.`
        : "Karbon girdisi geldikçe kaynak baskısı analiz edilecek.",
      tone: carbonChange <= -5 ? "good" : carbonChange >= 8 ? "warning" : "default"
    },
    {
      title: "Hedef sağlığı",
      value:
        overdue.length > 0
          ? `${overdue.length} geciken hedef`
          : lowProgress.length > 0
            ? `${lowProgress.length} riskli hedef`
            : `${healthyCount} sağlıklı hedef`,
      description:
        overdue.length > 0
          ? "Takvim gerisindeki hedefler var; öncelikli aksiyon planı gerekir."
          : lowProgress.length > 0
            ? "İlerleme düşük; ilgili modüllerde veri ve aksiyon sıklığını artır."
            : "Aktif hedefler genel olarak plan içinde ilerliyor.",
      tone: overdue.length > 0 || lowProgress.length > 0 ? "warning" : "good"
    },
    {
      title: "Su eğilimi",
      value: formatDeltaLabel(waterChange),
      description:
        dashboard.currentMonth.totalWaterLiters > 0
          ? "Su tüketim trendi, operasyon yoğunluğuyla birlikte izleniyor."
          : "Su modülünde yeni kayıt eklendikçe aylık kıyas başlayacak.",
      tone: waterChange >= 10 ? "warning" : waterChange <= -5 ? "good" : "default"
    }
  ];
}

function getRecommendationList(dashboard: DashboardResponse) {
  const topEnergy = getPrimaryBreakdownItem(dashboard.energyByCategory);
  const topWaste = getPrimaryBreakdownItem(dashboard.wasteByCategory);
  const topCarbon = getPrimaryBreakdownItem(dashboard.carbonBySource);
  const { overdue, lowProgress } = getGoalRiskSummary(dashboard.activeGoals);

  const items = [
    topCarbon
      ? {
          title: `${topCarbon.category} kaynağını küçült`,
          detail: `Toplam karbon etkisinin %${formatNumberLabel(topCarbon.percentageOfTotal, 0)} kısmı burada oluşuyor.`
        }
      : null,
    topEnergy
      ? {
          title: `${topEnergy.category} tüketimini ayrıştır`,
          detail: "Bu alan için alt kırılım ve vardiya bazlı takip daha hızlı kazanım sağlar."
        }
      : null,
    topWaste
      ? {
          title: `${topWaste.category} atığını yakından izle`,
          detail: "Atık tarafında en yüksek payı alan kategori için azaltım aksiyonu belirle."
        }
      : null,
    overdue[0]
      ? {
          title: `${overdue[0].name} hedefini toparla`,
          detail: `Hedefin bitiş tarihi ${formatDateLabel(overdue[0].endDate)} ve şu an gecikmiş durumda.`
        }
      : null,
    lowProgress[0]
      ? {
          title: `${lowProgress[0].name} için ivme yarat`,
          detail: `Hedef uyumu şu an %${formatNumberLabel(getGoalHealthPercent(lowProgress[0]), 0)} seviyesinde.`
        }
      : null
  ].filter(Boolean) as Array<{ title: string; detail: string }>;

  return items.slice(0, 3);
}

function StatTile({ label, value, helper, progress, deltaLabel, tone = "default" }: StatTileProps) {
  return (
    <article className={`stat-tile stat-tile--${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-helper">{helper}</span>
      {deltaLabel ? <span className={`metric-helper metric-helper--${tone}`}>{deltaLabel}</span> : null}
      {typeof progress === "number" ? (
        <div className="progress-track progress-track--compact">
          <div className="progress-fill" style={{ width: `${clampPercent(progress)}%` }} />
        </div>
      ) : null}
    </article>
  );
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
  items: CategoryBreakdown[];
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
            <span className="breakdown-fill" style={{ width: `${clampPercent(item.percentageOfTotal)}%` }} />
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

  const insights = useMemo(() => (dashboard ? buildSignals(dashboard) : []), [dashboard]);
  const recommendations = useMemo(() => (dashboard ? getRecommendationList(dashboard) : []), [dashboard]);

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
  const headlineProgress = clampPercent(
    getPercentChange(dashboard.currentMonth.recordCount, Math.max(dashboard.lastMonth.recordCount, 1))
  );
  const energyChange = getPercentChange(
    dashboard.currentMonth.totalEnergyKWh,
    dashboard.lastMonth.totalEnergyKWh
  );
  const waterChange = getPercentChange(
    dashboard.currentMonth.totalWaterLiters,
    dashboard.lastMonth.totalWaterLiters
  );
  const wasteChange = getPercentChange(
    dashboard.currentMonth.totalWasteKg,
    dashboard.lastMonth.totalWasteKg
  );
  const carbonChange = getPercentChange(
    dashboard.currentMonth.totalCO2eKg,
    dashboard.lastMonth.totalCO2eKg
  );
  const narrative = getDashboardNarrative(dashboard);
  const topEnergy = getPrimaryBreakdownItem(dashboard.energyByCategory);
  const topCarbon = getPrimaryBreakdownItem(dashboard.carbonBySource);

  return (
    <div className="dashboard-page page-stack">
      <section className="page-hero page-hero--split">
        <div>
          <p className="page-kicker">Kontrol merkezi / Genel görünüm</p>
          <h1 className="page-title">Sürdürülebilirlik operasyonunun canlı özeti</h1>
          <p className="page-description">
            Bu ayın tüketim, emisyon ve hedef performansını tek ekranda izle. Dashboard artık sadece veri
            göstermiyor; öncelikli riskleri ve sonraki adımı da öneriyor.
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
          deltaLabel={`Geçen aya göre ${formatDeltaLabel(energyChange)}`}
          tone={energyChange > 8 ? "warning" : energyChange < -5 ? "good" : "default"}
        />
        <StatTile
          label="Su"
          value={`${formatNumberLabel(dashboard.currentMonth.totalWaterLiters)} L`}
          helper="Bu ay toplam tüketim"
          deltaLabel={`Geçen aya göre ${formatDeltaLabel(waterChange)}`}
          tone={waterChange > 8 ? "warning" : waterChange < -5 ? "good" : "default"}
        />
        <StatTile
          label="Atık"
          value={`${formatNumberLabel(dashboard.currentMonth.totalWasteKg)} kg`}
          helper="Bu ay toplam çıktı"
          deltaLabel={`Geçen aya göre ${formatDeltaLabel(wasteChange)}`}
          tone={wasteChange > 8 ? "warning" : wasteChange < -5 ? "good" : "default"}
        />
        <StatTile
          label="Karbon"
          value={`${formatNumberLabel(dashboard.currentMonth.totalCO2eKg)} kgCO2e`}
          helper="Aylık toplam etki"
          deltaLabel={`Geçen aya göre ${formatDeltaLabel(carbonChange)}`}
          progress={headlineProgress}
          tone={carbonChange > 8 ? "warning" : carbonChange < -5 ? "good" : "default"}
        />
      </section>

      <section className="spotlight-grid">
        <article className={`spotlight-card spotlight-card--${narrative.tone}`}>
          <div className="spotlight-card-inner">
            <div className="spotlight-topline">
              <span className="spotlight-chip">{narrative.chip}</span>
              <span className="spotlight-caption">CO2</span>
            </div>

            <div className="spotlight-content">
              <h2>{narrative.headline}</h2>
              <p>{narrative.summary}</p>
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

            <div className="spotlight-smart-note">
              <span>{narrative.actionLabel}</span>
              <strong>{narrative.actionNote}</strong>
            </div>

            <div className="spotlight-meta">
              <span>Bu ay: {formatNumberLabel(dashboard.currentMonth.recordCount, 0)} kayıt</span>
              <span>Geçen ay: {formatNumberLabel(dashboard.lastMonth.recordCount, 0)} kayıt</span>
            </div>
          </div>
        </article>

        <div className="spotlight-side">
          <article className="insight-card">
            <p className="eyebrow">Risk radarı</p>
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
                <span>En baskın enerji alanı</span>
                <strong>{topEnergy?.category ?? "Bekleniyor"}</strong>
              </div>
              <div className="list-row">
                <span>En baskın karbon kaynağı</span>
                <strong>{topCarbon?.category ?? "Bekleniyor"}</strong>
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

      <section className="dashboard-smart-grid">
        {insights.map((insight) => (
          <article key={insight.title} className={`smart-card smart-card--${insight.tone}`}>
            <span className="smart-card-title">{insight.title}</span>
            <strong className="smart-card-value">{insight.value}</strong>
            <p className="smart-card-description">{insight.description}</p>
          </article>
        ))}
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
          <p className="eyebrow">Akıllı öneriler</p>
          <h2>Önce neye odaklanmalı?</h2>
          {recommendations.length ? (
            <div className="recommendation-list">
              {recommendations.map((item) => (
                <div key={item.title} className="recommendation-row">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Öneri üretmek için daha fazla veri lazım"
              message="Dashboard veri hacmi arttıkça daha net aksiyon önerileri üretecek."
            />
          )}
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
                <span className="entry-pill">%{formatNumberLabel(getGoalHealthPercent(featuredGoal), 0)}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${getGoalHealthPercent(featuredGoal)}%` }}
                />
              </div>
              <p className="muted">{formatGoalHealthLabel(featuredGoal)}</p>
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
                  <strong>%{formatNumberLabel(getGoalHealthPercent(goal), 0)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
