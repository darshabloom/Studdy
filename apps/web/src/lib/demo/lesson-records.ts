/**
 * WHAT A LESSON LEAVES BEHIND.
 *
 * The single place these are written, read by the tutor's lesson detail and by
 * the family's lessons page. They were duplicated inline in two files, which is
 * exactly how a tutor's note and a parent's copy of it start disagreeing.
 *
 * Structured rather than prose, because the value of keeping a lesson record is
 * only obvious when you can see it answering the questions a parent actually
 * has: what did they do, did he get it, where is he stuck, and what happens
 * next. A paragraph hides all four; five labelled lines show them at a glance.
 *
 * Written by the tutor in the product. Studdy does not record or transcribe
 * lessons, and every screen that shows one of these says so.
 */
export interface LessonRecord {
  readonly covered: string;
  readonly understood: string;
  readonly struggled: string;
  readonly changed: string;
  readonly next: string;
  readonly homework: readonly string[];
}

export const LESSON_RECORDS: Readonly<Record<string, LessonRecord>> = {
  'Quadratic equations': {
    covered:
      'Factorising quadratics where the leading coefficient is not 1, then solving by setting each factor to zero. Twelve worked examples, the last four unaided.',
    understood:
      'The mechanics are solid. He can find the factor pair quickly now and no longer writes the expansion out in full to check it.',
    struggled:
      'Signs on the middle term when both factors are negative. He was getting −5x where it should have been +5x, consistently enough that it was a rule he had half-remembered rather than a slip.',
    changed:
      'We stopped and rebuilt the sign rule from two expansions he did himself rather than me telling him. After that he caught his own error twice without prompting, which is the first time that has happened.',
    next: 'Quadratics that need rearranging before they can be factorised, and the first worded problems.',
    homework: [
      'Exercise 7C, questions 1–8 — factorise only, do not solve',
      'For any you get wrong, write the full expansion underneath and find the sign error yourself',
    ],
  },
  'Simultaneous equations': {
    covered:
      'Substitution and elimination on the same three problems, side by side, so the choice of method became visible rather than assumed.',
    understood:
      'Both methods, executed accurately. His arithmetic through the elimination step is reliable.',
    struggled:
      'Choosing. He reaches for substitution every time, including on a pair where elimination was two lines and substitution was seven. He got the right answer and spent three times as long on it.',
    changed:
      'Timed him on one problem each way. Seeing the difference did more than the explanation had — he has started asking "which one is less work" before starting.',
    next: 'Simultaneous equations from worded contexts, where setting up the pair is the hard part.',
    homework: [
      'Exercise 6B, questions 4–10',
      'For each, write down which method you chose and why before you solve it',
    ],
  },
  'Factorising practice': {
    covered:
      'Consolidation. Difference of two squares, common factors and simple trinomials shuffled together, so identifying the type was part of each question.',
    understood:
      'Recognition is much better than a month ago. He spotted every difference of two squares immediately, including the one disguised with a coefficient.',
    struggled:
      'Speed under time pressure. Accuracy held up, but he took nearly twice the exam allowance and knew it, which made the last few worse.',
    changed:
      'Dropped the pace deliberately for the middle section and his accuracy went back up. Worth him knowing that rushing is currently costing him more marks than not finishing would.',
    next: 'Building speed back up gradually with short timed sets rather than full papers.',
    homework: ['Mixed set on the sheet — 12 questions, 20 minutes, timed, once only'],
  },
  'Linear graphs': {
    covered:
      'Gradient and intercept from an equation, from two points, and read off a drawn line. Then the reverse: writing the equation from a graph.',
    understood:
      'Reading gradient off a drawn line, confidently, including negative gradients which caught him out last term.',
    struggled:
      'Rearranging into y = mx + c when the equation arrives in a different form. He can do the algebra but does not always recognise that rearranging is the first step.',
    changed:
      'Gave him five equations and asked only "is this ready to read?" without solving any. That separated the recognition from the algebra and the recognition improved immediately.',
    next: 'Parallel and perpendicular lines, which need the gradient reading to be automatic first.',
    homework: [
      'Exercise 9A, questions 1–6',
      'For each, write "ready" or "rearrange first" before doing anything else',
    ],
  },
  'Ratio word problems': {
    covered:
      'Translating worded situations into ratios. Deliberately no solving at all this lesson — only turning the sentence into the notation.',
    understood:
      'The arithmetic was never the issue and still is not. Once a ratio is written down she handles it without help.',
    struggled:
      'The translation step. Faced with a sentence she would freeze, then guess at which number goes first, which is a confidence problem as much as a technique one.',
    changed:
      'Real shift around the fourth problem. She started underlining the two quantities before writing anything, and the guessing stopped. She noticed it herself and said so.',
    next: 'Same translation work but with three-part ratios, then back to solving.',
    homework: ['Five worded problems on the sheet — write the ratio only, do not solve'],
  },
  'Equivalent fractions': {
    covered:
      'Simplifying and finding common denominators, using a number line rather than rules to start with.',
    understood: 'Simplifying by a common factor, and checking her answer by multiplying back.',
    struggled:
      'Common denominators when neither number divides the other. She was defaulting to multiplying the two denominators together, which works but produces numbers she then struggles to simplify.',
    changed:
      'Showed her the lowest common multiple on the number line. She could see why the smaller number was available, and the arithmetic afterwards got noticeably easier for her.',
    next: 'Adding and subtracting fractions with unlike denominators.',
    homework: ['Workbook page 42, questions 1–10'],
  },
  Percentages: {
    covered: 'Percentage of an amount, and percentage increase and decrease in context.',
    understood: 'Finding a percentage of an amount, both with and without a calculator.',
    struggled:
      'Increase versus decrease — she was adding when the question wanted a subtraction, mostly on questions phrased around discounts.',
    changed:
      'We rewrote four discount questions as "what is left" rather than "what comes off". Framed that way she got all four.',
    next: 'Reverse percentages, which will need the increase/decrease distinction to be secure.',
    homework: ['Six discount questions — write "what is left" under each before solving'],
  },
  'Differentiation from first principles': {
    covered:
      'The limit definition applied to three polynomials, then the general rule derived from what he had done rather than given.',
    understood:
      'The algebra of the limit process, and why the h in the denominator cancels. He can reproduce the derivation unprompted.',
    struggled:
      'Explaining what the derivative means at a point when the question asks in words. His notation is ahead of his ability to say what it represents, which costs marks in the written parts.',
    changed:
      'Asked him to describe each result as a rate of change in a sentence before writing anything. Clumsy at first, much clearer by the third.',
    next: 'Past paper questions that ask for interpretation rather than calculation.',
    homework: [
      '2024 external, questions 3 and 4 — full working',
      'Write one sentence explaining what each derivative tells you',
    ],
  },
  'Surds and indices': {
    covered: 'Simplifying surds, rationalising a denominator, and the index laws applied together.',
    understood: 'The index laws, applied confidently even when combined.',
    struggled: 'Rationalising when the denominator is a binomial — he forgets the conjugate.',
    changed: 'Wrote the conjugate step as its own line every time rather than doing it mentally.',
    next: 'Mixed surd and index questions at exam standard.',
    homework: ['Exercise 4D, questions 1–9'],
  },
  'Solving inequalities': {
    covered: 'Linear inequalities, including the sign flip when multiplying or dividing by a negative.',
    understood: 'The mechanics, and representing the solution on a number line.',
    struggled: 'Remembering to flip. He knows the rule and does not always notice it applies.',
    changed: 'Circling the negative coefficient before starting made it visible enough to catch.',
    next: 'Inequalities with the unknown on both sides.',
    homework: ['Exercise 5B, questions 1–8 — circle any negative coefficient first'],
  },
};

export function lessonRecord(topic: string | null): LessonRecord | null {
  if (topic === null) return null;
  return LESSON_RECORDS[topic] ?? null;
}
