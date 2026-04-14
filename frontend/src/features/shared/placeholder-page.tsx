interface PlaceholderPageProps {
  title: string;
  description: string;
  endpoint: string;
}

export function PlaceholderPage({ title, description, endpoint }: PlaceholderPageProps) {
  return (
    <section className="placeholder-card">
      <p className="eyebrow">Sıradaki modül</p>
      <h2>{title}</h2>
      <p className="muted">{description}</p>

      <div className="placeholder-grid">
        <article className="mini-card">
          <strong>İlk endpoint</strong>
          <span>{endpoint}</span>
        </article>
        <article className="mini-card">
          <strong>UI ihtiyacı</strong>
          <span>Liste, filtre, detay ve form akışlarını tasarlayabiliriz.</span>
        </article>
        <article className="mini-card">
          <strong>Sonraki hedef</strong>
          <span>Bu modül için gerçek tablo ve form komponentleri oluşturmak.</span>
        </article>
      </div>
    </section>
  );
}
