import { TutorShell } from '@/components/demo/demo-shells';
import { SkeletonPreview } from '@/components/demo/demo-skeleton';
import {
  Chip,
  Panel,
  PanelBody,
  PanelHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
} from '@/components/demo/kit';

export const metadata = { title: 'Resources' };

const RESOURCES = [
  {
    name: 'Factorising quadratics — mixed set',
    type: 'Worksheet',
    level: 'NCEA Level 1',
    used: 24,
  },
  { name: 'Simultaneous equations, worded', type: 'Worksheet', level: 'NCEA Level 1', used: 18 },
  { name: '2024 external — annotated', type: 'Past paper', level: 'NCEA Level 2', used: 11 },
  { name: 'Ratio starters', type: 'Warm-up', level: 'Years 8–10', used: 31 },
  { name: 'Differentiation from first principles', type: 'Notes', level: 'Year 13', used: 7 },
];

const ASSIGNED = [
  { student: 'Jacob', resource: 'Factorising quadratics — mixed set', when: 'Set Tuesday' },
  { student: 'Sophie', resource: 'Ratio starters', when: 'Set last Thursday' },
];

/**
 * Not built — and shown rather than described.
 *
 * A tutor reading "Resources: coming soon" learns nothing. A tutor seeing a
 * search box, their own material listed with how often they have used it, and
 * two worksheets already sitting against two students understands the feature
 * in a second, and can tell it does not work yet because it is visibly a
 * mock-up.
 */
export default function TutorResourcesPage() {
  return (
    <TutorShell active="/demo/tutor/resources">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
              Resources
            </h1>
            <Chip tone="ghost">Coming soon</Chip>
          </div>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-text-secondary">
            The worksheets, past papers and warm-ups you reuse between students &mdash; kept in one
            place, searchable, and assignable to a student as homework. Below is what it will look
            like.
          </p>
        </div>
      </header>

      <SkeletonPreview>
        <Panel>
          <PanelHead title="Your library" meta="5 items" />
          <PanelBody>
            <div className="flex flex-wrap items-center gap-2">
              <span className="basis-full rounded-[5px] border border-surface-border bg-surface-card-secondary sm:flex-1 sm:basis-0 px-3 py-2 text-[13.5px] text-text-muted">
                Search your resources…
              </span>
              <Chip tone="current">All subjects</Chip>
              <Chip tone="neutral">Years 8–10</Chip>
              <Chip tone="neutral">NCEA 1</Chip>
              <Chip tone="neutral">NCEA 2</Chip>
            </div>

            <div className="mt-4">
              <RowList>
                {RESOURCES.map((resource) => (
                  <Row key={resource.name}>
                    <span
                      aria-hidden
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[4px] border border-surface-border bg-surface-card-secondary text-[11px] font-semibold text-text-muted"
                    >
                      {resource.type.slice(0, 2).toUpperCase()}
                    </span>
                    <RowMain name={resource.name} detail={`${resource.type} · ${resource.level}`} />
                    <Chip tone="neutral">Assign</Chip>
                    <RowMeta>
                      used {resource.used}×
                      <span className="mt-0.5 block text-text-muted">this year</span>
                    </RowMeta>
                  </Row>
                ))}
              </RowList>
            </div>
          </PanelBody>
        </Panel>

        <div className="mt-5">
          <Panel tone="quiet">
            <PanelHead title="Assigned to students" meta="2 active" />
            <PanelBody className="py-1">
              <RowList>
                {ASSIGNED.map((entry) => (
                  <Row key={entry.student}>
                    <RowMain name={entry.student} detail={entry.resource} />
                    <Chip tone="neutral">Not yet opened</Chip>
                    <RowMeta>{entry.when}</RowMeta>
                  </Row>
                ))}
              </RowList>
            </PanelBody>
          </Panel>
        </div>
      </SkeletonPreview>
    </TutorShell>
  );
}
