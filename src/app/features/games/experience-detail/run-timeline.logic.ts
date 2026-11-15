import { Experience } from '../../../core/models/experience.model';
import { RunSpan, runSpan } from '../../../shared/utils/run-dates';

/** `credits` while beaten or still being played, `abandoned` for a dropped run, `postgame` for its end. */
export type TimelinePointKey = 'start' | 'credits' | 'abandoned' | 'postgame';

export interface TimelinePoint {
  key: TimelinePointKey;
  /** `yyyy-mm-dd`; null when unknown or not reached yet. */
  date: string | null;
  /** Not reached yet (in progress, postgame going on): the time to it runs until today. */
  ongoing: boolean;
}

export interface RunTimeline {
  points: TimelinePoint[];
  /** Time between each point and the next (`points.length - 1` entries); null when a date is missing. */
  gaps: (RunSpan | null)[];
  /** Start to the end of the postgame, only when the run has a postgame. */
  total: RunSpan | null;
}

/** A run's dates as one timeline: start → credits (or abandonment) → end of the postgame, when it has one. */
export function runTimeline(
  run: Pick<Experience, 'status' | 'startDate' | 'endDate'> & Partial<Pick<Experience, 'postgame' | 'postgameEndDate'>>,
  today: string,
): RunTimeline {
  const points: TimelinePoint[] = [
    { key: 'start', date: run.startDate, ongoing: false },
    {
      key: run.status === 'ABANDONADO' ? 'abandoned' : 'credits',
      date: run.endDate,
      ongoing: run.status === 'EN_CURSO' && !run.endDate,
    },
  ];
  const hasPostgame = run.status === 'COMPLETADO' && (!!run.postgame || !!run.postgameEndDate);
  if (hasPostgame) {
    points.push({ key: 'postgame', date: run.postgameEndDate ?? null, ongoing: !run.postgameEndDate });
  }
  const at = (point: TimelinePoint) => point.date ?? (point.ongoing ? today : null);
  return {
    points,
    gaps: points.slice(1).map((point, i) => runSpan(at(points[i]), at(point))),
    total: hasPostgame ? runSpan(at(points[0]), at(points[points.length - 1])) : null,
  };
}
