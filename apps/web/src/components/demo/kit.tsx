import Link from 'next/link';
import type { ReactNode } from 'react';
import { money, split } from '@/lib/demo/fixtures';

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
  quiet:
    'bg-transparent text-text-secondary border-transparent hover:text-text-primary underline underline-offset-4 decoration-surface-border',
  destructive:
    'bg-transparent text-status-critical border-status-critical-border hover:bg-status-critical-bg',
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
      // No `whitespace-nowrap`: a chip carrying a date is wider than a phone,
      // and a chip that cannot wrap takes the whole page sideways with it.
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${chipTone[tone]}`}
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
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-surface-border py-3 last:border-b-0 ${
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
export function RowMain({ name, detail }: { name: ReactNode; detail?: ReactNode }): ReactNode {
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
    // `ml-auto` rather than `shrink-0`: a long date must be allowed to drop to
    // its own line on a narrow row instead of pushing the page sideways.
    <span className="ml-auto max-w-full text-right text-[12.5px] tabular-nums text-text-secondary">
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
export function DemoNote({ title, children }: { title: string; children: ReactNode }): ReactNode {
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
export function Aside({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="border-l-2 border-surface-border bg-surface-card-secondary px-4 py-3">
      <p className="text-[13.5px] font-semibold text-text-primary">{title}</p>
      <div className="mt-1 text-[13.5px] text-text-secondary">{children}</div>
    </div>
  );
}

/** The one screen state that is genuinely good news, and looks it. */
export function Confirmed({ title, children }: { title: string; children?: ReactNode }): ReactNode {
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

export function ComingSoon({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="max-w-xl">
      <PageHead title={title} sub="Coming soon" />
      <div className="mt-6 border-l-2 border-surface-border bg-surface-card-secondary px-5 py-4">
        <p className="text-[14px] text-text-secondary">{children}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Panels — the application structure
 * ------------------------------------------------------------------ */

/**
 * A contained, raised area of a screen.
 *
 * THE MIDDLE GROUND the demo was missing. Ruled lists on an open page read as
 * an article; a grid of identical bordered cards reads as a dashboard template.
 * A panel is neither: it groups one subject, carries its own heading and its
 * own actions, and is sized by what it holds rather than by a column count. A
 * screen is then two or three panels of visibly different weight, which is what
 * makes it scannable in a couple of seconds.
 *
 * `tone` is the whole vocabulary. `hero` for the one thing a screen is about,
 * `attention` for the one thing a clock is running on, `quiet` for reference.
 */
export type PanelTone = 'default' | 'hero' | 'quiet' | 'attention' | 'confirmed';

const panelTone: Record<PanelTone, string> = {
  default: 'bg-surface-card border-surface-border',
  hero: 'bg-brand-tint/45 border-brand/20',
  quiet: 'bg-surface-card-secondary border-surface-border',
  attention: 'bg-status-warning-bg border-status-warning-border',
  confirmed: 'bg-brand border-brand text-brand-contrast',
};

export function Panel({
  tone = 'default',
  href,
  className = '',
  children,
}: {
  tone?: PanelTone;
  /**
   * Makes the whole card the way in.
   *
   * A CLICKABLE CARD MUST NOT LOOK LIKE A STATIC ONE. Given an href, the card
   * lifts on hover, its border takes the brand, and it grows a chevron — so a
   * reader can tell at a glance which surfaces are objects they can open and
   * which are just information. Cards without one stay flat and are not
   * focusable, which is the other half of the same promise.
   */
  href?: string;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const base = `rounded-[6px] border ${panelTone[tone]} ${className}`;
  if (href === undefined) return <section className={base}>{children}</section>;

  return (
    <Link
      href={href}
      className={`group/card block transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-brand/45 hover:shadow-[0_2px_10px_rgb(20_51_42/0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${base}`}
    >
      {children}
    </Link>
  );
}

/**
 * The chevron on a card that opens something.
 *
 * Sits in a `PanelHead`'s action slot. Moves on hover, which is the cheapest
 * possible confirmation that the whole card — not just this mark — is the
 * target.
 */
export function OpenMark({ label }: { label?: string }): ReactNode {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand">
      {label ?? 'Open'}
      <span
        aria-hidden
        className="transition-transform duration-150 group-hover/card:translate-x-0.5"
      >
        →
      </span>
    </span>
  );
}

/** A panel's own heading row: what it is, how much of it, and what you can do. */
export function PanelHead({
  title,
  meta,
  action,
  tone = 'default',
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  tone?: 'default' | 'onBrand';
}): ReactNode {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 ${
        tone === 'onBrand' ? 'border-brand-contrast/20' : 'border-surface-border'
      }`}
    >
      <div className="flex items-baseline gap-3">
        <h2
          className={`font-display text-[16px] font-semibold ${
            tone === 'onBrand' ? 'text-brand-contrast' : 'text-text-primary'
          }`}
        >
          {title}
        </h2>
        {meta === undefined ? null : (
          <span
            className={`text-[12.5px] ${
              tone === 'onBrand' ? 'text-brand-contrast/75' : 'text-text-muted'
            }`}
          >
            {meta}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

/** The padded interior of a panel. Separate so a list can sit flush to the edges. */
export function PanelBody({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactNode {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/**
 * A figure that matters, sized by how much it matters.
 *
 * Deliberately NOT a tile with a border. Three of these sit in a row inside one
 * panel and share its frame, so they read as three facts about one thing rather
 * than as three separate cards competing to be read first.
 */
export function Stat({
  label,
  value,
  detail,
  size = 'md',
}: {
  label: string;
  value: string;
  detail?: string;
  size?: 'md' | 'lg';
}): ReactNode {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums leading-none tracking-[-0.02em] text-text-primary ${
          size === 'lg' ? 'text-[30px]' : 'text-[21px]'
        }`}
      >
        {value}
      </p>
      {detail === undefined ? null : <p className="mt-1.5 text-[12px] text-text-muted">{detail}</p>}
    </div>
  );
}

/**
 * An inert control that says "you own this".
 *
 * The demo does not simulate editing, and pretending otherwise would be the one
 * dishonest thing in it. But a Services page with no Edit button reads as a
 * report about a tutor rather than as her own workspace, so the affordance is
 * shown and the truth is one click away.
 */
export function EditAffordance({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[5px] border border-surface-border bg-surface-card px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-brand/40 hover:text-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <span aria-hidden className="text-brand">
          ✎
        </span>
        {label}
      </summary>
      <div className="mt-3 rounded-[4px] border border-dashed border-brand/35 bg-brand-tint/40 p-4 text-[13.5px] text-text-secondary">
        <p className="mb-1.5 font-semibold text-brand-strong">Not simulated in this demo</p>
        {children ?? (
          <p>
            In the product this opens an editor and saves against your account. The demo has no
            backend to write to, so the control is shown but does nothing.
          </p>
        )}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ *
 * Parts shared by more than one screen
 * ------------------------------------------------------------------ */

/**
 * A small card that is entirely a way into somewhere else.
 *
 * Lives here rather than beside one page because four screens now use it, and
 * two versions of the same shortcut drifting apart is precisely the kind of
 * inconsistency this pass exists to remove.
 */
export function QuickCard({
  href,
  title,
  detail,
  label,
}: {
  href: string;
  title: string;
  detail: string;
  label?: string;
}): ReactNode {
  return (
    <Panel href={href} tone="quiet">
      <PanelBody className="flex items-center gap-3 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-medium text-text-primary">
            {title}
          </span>
          <span className="mt-0.5 block text-[12.5px] text-text-muted">{detail}</span>
        </span>
        <OpenMark label={label ?? ''} />
      </PanelBody>
    </Panel>
  );
}

/**
 * WHETHER THIS LESSON HAS BEEN PAID FOR, in one glance.
 *
 * A parent scanning a list of lessons has exactly one question about money, and
 * it is not how much — it is whether anything is owed. So the settled state is
 * the brand (committed, done, nothing to do) and the unsettled state is clay,
 * which everywhere else in this demo means a clock is running. Used unchanged
 * on the dashboard, on the lessons page and in every detail panel, so the two
 * states cannot come to look different on different screens.
 */
export function PayChip({ payment }: { payment: 'paid' | 'due' }): ReactNode {
  return payment === 'paid' ? (
    <Chip tone="committed">Paid</Chip>
  ) : (
    <Chip tone="attention">Payment required</Chip>
  );
}

/**
 * Lesson price, Studdy's fee, and what the tutor actually earns.
 *
 * TUTOR-FACING ONLY. Every figure derives from `split`, which is the single
 * place the commission is arithmetic — so this breakdown, the week's headline
 * and the payouts mock-up cannot disagree about a lesson. Nothing on a parent
 * screen renders it: Priya is not charged a fee and must never be shown one.
 */
export function EarningsSplit({
  grossMinor,
  label = 'You earn',
}: {
  grossMinor: bigint;
  label?: string;
}): ReactNode {
  const parts = split(grossMinor);
  return (
    <Facts>
      <Fact label="Lesson price" value={money(parts.grossMinor)} />
      <Fact label="Studdy fee" value={`− ${money(parts.feeMinor)}`} />
      <Fact label={label} value={money(parts.netMinor)} strong />
    </Facts>
  );
}

/**
 * A WEEK AT A GLANCE — seven marks, one per day.
 *
 * The discovery cards used to carry a real calendar each, which answered a
 * question nobody asks while comparing tutors. Choosing between four people is
 * a question of SHAPE — does this person teach on the days we are free — and
 * the exact hour only matters once one of them has been picked. So the card
 * gets a strip and the profile keeps the calendar.
 */
export function WeekStrip({
  days,
  ariaLabel,
}: {
  /** One entry per day, Monday first: true where there is bookable time. */
  days: readonly { readonly label: string; readonly open: boolean }[];
  ariaLabel: string;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-1" role="img" aria-label={ariaLabel}>
      {days.map((day, index) => (
        <span
          key={`${day.label}-${String(index)}`}
          aria-hidden
          className={`flex h-[26px] w-[30px] items-center justify-center rounded-[4px] border text-[10.5px] font-medium ${
            day.open
              ? 'border-brand/25 bg-brand-tint text-brand-strong'
              : 'border-surface-border bg-surface-card-secondary text-text-muted'
          }`}
        >
          {day.label}
        </span>
      ))}
    </div>
  );
}

/**
 * A labelled block of prose inside a panel.
 *
 * The five parts of a lesson record, the goal on a student card, the note on a
 * request — all the same shape, and the rule on the left is how a reader tells
 * "went well" from "needs work" without reading either.
 */
export function NotePanel({
  label,
  tone = 'plain',
  children,
}: {
  label: string;
  tone?: 'plain' | 'good' | 'watch';
  children: ReactNode;
}): ReactNode {
  const rule =
    tone === 'good'
      ? 'border-l-2 border-brand pl-3.5'
      : tone === 'watch'
        ? 'border-l-2 border-status-warning pl-3.5'
        : 'border-l-2 border-surface-border pl-3.5';
  return (
    <div className={rule}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <div className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">{children}</div>
    </div>
  );
}

/** A bulleted list of tasks, in the demo's hand. */
export function TaskList({ tasks }: { tasks: readonly string[] }): ReactNode {
  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={task} className="flex gap-2.5 text-[13.5px] leading-relaxed text-text-secondary">
          <span aria-hidden className="mt-[3px] text-brand">
            &middot;
          </span>
          <span className="min-w-0">{task}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The heading above a column of cards that has no card of its own.
 *
 * A group of sibling cards still needs a name, and wrapping them in a further
 * panel to get one is how a page turns into nested boxes.
 */
export function CardsHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-display text-[16px] font-semibold text-text-primary">{title}</h2>
      <div className="flex items-center gap-3 text-[12.5px] text-text-muted">
        {meta}
        {action}
      </div>
    </div>
  );
}
