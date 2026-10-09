import {
  EMPTY_TUTOR_SERVICE,
  SERVICE_OPTIONS_MAX,
  priceInputFromMinor,
  type TutorProfileInput,
  type TutorServiceInput,
} from '@studdy/domain/tutors';

/**
 * Read a service, and a profile edit, out of a submitted form. PURE, so it is
 * testable without a browser, and the single place the forms' field names are
 * interpreted.
 *
 * Neither ever fails: an absent or odd field becomes an empty one, and the
 * domain's validator decides what is acceptable.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function serviceInputFromFormData(formData: FormData): TutorServiceInput {
  return {
    subjectId: text(formData, 'subjectId'),
    displayName: text(formData, 'displayName'),
    description: text(formData, 'description'),
    yearLevelFrom: text(formData, 'yearLevelFrom'),
    yearLevelTo: text(formData, 'yearLevelTo'),
    formatCode: text(formData, 'formatCode'),
    options: Array.from({ length: SERVICE_OPTIONS_MAX }, (_, index) => ({
      durationMinutes: text(formData, `options.${String(index)}.durationMinutes`),
      price: text(formData, `options.${String(index)}.price`),
    })),
  };
}

/** A stored service back into what the form shows. */
export function serviceInputFromRecord(record: {
  readonly subjectId: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly yearLevelFrom: number | null;
  readonly yearLevelTo: number | null;
  readonly formatCode: string;
  readonly options: readonly {
    readonly durationMinutes: number;
    readonly priceAmountMinor: bigint;
  }[];
}): TutorServiceInput {
  return {
    subjectId: record.subjectId,
    displayName: record.displayName,
    description: record.description ?? '',
    yearLevelFrom: record.yearLevelFrom === null ? '' : String(record.yearLevelFrom),
    yearLevelTo: record.yearLevelTo === null ? '' : String(record.yearLevelTo),
    formatCode: record.formatCode,
    options:
      record.options.length === 0
        ? EMPTY_TUTOR_SERVICE.options
        : record.options.map((option) => ({
            durationMinutes: String(option.durationMinutes),
            price: priceInputFromMinor(option.priceAmountMinor),
          })),
  };
}

export function profileInputFromFormData(formData: FormData): TutorProfileInput {
  return {
    headline: text(formData, 'headline'),
    teachingApproach: text(formData, 'teachingApproach'),
    yearLevelFrom: text(formData, 'yearLevelFrom'),
    yearLevelTo: text(formData, 'yearLevelTo'),
    offersOnline: formData.get('offersOnline') === 'on',
    offersInPerson: formData.get('offersInPerson') === 'on',
    availabilityLabelCode: text(formData, 'availabilityLabelCode'),
  };
}
