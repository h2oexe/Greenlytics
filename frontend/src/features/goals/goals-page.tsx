import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import {
  formatDateLabel,
  formatGoalStatusLabel,
  formatNumberLabel,
  formatRoleLabel
} from "../../lib/formatting";
import { ApiError, apiRequest } from "../../lib/http";
import type { Goal, GoalPeriod, GoalProgress, GoalType } from "../../types/api";

interface GoalFormState {
  type: GoalType;
  name: string;
  description: string;
  targetValue: string;
  unit: string;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
}

const goalTypes: Array<{ value: GoalType; label: string; defaultUnit: string }> = [
  { value: 0, label: "Enerji", defaultUnit: "kWh" },
  { value: 1, label: "Su", defaultUnit: "L" },
  { value: 2, label: "Atık", defaultUnit: "kg" },
  { value: 3, label: "Karbon", defaultUnit: "kgCO2e" }
];

const goalPeriods: Array<{ value: GoalPeriod; label: string }> = [
  { value: 0, label: "Aylık" },
  { value: 1, label: "Çeyreklik" },
  { value: 2, label: "Yıllık" }
];

function getGoalTypeLabel(type: GoalType) {
  return goalTypes.find((item) => item.value === type)?.label ?? "Bilinmeyen";
}

function getGoalPeriodLabel(period: GoalPeriod) {
  return goalPeriods.find((item) => item.value === period)?.label ?? "Dönem";
}

function toApiDateTime(value: string) {
  return `${value}T12:00:00`;
}

function createInitialFormState(): GoalFormState {
  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
    .toISOString()
    .slice(0, 10);

  return {
    type: 0,
    name: "",
    description: "",
    targetValue: "",
    unit: "kWh",
    period: 0,
    startDate,
    endDate
  };
}

export function GoalsPage() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progressItems, setProgressItems] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<GoalFormState>(() => createInitialFormState());

  const canManage =
    session?.user.role === 0 ||
    session?.user.role === 1 ||
    session?.user.role === "Admin" ||
    session?.user.role === "Manager";

  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      setLoading(true);
      setError(null);

      try {
        const [goalsResponse, progressResponse] = await Promise.all([
          apiRequest<Goal[]>("/api/goals"),
          apiRequest<GoalProgress[]>("/api/goals/progress/all")
        ]);

        if (!cancelled) {
          setGoals(goalsResponse);
          setProgressItems(progressResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Hedefler yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGoals();

    return () => {
      cancelled = true;
    };
  }, []);

  const progressByGoalId = useMemo(
    () => new Map(progressItems.map((item) => [item.goalId, item])),
    [progressItems]
  );

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === 0), [goals]);
  const achievedGoals = useMemo(
    () => progressItems.filter((item) => item.isAchieved).length,
    [progressItems]
  );
  const overdueGoals = useMemo(
    () => progressItems.filter((item) => item.isOverdue).length,
    [progressItems]
  );
  const completionRate = useMemo(() => {
    if (progressItems.length === 0) {
      return 0;
    }

    return Math.round(
      progressItems.reduce((sum, item) => sum + Math.max(0, Math.min(item.progressPercent, 100)), 0) /
        progressItems.length
    );
  }, [progressItems]);

  async function refreshGoals() {
    const [goalsResponse, progressResponse] = await Promise.all([
      apiRequest<Goal[]>("/api/goals"),
      apiRequest<GoalProgress[]>("/api/goals/progress/all")
    ]);

    setGoals(goalsResponse);
    setProgressItems(progressResponse);
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
      await apiRequest<Goal>("/api/goals", {
        method: "POST",
        body: {
          type: form.type,
          name: form.name.trim(),
          description: form.description.trim() || null,
          targetValue: Number(form.targetValue),
          unit: form.unit.trim(),
          period: form.period,
          startDate: toApiDateTime(form.startDate),
          endDate: toApiDateTime(form.endDate)
        }
      });

      setForm(createInitialFormState());
      setSubmitSuccess("Yeni hedef oluşturuldu.");
      await refreshGoals();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Hedef oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  function handleTypeChange(type: GoalType) {
    const defaultUnit = goalTypes.find((item) => item.value === type)?.defaultUnit ?? "";

    setForm((current) => ({
      ...current,
      type,
      unit: defaultUnit
    }));
  }

  const featuredGoal = activeGoals[0];
  const featuredProgress = featuredGoal ? progressByGoalId.get(featuredGoal.id) : undefined;

  return (
    <div className="page-stack">
      <section className="page-hero page-hero--split">
        <div>
          <p className="page-kicker" lang="en">
            Organization / Goals
          </p>
          <h1 className="page-title">Sürdürülebilirlik hedeflerini görünür hale getir</h1>
          <p className="page-description">
            Kurumsal taahhütleri aktif hedeflere dönüştür, ilerlemeyi canlı izle ve hangi başlıkların
            desteğe ihtiyaç duyduğunu tek bakışta gör.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="primary-button">
            Yeni hedef ekle
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-tile">
          <span className="stat-label">Aktif hedef</span>
          <strong className="stat-value">{activeGoals.length}</strong>
          <span className="stat-helper">Canlı takibe alınan hedefler</span>
        </article>
        <article className="stat-tile">
          <span className="stat-label">Tamamlanma oranı</span>
          <strong className="stat-value">%{completionRate}</strong>
          <span className="stat-helper">Ortalama ilerleme</span>
          <div className="progress-track progress-track--compact">
            <div className="progress-fill" style={{ width: `${completionRate}%` }} />
          </div>
        </article>
        <article className="stat-tile">
          <span className="stat-label">Tamamlanan</span>
          <strong className="stat-value">{achievedGoals}</strong>
          <span className="stat-helper">Eşiği yakalayan hedefler</span>
        </article>
        <article className="stat-tile">
          <span className="stat-label">Riskte olan</span>
          <strong className="stat-value">{overdueGoals}</strong>
          <span className="stat-helper">Süresi geçen aktif hedefler</span>
        </article>
      </section>

      <section className="spotlight-grid">
        <article className="spotlight-card">
          <div className="spotlight-card-inner">
            <div className="spotlight-topline">
              <span className="spotlight-chip">Öncelikli hedef</span>
              <span className="spotlight-caption">Goals</span>
            </div>

            {featuredGoal ? (
              <>
                <div className="spotlight-content">
                  <h2>{featuredGoal.name}</h2>
                  <p>{featuredGoal.description?.trim() || "Bu hedef için açıklama girilmedi."}</p>
                </div>

                <div className="spotlight-progress">
                  <div className="spotlight-progress-row">
                    <span>İlerleme</span>
                    <strong>%{formatNumberLabel(featuredProgress?.progressPercent ?? 0, 0)}</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(Math.max(featuredProgress?.progressPercent ?? 0, 0), 100)}%`
                      }}
                    />
                  </div>
                </div>

                <div className="spotlight-meta">
                  <span>Başlangıç: {formatDateLabel(featuredGoal.startDate)}</span>
                  <span>Bitiş: {formatDateLabel(featuredGoal.endDate)}</span>
                </div>
              </>
            ) : (
              <div className="spotlight-content">
                <h2>Henüz aktif hedef bulunmuyor</h2>
                <p>Sağdaki formdan ilk hedefi ekleyerek bu alanı doldurabilirsin.</p>
              </div>
            )}
          </div>
        </article>

        <div className="spotlight-side">
          <article className="insight-card">
            <p className="eyebrow">Operasyon</p>
            <h3>Hedef sağlığı</h3>
            <div className="list-stack">
              <div className="list-row">
                <span>Toplam hedef</span>
                <strong>{goals.length}</strong>
              </div>
              <div className="list-row">
                <span>Aktif kullanıcı rolü</span>
                <strong>{formatRoleLabel(session?.user.role)}</strong>
              </div>
              <div className="list-row">
                <span>Canlı ilerleme kaydı</span>
                <strong>{progressItems.length}</strong>
              </div>
            </div>
          </article>

          {activeGoals.slice(1, 3).map((goal) => {
            const progress = progressByGoalId.get(goal.id);

            return (
              <article key={goal.id} className="insight-card">
                <div className="compact-card-topline">
                  <span className="entry-pill">{getGoalTypeLabel(goal.type)}</span>
                  <span className="muted">{getGoalPeriodLabel(goal.period)}</span>
                </div>
                <h3>{goal.name}</h3>
                <p className="muted">{goal.description?.trim() || "Açıklama eklenmedi."}</p>
                <div className="spotlight-progress-row">
                  <span>İlerleme</span>
                  <strong>%{formatNumberLabel(progress?.progressPercent ?? 0, 0)}</strong>
                </div>
                <div className="progress-track progress-track--compact">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(Math.max(progress?.progressPercent ?? 0, 0), 100)}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="content-grid">
        <article className="card">
          <p className="eyebrow">Yeni hedef</p>
          <h2>Sürdürülebilirlik hedefi ekle</h2>
          <p className="muted">
            {canManage
              ? "Yönetici ve sorumlu kullanıcılar hedef oluşturabilir."
              : "Görüntüleyici rolünde form görünür, ancak hedef oluşturma yetkisi yoktur."}
          </p>

          <form className="module-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label className="field">
                <span>Hedef tipi</span>
                <select
                  value={form.type}
                  onChange={(event) => handleTypeChange(Number(event.target.value) as GoalType)}
                  disabled={!canManage || saving}
                >
                  {goalTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Dönem</span>
                <select
                  value={form.period}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      period: Number(event.target.value) as GoalPeriod
                    }))
                  }
                  disabled={!canManage || saving}
                >
                  {goalPeriods.map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Hedef adı</span>
                <input
                  type="text"
                  placeholder="Aylık enerji tüketimini azalt"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>

              <label className="field">
                <span>Hedef değeri</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="1200"
                  value={form.targetValue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      targetValue: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Birim</span>
                <input
                  type="text"
                  placeholder="kWh / L / kg / kgCO2e"
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

              <label className="field">
                <span>Açıklama</span>
                <input
                  type="text"
                  placeholder="Bu hedef hangi iyileştirmeyi izliyor?"
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

            <div className="field-grid">
              <label className="field">
                <span>Başlangıç</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startDate: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>

              <label className="field">
                <span>Bitiş</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endDate: event.target.value
                    }))
                  }
                  disabled={!canManage || saving}
                  required
                />
              </label>
            </div>

            {submitError ? <p className="error-banner">{submitError}</p> : null}
            {submitSuccess ? <p className="success-banner">{submitSuccess}</p> : null}

            <button type="submit" className="primary-button" disabled={!canManage || saving}>
              {saving ? "Kaydediliyor..." : "Hedef ekle"}
            </button>
          </form>
        </article>

        <article className="card">
          <p className="eyebrow" lang="en">
            Goal Library
          </p>
          <h2>Hedef listesi ve ilerleme</h2>

          {loading ? (
            <div className="empty-state">
              <strong>Hedefler yükleniyor</strong>
              <span>Liste ve canlı ilerleme backend'den getiriliyor.</span>
            </div>
          ) : null}

          {!loading && error ? <p className="error-banner">{error}</p> : null}

          {!loading && !error && goals.length === 0 ? (
            <div className="empty-state">
              <strong>Henüz hedef yok</strong>
              <span>Soldaki formdan ilk sürdürülebilirlik hedefini oluşturabilirsin.</span>
            </div>
          ) : null}

          {!loading && !error && goals.length > 0 ? (
            <div className="entry-list entry-list--single">
              {goals.map((goal) => {
                const progress = progressByGoalId.get(goal.id);

                return (
                  <article key={goal.id} className="entry-card">
                    <div className="entry-card-header">
                      <div>
                        <strong>{goal.name}</strong>
                        <p className="muted">
                          {getGoalTypeLabel(goal.type)} · {getGoalPeriodLabel(goal.period)}
                        </p>
                      </div>

                      <div className="entry-side">
                        <span className="entry-pill">{formatGoalStatusLabel(goal.status)}</span>
                        <span className="entry-value">
                          %{formatNumberLabel(progress?.progressPercent ?? 0, 0)}
                        </span>
                      </div>
                    </div>

                    <div className="entry-meta">
                      <span>
                        Hedef: {formatNumberLabel(goal.targetValue)} {goal.unit}
                      </span>
                      <span>
                        Mevcut: {formatNumberLabel(progress?.currentValue ?? 0)} {goal.unit}
                      </span>
                      <span>
                        {formatDateLabel(goal.startDate)} - {formatDateLabel(goal.endDate)}
                      </span>
                    </div>

                    <p className="entry-notes">
                      {goal.description?.trim() || "Bu hedef için açıklama girilmedi."}
                    </p>

                    <div className="progress-track progress-track--compact">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(Math.max(progress?.progressPercent ?? 0, 0), 100)}%`
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
