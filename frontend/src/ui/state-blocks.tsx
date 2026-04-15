import type { ReactNode } from "react";

interface StateBlockProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function LoadingState({ title, message, action }: StateBlockProps) {
  return (
    <div className="state-block state-block--loading" aria-busy="true">
      <div className="state-skeleton state-skeleton--title" />
      <div className="state-skeleton state-skeleton--line" />
      <div className="state-skeleton state-skeleton--line short" />
      <div className="state-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, message, action }: StateBlockProps) {
  return (
    <div className="state-block state-block--empty">
      <div className="state-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, message, action }: StateBlockProps) {
  return (
    <div className="state-block state-block--error">
      <div className="state-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="state-skeleton state-skeleton--kicker" />
        <div className="state-skeleton state-skeleton--hero" />
        <div className="state-skeleton state-skeleton--line" />
        <div className="state-skeleton state-skeleton--line short" />
      </section>

      <section className="stats-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="stat-tile stat-tile--skeleton">
            <div className="state-skeleton state-skeleton--tiny" />
            <div className="state-skeleton state-skeleton--metric" />
            <div className="state-skeleton state-skeleton--line short" />
          </article>
        ))}
      </section>

      <section className="spotlight-grid">
        <article className="spotlight-card spotlight-card--skeleton">
          <div className="spotlight-card-inner">
            <div className="state-skeleton state-skeleton--tiny wide" />
            <div className="state-skeleton state-skeleton--hero" />
            <div className="state-skeleton state-skeleton--line" />
            <div className="state-skeleton state-skeleton--line short" />
          </div>
        </article>

        <div className="spotlight-side">
          <article className="insight-card state-block--loading">
            <div className="state-skeleton state-skeleton--tiny" />
            <div className="state-skeleton state-skeleton--line" />
            <div className="state-skeleton state-skeleton--line short" />
          </article>
          <article className="insight-card state-block--loading">
            <div className="state-skeleton state-skeleton--tiny" />
            <div className="state-skeleton state-skeleton--line" />
            <div className="state-skeleton state-skeleton--line short" />
          </article>
        </div>
      </section>
    </div>
  );
}
