import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import {
  formatDateLabel,
  formatPlanLabel,
  formatRoleLabel,
  formatSubscriptionStatusLabel
} from "../../lib/formatting";
import { apiRequest, ApiError } from "../../lib/http";
import type { ApiKey, Plan, Subscription } from "../../types/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function SettingsPage() {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);

  const isAdmin = session?.user.role === 0 || session?.user.role === "Admin";

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      setApiKeyMessage(null);

      try {
        const [subscriptionResponse, plansResponse] = await Promise.all([
          apiRequest<Subscription>("/api/subscriptions/current"),
          apiRequest<Plan[]>("/api/subscriptions/plans")
        ]);

        if (!cancelled) {
          setSubscription(subscriptionResponse);
          setPlans(plansResponse);
        }

        if (isAdmin) {
          try {
            const apiKeyResponse = await apiRequest<ApiKey[]>("/api/apikeys");

            if (!cancelled) {
              setApiKeys(apiKeyResponse);
            }
          } catch (err) {
            if (!cancelled) {
              setApiKeys([]);
              setApiKeyMessage(err instanceof ApiError ? err.message : "API anahtarı bilgisi alınamadı.");
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Ayarlar yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return (
    <div className="module-stack">
      <section className="module-grid">
        <article className="card">
          <p className="eyebrow">Abonelik</p>
          <h2>Plan ve kullanım özeti</h2>
          <p className="muted">
            Bu alan `GET /api/subscriptions/current` ve `GET /api/subscriptions/plans` verilerini kullanır.
          </p>

          {loading ? (
            <div className="empty-state">
              <strong>Abonelik bilgisi yükleniyor</strong>
              <span>Aktif plan ve limitler getiriliyor.</span>
            </div>
          ) : null}

          {!loading && error ? <p className="error-banner">{error}</p> : null}

          {!loading && !error && subscription ? (
            <>
              <div className="module-stat-grid">
                <div className="mini-card soft">
                  <strong>{subscription.planDisplayName}</strong>
                  <span>Aktif plan</span>
                </div>
                <div className="mini-card soft">
                  <strong>{subscription.recordsThisMonth}</strong>
                  <span>Bu ay kullanılan kayıt</span>
                </div>
                <div className="mini-card soft">
                  <strong>{subscription.exportsThisMonth}</strong>
                  <span>Bu ay kullanılan export</span>
                </div>
              </div>

              <div className="list-stack module-insight-list">
                <div className="list-row">
                  <span>Durum</span>
                  <strong>{formatSubscriptionStatusLabel(subscription.status)}</strong>
                </div>
                <div className="list-row">
                  <span>Dönem sonu</span>
                  <strong>{formatDateLabel(subscription.currentPeriodEnd)}</strong>
                </div>
                <div className="list-row">
                  <span>Kayıt limiti</span>
                  <strong>
                    {subscription.recordsThisMonth} / {subscription.maxRecordsPerMonth}
                  </strong>
                </div>
                <div className="list-row">
                  <span>Export limiti</span>
                  <strong>
                    {subscription.exportsThisMonth} / {subscription.maxExportsPerMonth}
                  </strong>
                </div>
              </div>
            </>
          ) : null}
        </article>

        <article className="card">
          <p className="eyebrow">Çalışma Alanı</p>
          <h2>Takım ve erişim özeti</h2>
          <p className="muted">Mevcut kullanıcının rolünü ve gelişmiş plan özelliklerini hızlıca görebilirsin.</p>

          <div className="module-stat-grid">
            <div className="mini-card soft">
              <strong>{formatRoleLabel(session?.user.role)}</strong>
              <span>Aktif kullanıcı rolü</span>
            </div>
            <div className="mini-card soft">
              <strong>{plans.some((plan) => plan.canUseApiKeys) ? "Var" : "Yok"}</strong>
              <span>API anahtarı destekli plan</span>
            </div>
            <div className="mini-card soft">
              <strong>{plans.some((plan) => plan.canUseWebhooks) ? "Var" : "Yok"}</strong>
              <span>Webhook destekli plan</span>
            </div>
          </div>

          {isAdmin ? (
            apiKeyMessage ? (
              <p className="error-banner module-insight-list">{apiKeyMessage}</p>
            ) : (
              <div className="list-stack module-insight-list">
                <div className="list-row">
                  <span>API anahtarı sayısı</span>
                  <strong>{apiKeys.length}</strong>
                </div>
                <div className="list-row">
                  <span>İlk aktif anahtar</span>
                  <strong>{apiKeys.find((item) => item.isActive)?.keyPrefix ?? "Yok"}</strong>
                </div>
              </div>
            )
          ) : (
            <p className="muted module-insight-list">API anahtarı yönetimi sadece yönetici rolünde görünür.</p>
          )}
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Planlar</p>
            <h2>Mevcut planlar ve özellikler</h2>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>Planlar yükleniyor</strong>
            <span>Liste birazdan görünecek.</span>
          </div>
        ) : null}

        {!loading && !error && plans.length > 0 ? (
          <div className="entry-list">
            {plans.map((plan) => (
              <article key={plan.id} className="entry-card">
                <div className="entry-card-header">
                  <div>
                    <strong>{plan.displayName}</strong>
                    <p className="muted">{formatPlanLabel(plan.name)}</p>
                  </div>
                  <div className="entry-side">
                    <span className="entry-pill">{formatCurrency(plan.monthlyPrice)}/ay</span>
                    <span className="entry-value">{formatCurrency(plan.yearlyPrice)}/yıl</span>
                  </div>
                </div>

                <div className="entry-meta">
                  <span>Kayıt limiti: {plan.maxRecordsPerMonth}</span>
                  <span>Export limiti: {plan.maxExportsPerMonth}</span>
                </div>

                <div className="chip-row">
                  <span className={plan.canExport ? "feature-chip active" : "feature-chip"}>Export</span>
                  <span className={plan.canUseApiKeys ? "feature-chip active" : "feature-chip"}>API Anahtarları</span>
                  <span className={plan.canUseWebhooks ? "feature-chip active" : "feature-chip"}>Webhook</span>
                  <span className={plan.canAccessAdvancedReports ? "feature-chip active" : "feature-chip"}>
                    Gelişmiş Raporlar
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">API Anahtarları</p>
              <h2>Görünür anahtarlar</h2>
            </div>
          </div>

          {apiKeyMessage ? <p className="error-banner">{apiKeyMessage}</p> : null}

          {!apiKeyMessage && apiKeys.length === 0 ? (
            <div className="empty-state">
              <strong>Görünür API anahtarı yok</strong>
              <span>Plan destekliyorsa backend tarafından yeni anahtar oluşturulabilir.</span>
            </div>
          ) : null}

          {!apiKeyMessage && apiKeys.length > 0 ? (
            <div className="entry-list">
              {apiKeys.map((key) => (
                <article key={key.id} className="entry-card">
                  <div className="entry-card-header">
                    <div>
                      <strong>{key.name}</strong>
                      <p className="muted">{key.keyPrefix}</p>
                    </div>
                    <div className="entry-side">
                      <span className={key.isActive ? "entry-pill" : "entry-pill muted-pill"}>
                        {key.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                  </div>

                  <div className="entry-meta">
                    <span>Oluşturma: {formatDateLabel(key.createdAt)}</span>
                    <span>Son kullanım: {formatDateLabel(key.lastUsedAt)}</span>
                    <span>Bitiş: {formatDateLabel(key.expiresAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
