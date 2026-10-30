import { getDb } from './db';
import type { AnalysisStep } from './types';

/**
 * Deterministic revival plan: every step is derived from fetched GitHub facts, never from a
 * model, so it works offline and is always reproducible. `evidenceIds` here are plain refs
 * (e.g. "PR #12"); the AI plan uses E-numbers instead.
 */
export function rulesPlan(repoId: string): AnalysisStep[] {
  const db = getDb();
  const r = db.repos[repoId];
  if (!r) return [];
  const d = db.deep[repoId];
  const steps: AnalysisStep[] = [];
  const add = (s: Omit<AnalysisStep, 'kind'> & { kind?: AnalysisStep['kind'] }) =>
    steps.push({ kind: s.evidenceIds.length ? 'found' : 'suggested', ...s });

  if (d?.pulls.length) {
    const p = d.pulls[0];
    add({ title: `Review ${d.pulls.length} open pull request${d.pulls.length > 1 ? 's' : ''}, starting with #${p.number}`, why: `"${p.title}" was last updated ${p.updatedAt.slice(0, 10)}. Unmerged work is the cheapest place to restart.`, effort: 'M', evidenceIds: d.pulls.slice(0, 3).map(x => `PR #${x.number}`) });
  }
  if (d?.issues.length) {
    add({ title: `Triage ${d.issues.length} open issue${d.issues.length > 1 ? 's' : ''}`, why: `Open issues show what users still want. Newest: #${d.issues[0].number} "${d.issues[0].title}".`, effort: 'M', evidenceIds: d.issues.slice(0, 3).map(x => `Issue #${x.number}`) });
  }
  if (r.botOnly) {
    add({ title: 'Check pending automated dependency updates', why: 'Every recent commit is from automation, so dependency PRs may be piling up with no human reviewing them.', effort: 'S', evidenceIds: r.recentCommits.slice(0, 2).map(c => `commit ${c.sha.slice(0, 7)}`) });
  }
  add({ title: 'Check that it still installs, builds and passes its tests', why: `No human commit for ${r.idleDays} days; toolchains and dependencies have likely moved on. Run this in a disposable environment first.`, effort: 'M', evidenceIds: [] });
  if (!r.license) add({ title: 'Choose and add a license', why: 'GitHub reports no license, so others cannot legally reuse or contribute to it.', effort: 'S', evidenceIds: [`repo metadata`] });
  if (d && !d.readme) add({ title: 'Write a README that says what the project is and how to run it', why: 'No README was found, which makes returning to it (or handing it off) much harder.', effort: 'S', evidenceIds: ['repo metadata'] });
  if (d && !d.releases.length) add({ title: 'Cut a first tagged release once it works again', why: 'No releases exist, so consumers have no stable version to depend on.', effort: 'S', evidenceIds: ['releases list'] });
  else if (d?.releases[0]?.publishedAt) add({ title: `Plan a release after the revival (last: ${d.releases[0].tag})`, why: `The last release was ${d.releases[0].publishedAt.slice(0, 10)}.`, effort: 'S', evidenceIds: [`release ${d.releases[0].tag}`] });
  return steps;
}
