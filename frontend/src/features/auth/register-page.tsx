import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/auth-context";
import { ApiError } from "../../lib/http";

interface RegisterPageProps {
  onSwitchMode: () => void;
}

export function RegisterPage({ onSwitchMode }: RegisterPageProps) {
  const { signUp } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Şifre alanları aynı olmalı.");
      return;
    }

    setSubmitting(true);

    try {
      await signUp({ companyName, firstName, lastName, email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Kayıt sırasında beklenmeyen bir hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-form-heading">
        <p className="eyebrow">Kurulum</p>
        <h3>Yeni şirket ve yönetici kullanıcı oluştur</h3>
        <p className="muted">
          İlk kayıt, şirket alanını ve yönetici kullanıcıyı birlikte açar. Sonraki ekip üyeleri bu
          alan altında çalışır.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          <span>Şirket adı</span>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Greenlytics Türkiye"
            required
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Ad</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Ada"
              required
            />
          </label>

          <label className="field">
            <span>Soyad</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Lovelace"
              required
            />
          </label>
        </div>

        <label className="field">
          <span>İş e-postası</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@greenlytics.com"
            autoComplete="email"
            required
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Güçlü bir şifre belirle"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span>Şifre tekrar</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Şifreyi yeniden gir"
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

        <button type="submit" className="primary-button primary-button--large" disabled={submitting}>
          {submitting ? "Alan hazırlanıyor..." : "Şirket alanını oluştur"}
        </button>
      </form>

      <button type="button" className="text-button auth-switch-link" onClick={onSwitchMode}>
        Zaten hesabın var mı? Giriş yap.
      </button>
    </div>
  );
}
