import { priceLabel, yearLevelRangeLabel } from '@studdy/domain/discovery';
import type { ServiceFormatCode } from '@studdy/domain/tutors';
import { SERVICE_FORMAT_LABEL } from '@/lib/tutors/service-status';

export interface ServiceSummaryProps {
  readonly subjectDisplayName: string;
  readonly description: string | null;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly formatCode: ServiceFormatCode;
  readonly options: readonly {
    readonly durationMinutes: number;
    readonly priceAmountMinor: bigint;
    readonly currencyCode: string;
  }[];
}

/**
 * What a service says, laid out the same way wherever it is read: by its tutor,
 * by the reviewer deciding it, and by a family on the tutor's profile. One
 * rendering, so what was reviewed is recognisably what goes on sale.
 */
export function ServiceSummary({
  subjectDisplayName,
  description,
  yearLevelFrom,
  yearLevelTo,
  formatCode,
  options,
}: ServiceSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      {description !== null && description !== '' ? (
        <p className="whitespace-pre-wrap text-text-secondary">{description}</p>
      ) : null}
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-text-muted">Subject</dt>
          <dd className="font-medium text-text-primary">{subjectDisplayName}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Year levels</dt>
          <dd>{yearLevelRangeLabel(yearLevelFrom, yearLevelTo)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Format</dt>
          <dd>{SERVICE_FORMAT_LABEL[formatCode]}</dd>
        </div>
      </dl>
      {options.length === 0 ? (
        <p className="text-sm text-text-secondary">No lesson lengths or prices yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {options.map((option) => (
            <li
              key={option.durationMinutes}
              className="rounded-[var(--radius-gentle)] border border-surface-border px-3 py-2 text-sm"
            >
              <span className="font-semibold tabular-nums">
                {priceLabel(option.priceAmountMinor, option.currencyCode)}
              </span>{' '}
              <span className="text-text-secondary">for {option.durationMinutes} minutes</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
