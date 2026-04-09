import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/http";
import { useAuth } from "../../auth/auth-context";

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
      setError("Sifre alanlari ayni olmali.");
      return;
    }

    setSubmitting(true);

    try {
      await signUp({ companyName, firstName, lastName, email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Kayit sirasinda beklenmeyen bir hata olustu.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form">
      <p className="eyebrow">Kayit Ol</p>
      <h2>Yeni sirket ve yonetici kullanici olustur</h2>
      <p className="muted">
        Backend sozlesmesine gore ilk kayit sirketi ve admin kullaniciyi birlikte acar.
      </p>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          <span>Sirket adi</span>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Greenlytics"
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
          <span>E-posta</span>
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
            <span>Sifre</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Guvenceli bir sifre"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span>Sifre tekrar</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Sifreyi tekrar et"
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Kayit olusturuluyor..." : "Sirketi olustur"}
        </button>
      </form>

      <button type="button" className="text-button" onClick={onSwitchMode}>
        Zaten hesabin var mi? Giris yap.
      </button>
    </div>
  );
}
