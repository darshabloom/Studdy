import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * THE DEMO'S VISUAL LANGUAGE, as a handful of small parts.
 *
 * Written against the brand ALIASES — `bg-brand`, `text-brand-strong`,
 * `bg-brand-tint` — and never against a hue, so nothing here knows the identity
 * is green. `app/demo/forest.css` points those four tokens at the forest
 * palette; production points them at the purple. Neither this file nor any page
 * built on it would need editing if that changed.
 *
 * Three rules are enforced by the parts rather than by discipline:
 *
 *   BRAND IS SPENT ON THREE THINGS — the dominant action, a committed lesson,
 *   and the current relationship. Generic "saved / sent / completed" feedback
 *   uses `neutral`, because a system where everything good is green has no way
 *   left to say "this is the thing to click".
 *
 *   CLAY MEANS A CLOCK IS RUNNING, and nothing else. It is the only colour a
 *   row can carry that is not the brand.
 *
 *   RULES, NOT BOXES. `RowList` separates with hairlines and whitespace instead
 *   of stacking bordered cards, which is most of why this reads as a workspace
 *   rather than as a dashboard.
 */

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

export type ButtonTone = 'primary' | 'secondary' | 'tertiary' | 'quiet' | 'destructive';

const buttonTone: Record<ButtonTone, string> = {
  // The dominant action. One per region — several in a row is the thing that
  // makes an interface feel like it is shouting.
  primary: 'bg-brand text-brand-contrast hover:bg-brand-strong border-transparent',
  // Also available, without entering the same contest. Reuses the tint that
  // already means "this one".
  secondary: 'bg-brand-tint text-brand-strong border-brand/15 hover:border-brand/35',
  tertiary: 'bg-transparent text-brand border-surface-border hover:border-brand/40',
  quiet: 'bg-transparent text-text-secondary border-transparent hover:text-text-primary underline underline-offset-4 decoration-surface-border',
  destructive: 'bg-transparent text-status-critical border-status-critical-border hover:bg-status-critical-bg',
};

const buttonSize = {
  sm: 'text-[13px] px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-[15px] px-5 py-2.5',
} as const;

export function DemoButton({
  href,
  tone = 'primary',
  size = 'md',
  children,
  className = '',
}: {
  href: string;
  tone?: ButtonTone;
  size?: keyof typeof buttonSize;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-[5px] border font-medium leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${buttonTone[tone]} ${buttonSize[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Chips
 * ------------------------------------------------------------------ */

export type ChipTone = 'neutral' | 'current' | 'attention' | 'committed' | 'ghost';

const chipTone: Record<ChipTone, string> = {
  // History, and every generic "done". Deliberately colourless.
  neutral: 'bg-surface-card-secondary text-text-secondary border-surface-border',
  // The relationship you are in right now: weekly, trial, your student.
  current: 'bg-brand-tint text-brand-strong border-brand/15',
  // A deadline is running.
  attention: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  // Booked, paid, committed.
  committed: 'bg-brand text-brand-contrast border-brand',
  // A stranger, a pause — something outside the normal run of things.
  ghost: 'bg-transparent text-text-muted border-surface-border',
};

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: ChipTone;
  children: ReactNode;
}): ReactNode {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${chipTone[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Initials disc
 * ------------------------------------------------------------------ */

/**
 * Initials in a sage disc.
 *
 * Explicit pixels rather than the numeric spacing scale: the design system
 * redefines `--spacing-5` upwards, so `h-9` renders 96px here, not 36px. A
 * fixed avatar size is a measurement, not a spacing step.
 */
export function Disc({
  initials,
  size = 'md',
}: {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  const dimension =
    size === 'lg'
      ? 'h-[52px] w-[52px] text-base'
      : size === 'sm'
        ? 'h-[30px] w-[30px] text-[11px]'
        : 'h-[38px] w-[38px] text-[13px]';
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-brand/15 bg-brand-tint font-semibold tracking-wide text-brand-strong ${dimension}`}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Page and section headings
 * ------------------------------------------------------------------ */

/** The display tier. Fraunces, because this line names a day or a person. */
export function PageHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  action?: ReactNode;
}): ReactNode {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow === undefined ? null : (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.018em] text-text-primary text-balance">
          {title}
        </h1>
        {sub === undefined ? null : <p className="mt-1.5 text-[13.5px] text-text-muted">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

/** A ruled section heading with its count or range on the right. */
export function SectionLine({
  title,
  meta,
  action,
  className = '',
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string | undefined;
}): ReactNode {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-3 border-b border-surface-border pb-2.5 ${className}`}
    >
      <h2 className="font-display text-[17px] font-semibold text-text-primary">{title}</h2>
      <div className="flex items-center gap-3 text-[12.5px] text-text-muted">
        {meta}
        {action}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ruled lists
 * ------------------------------------------------------------------ */

export function RowList({ children }: { children: ReactNode }): ReactNode {
  return <ul className="flex flex-col">{children}</ul>;
}

/**
 * One row in a ruled list.
 *
 * `attention` is the only variant that changes the row's ground, and it exists
 * so that a single row breaking an otherwise uniform pattern is unmissable. If
 * two rows in a list carry it, the list has stopped working.
 */
export function Row({
  href,
  attention = false,
  muted = false,
  children,
}: {
  href?: string;
  attention?: boolean;
  muted?: boolean;
  children: ReactNode;
}): ReactNode {
  const inner = (
    <div
      className={`flex items-center gap-3.5 border-b border-surface-border py-3 last:border-b-0 ${
        attention ? 'border-status-warning-border bg-status-warning-bg px-3' : ''
      } ${muted ? 'opacity-60' : ''} ${href === undefined ? '' : 'transition-colors hover:bg-brand-tint/40'}`}
    >
      {attention ? (
        <span aria-hidden className="w-[3px] self-stretch rounded-full bg-status-warning" />
      ) : null}
      {children}
    </div>
  );

  return (
    <li className={attention ? '-mx-3' : ''}>
      {href === undefined ? (
        inner
      ) : (
        <Link
          href={href}
          className="block rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          {inner}
        </Link>
      )}
    </li>
  );
}

/** The name-and-detail column that most rows lead with. */
export function RowMain({
  name,
  detail,
}: {
  name: ReactNode;
  detail?: ReactNode;
}): ReactNode {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-display text-base font-medium leading-tight text-text-primary">
        {name}
      </span>
      {detail === undefined ? null : (
        <span className="mt-0.5 block text-[12.5px] text-text-muted">{detail}</span>
      )}
    </span>
  );
}

export function RowMeta({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="shrink-0 text-right text-[12.5px] tabular-nums text-text-secondary">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Definition lists
 * ------------------------------------------------------------------ */

export function Facts({ children }: { children: ReactNode }): ReactNode {
  return <dl className="flex flex-col">{children}</dl>;
}

export function Fact({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}): ReactNode {
  return (
    <div
      className={`flex justify-between gap-6 border-b border-surface-border py-2 text-[13.5px] last:border-b-0 ${
        strong ? 'border-t border-t-surface-border font-semibold text-text-primary' : ''
      }`}
    >
      <dt className="text-text-muted">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? '' : 'font-medium text-text-primary'}`}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Notes
 * ------------------------------------------------------------------ */

/**
 * "In the real product, this happens without you."
 *
 * The demo collapses things that take hours in reality — a tutor noticing a
 * request, a webhook confirming a payment. Every one of those gets one of
 * these, so a reviewer can tell what the product does from what the demo is
 * standing in for.
 */
export function DemoNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="rounded-[4px] border border-dashed border-brand/35 bg-brand-tint/40 p-4">
      <p className="flex items-center gap-2.5 text-[13.5px] font-semibold text-brand-strong">
        <span
          aria-hidden
          className="rounded-full bg-brand px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand-contrast"
        >
          Demo
        </span>
        {title}
      </p>
      <div className="mt-2 text-[13.5px] text-text-secondary">{children}</div>
    </div>
  );
}

/** Information carries no hue. Neutral ink on the raised surface, and a rule. */
export function Aside({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="border-l-2 border-surface-border bg-surface-card-secondary px-4 py-3">
      <p className="text-[13.5px] font-semibold text-text-primary">{title}</p>
      <div className="mt-1 text-[13.5px] text-text-secondary">{children}</div>
    </div>
  );
}

/** The one screen state that is genuinely good news, and looks it. */
export function Confirmed({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="rounded-[4px] bg-brand px-5 py-4 text-brand-contrast">
      <p className="text-[11px] font-medium uppercase tracking-[0.09em] opacity-80">Confirmed</p>
      <p className="mt-1 font-display text-[19px] font-medium leading-snug">{title}</p>
      {children === undefined ? null : (
        <div className="mt-1.5 text-[13.5px] opacity-90">{children}</div>
      )}
    </div>
  );
}

export function ComingSoon({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="max-w-xl">
      <PageHead title={title} sub="Coming soon" />
      <div className="mt-6 border-l-2 border-surface-border bg-surface-card-secondary px-5 py-4">
        <p className="text-[14px] text-text-secondary">{children}</p>
      </div>
    </div>
  );
}
