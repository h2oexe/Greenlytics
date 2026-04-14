import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/auth-context";
import { ApiError } from "../../lib/http";

interface LoginPageProps {
  onSwitchMode: () => void;
}

export function LoginPage({ onSwitchMode }: LoginPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn({ email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-form-heading">
        <p className="eyebrow">Oturum aç</p>
        <h3>Kurumsal paneline bağlan</h3>
        <p className="muted">
          Swagger veya kayıt akışından oluşturduğun kullanıcıyla giriş yap. Token ve yenileme
          akışı otomatik yönetilir.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          <span>E-posta adresi</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@greenlytics.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <div className="field-label-row">
            <span>Şifre</span>
            <button type="button" className="ghost-link">
              Şifremi unuttum
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Şifreni gir"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="error-banner">{error}</p> : null}

        <button type="submit" className="primary-button primary-button--large" disabled={submitting}>
          {submitting ? "Giriş yapılıyor..." : "Panele gir"}
        </button>
      </form>

      <div className="auth-divider">
        <span>veya</span>
      </div>

      <button type="button" className="secondary-button secondary-button--wide">
        Kurumsal SSO ile devam et
      </button>

      <button type="button" className="text-button auth-switch-link" onClick={onSwitchMode}>
        Hesabın yok mu? Şirketini oluştur.
      </button>
    </div>
  );
}
