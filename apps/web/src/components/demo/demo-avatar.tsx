import type { ReactNode } from 'react';

/**
 * A tutor's initials in a lavender disc.
 *
 * Studdy has no photo pipeline yet, and a demo is not the place to invent one —
 * stock portraits of people who do not exist would undercut the "sample data"
 * label the whole demo rests on. Initials in the brand colour give a card the
 * anchor a photo would, cost nothing, and cannot be mistaken for a real person.
 */
export function DemoAvatar({
  initials,
  size = 'md',
}: {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  /*
   * EXPLICIT PIXELS, NOT THE NUMERIC SCALE.
   *
   * The design system redefines Tailwind's numeric spacing tokens
   * (`--spacing-5` upwards no longer match stock Tailwind: `--spacing-9` is
   * 96px, not 36px), so `h-9 w-9` renders a 96-pixel disc rather than a
   * 36-pixel one — silently, and only where the two scales happen to diverge.
   * A fixed avatar size is a pixel measurement rather than a spacing step, so
   * it says so.
   */
  const sizeClass =
    size === 'lg'
      ? 'h-[64px] w-[64px] text-xl'
      : size === 'sm'
        ? 'h-[36px] w-[36px] text-xs'
        : 'h-[48px] w-[48px] text-base';

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-brand-purple/20 bg-brand-lavender font-semibold tracking-wide text-brand-purple-deep ${sizeClass}`}
    >
      {initials}
    </span>
  );
}
