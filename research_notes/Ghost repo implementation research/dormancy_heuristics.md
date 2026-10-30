# Detecting dormant/abandoned OSS repositories and scoring revival potential (GitHub API-implementable)

## Q1. What definitions and thresholds do established projects/papers use?

### Takeaway
Published operational definitions are all activity-window based; none is universal. OpenSSF Scorecard uses a 90-day window (about 12 commits+issue-updates for full score, archived = min). Academic work uses 1-2 years of silence (Coelho 2017: no commits in last year; Avelino 2019: developer gone after 1 year; Miller 2025: 2 years of zero activity after 2 years of >=10 events/yr). Explicit "unmaintained" notices are rare, so activity signals are needed.

### Cited Findings
- OpenSSF Scorecard "Maintained": risk High; archived projects get lowest score; at least one commit per week over previous 90 days gets the highest score; partial credit for issue activity by collaborators/members/owners; only evaluated for GitHub projects older than 90 days — [Scorecard checks.md](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
- Scorecard code: lookBackDays=90, activityPerWeek=1, threshold = 1*90/7 = 12 (integer division); score = commits_in_90d + issues_updated_in_90d (equal weight, summed), passed to a proportional score out of 12; overrides to minimum score if archived or created in last 90 days. Final 0-10 mapping/clamping not verified — [maintained.go](https://raw.githubusercontent.com/ossf/scorecard/main/checks/evaluation/maintained.go)
- Scorecard Dependency-Update-Tool only checks whether Dependabot/Renovate is configured (not that PRs get merged); CI-Tests looks at ~last 30 commits for successful check runs/statuses from named CI systems; Contributors needs >=3 companies each with >=5 of last 30 commits for top score — [Scorecard checks.md](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
- GitHub archived flag: archiving makes the repo read-only (issues, PRs, code, labels, milestones, releases, branches, comments); others can still fork/star; it is reversible — [GitHub Docs](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories)
- Coelho & Valente (FSE 2017, 104 deprecated popular repos survey; sample from top-5,000 by stars): "unmaintained" = no commits in last year (628 repos, 13%) OR README says deprecated/unmaintained/"no longer maintained"/"no longer supported"/"no longer under development" (207 matched, only 76 = 37% true positives after manual check; false positive example: README says API methods "deprecated") — [arXiv 1707.02327](https://arxiv.org/pdf/1707.02327)
- Coelho et al. (ESEM 2018): ML classifier (Random Forest) for unmaintained; deliberately no fixed commit-gap threshold (calls it arbitrary). Labels: 248 unmaintained (104 declared + 144 archived) vs 754 active (>=1 release in last month). 13 features (forks, open/closed issues, open/closed/merged PRs, commits, max days without commits, max contributions by one dev, new contributors, distinct contributors, owner's #projects and #commits) over 24 months in 3-month intervals. Accuracy 0.92, precision 0.86, recall 0.81, AUC 0.88. Most important feature: commits in the last interval (months 22-24 before last commit). Validation on 129 projects by maintainers: 80% precision, 96% recall (search summary). Proposes LMA = 2*(p-0.5)*100 — [ar5iv 1809.04041](https://ar5iv.arxiv.org/html/1809.04041); [search summary of validation](https://speakerdeck.com/aserg_ufmg/identifying-unmaintained-projects-in-github-esem-2018)
- Miller et al. (ICSE 2025, npm): abandoned = 2+ years of regular maintenance (>=10 events/year from contributors: commits, issue comments, issue close events) followed by 2 years with zero contributor activity; abandonment date = last commit. Even ~3 commits/yr residual activity produced many false positives of "feature-complete but sporadically maintained" packages; strict 2-year zero activity gave "almost perfect precision". 4,108 of 28,100 widely-used npm packages (14.6%) abandoned in the window; <5% announced EOL — [Miller et al. PDF](https://cmustrudel.github.io/papers/icse2025abandonment.pdf); counts per [search summary](https://cmustrudel.github.io/papers/icse2025abandonment.pdf)
- Avelino et al. (ESEM 2019, 1,932 popular GitHub projects): a developer is "gone" if last commit >=1 year before the most recent commit in the repo (1-year chosen over 5 thresholds, highest harmonic mean of precision/improvement, 66%); project abandoned when all "truck factor" developers are gone; truck factor via ≥50% degree-of-authorship algorithm. 315 (16%) abandoned; 128 (41%) later survived via new core developers — [arXiv 1906.08058](https://arxiv.org/pdf/1906.08058.pdf)
- Calefato et al. (EMSE 2022, 18 GitHub orgs): ~45% of core developers fully disengaged for >=1 year; after a pause, 35-55% chance of returning; after a >=1-year break return probability falls to ~21-26% (~54% complete disengagement) — [arXiv 2103.04656](https://arxiv.org/abs/2103.04656)
- CHAOSS definitions: Time to First Response (time between issue/change-request open and first human response); Issue Age (how long an issue stays open before closing); bus/truck factor = smallest number of contributors accounting for 50% of contributions in the window (per CHAOSS community discussion); Elephant Factor = distribution of work across companies. These are search-snippet-level summaries, not the formal spec pages — [CHAOSS risk WG](https://www.github.com/chaoss/wg-risk/blob/main/focus-areas/business-risk); [CHAOSS community issue 632](https://www.github.com/chaoss/community/issues/632); [2026 commentary (opinion)](https://nesbitt.io/2026/05/27/chaoss-metrics-in-2026.html) notes AI triage bots can drive TTFR to seconds.
- libraries.io SourceRank: overview doc says max around 30 points; penalties for prerelease-only versions and for removal from package manager; bonuses for readme, license; per-package breakdown includes semver, recent release, >=1.0.0, plus popularity (dependents, stars, contributors, subscribers). No complete official weight table found — [docs.libraries.io overview](https://docs.libraries.io/overview) (via search summary); [example breakdown](https://libraries.io/npm/bl/sourcerank)
- npm "deprecated" is unreliable as an abandonment label: in a manual review only 556 of 1,000 deprecated packages were true package deprecations (arXiv 2107.10168); Python has no standard deprecation protocol and two-thirds of dependents were unaware of deprecation (arXiv 2408.10327) — [arXiv 2107.10168](https://arxiv.org/pdf/2107.10168); [arXiv 2408.10327](https://alphaxiv.org/abs/2408.10327)

### Inferences
- A transparent classifier can use tiers: archived => "archived"; explicit README/description notice => "declared"; zero default-branch human activity for >=24 months => "abandoned"; 12-24 months => "dormant"; 3-12 months with low activity => "slowing". These cut points are my synthesis from Coelho (1 yr), Avelino (1 yr), Miller (2 yr), Scorecard (90 d); not a published standard.
- Mirror Scorecard's formula (commits_90d + maintainer-issue-activity_90d, /12) as a "current health" sub-score.

### Gaps
- Exact SourceRank point weights; exact CHAOSS thresholds (CHAOSS publishes no cutoffs); deps.dev has no documented "unmaintained" threshold that I found (deps.dev surfaces Scorecard results, not verified here).
- Miller prevalence numbers came from search summary; paper text verified only for the method.

## Q2. Signals beyond last-push date; finished vs abandoned

### Takeaway
Use default-branch, human-authored commits and maintainer responses rather than `pushed_at`. Separate "finished" from "abandoned" by checking whether issues/PRs go unanswered and whether bugs accumulate, not by commit silence alone; the literature itself admits no clean separator.

### Cited Findings
- `pushed_at` updates when a commit is pushed to any branch; `updated_at` also changes on metadata/wiki changes and (per a commenter) stars. Therefore neither means default-branch development. Forum/blog level sources (not official docs) — [GitHub community discussion 24442](https://github.com/orgs/community/discussions/24442); [yigitsever blog](https://yigitsever.com/blog/finding-stale-repos/)
- Bots inflate activity: Miller et al. explicitly handle bot commits (Dependabot, Renovate, Greenkeeper, Snyk etc.) as SCA tooling signals; Scorecard's Dependency-Update-Tool only checks config presence, so a bot-only repo scores well on automation yet may have no human maintainer — [Miller PDF](https://cmustrudel.github.io/papers/icse2025abandonment.pdf); [Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
- Feature-complete packages exist: Miller found low residual activity (3 commits/yr) mixes in "feature-complete but still sporadically-maintained" packages — [Miller PDF](https://cmustrudel.github.io/papers/icse2025abandonment.pdf). Maintainers cite "it's finished" as reason (e.g. "it achieved all its goals, and it's done", "works great and needs no updates"); Avelino conjectures non-surviving projects are either feature-complete or failed to attract maintainers, but notes feature-complete systems still need bug fixes — [Coelho 2017](https://arxiv.org/pdf/1707.02327); [Avelino 2019](https://arxiv.org/pdf/1906.08058.pdf)
- Reasons for failure among 104 deprecated popular projects (classified from survey): usurped by competitor 27, obsolete 20, lack of time 18, lack of interest 18; groups: project-characteristics (obsolete/outdated tech/low maintainability), team, environment (30 projects) — [Coelho 2017](https://arxiv.org/pdf/1707.02327)
- Failed projects differ from healthy ones in adopting contributing guidelines (large effect) and CI (medium), per that paper's comparison — [Coelho 2017](https://arxiv.org/pdf/1707.02327)
- Selected inactive repos had median 11 contributors, 137 commits, 2,345 stars vs 23/346/2,538 for top-5000 (stars effect negligible) — [Coelho 2017](https://arxiv.org/pdf/1707.02327)
- Strongest predictor in the ML model: commit volume in the most recent interval; also issue/PR open-closed counts, max days without commits, contributor counts — [Coelho 2018](https://ar5iv.arxiv.org/html/1809.04041)
- Bus factor: Avelino's truck-factor devs; surviving projects had, after TF-developer departure, a median 56% of commits post-departure vs 15% for non-surviving (Cliff's d=0.79) — [Avelino 2019](https://arxiv.org/pdf/1906.08058.pdf)
- CHAOSS Issue Age rises when maintainers leave issue queues open ([2026 commentary, opinion](https://nesbitt.io/2026/05/27/chaoss-metrics-in-2026.html)).

### Inferences
- "Finished-and-stable" heuristic (opinion/synthesis): no commits >=12-24 months AND (open issues low or last maintainer response recent) AND last release not behind dependency/runtime breakage AND no open PRs waiting > N months => "stable/complete". "Abandoned" if unanswered issues/PRs with no maintainer comment in >=12 months, README notice, outdated deps/CI red, or maintainer announced leave.
- Weak signals to treat as modifiers only: TODO/WIP branches, draft PRs, stale branches (no empirical thresholds found).

### Gaps
- No empirical study found validating TODO/WIP/draft-PR/stale-branch signals for abandonment; no published finished-vs-abandoned classifier; no published bot-filtering threshold beyond author-login/[bot] suffix practice.

## Q3. Signals predicting successful or valuable revival

### Takeaway
Direct empirical evidence is thin. The best data: 41% of abandoned popular GitHub projects were revived by new core devs, mostly within a year (64%), and mostly by existing contributors or users motivated by their own use. Value proxies (dependents, stars) are outside the revival-success evidence.

### Cited Findings
- Of 315 abandoned projects, 128 (41%) survived; 86% attracted a single new TF developer; timing of attraction: 64% in year 1 after departure, 23% year 2, 10% year 3, 2% year 4; 52% of survivors' new core devs were old contributors, 41% newcomers, 7% both — [Avelino 2019](https://arxiv.org/pdf/1906.08058.pdf)
- Survivors were younger at departure (median 1095 vs 1460 days, d=0.37) and had fewer developers (32 vs 47) and commits (384 vs 694), small effects; no major difference in size at departure otherwise — [Avelino 2019](https://arxiv.org/pdf/1906.08058.pdf)
- Survey: takers' main motivation is own usage of the software; barriers: lack of time and difficulty obtaining push access — [Avelino 2019](https://arxiv.org/pdf/1906.08058.pdf)
- Return of departed core developers: ~21-26% after a >=1-year break — [Calefato 2022](https://arxiv.org/abs/2103.04656)
- Forks: ~1 in 5 original projects saw declining participation after forking (Rastogi & Nagappan); fork types differ in sustainability benefits (Negoita et al., 749 projects). Indirect; search-summary level — [Negoita ICIS 2019](https://aisel.aisnet.org/icis2019/is_development/is_development/7)
- Downstream exposure: dependents rarely react quickly to abandonment (mean removal 13.5 months among those who removed; per slide deck); dependents with SCA tooling and low technical lag more likely to respond — [Miller PDF](https://cmustrudel.github.io/papers/icse2025abandonment.pdf); [slides](https://courtney-e-miller.github.io/slideDecks/UnderstandingTheResponseSlideDeck.pdf)
- Coelho 2017: 13% of top-5000 starred repos had no commits in last year, so popularity doesn't prevent abandonment — [Coelho 2017](https://arxiv.org/pdf/1707.02327)

### Inferences
- A transparent "resurrection potential" score (my design, unvalidated): value = log(dependents) + log(stars) + recency of last release; feasibility = permissive license, tests/CI present, small code size, modest dependency staleness, abandonment age < ~2 yrs (revival odds decay sharply per Avelino/Calefato), presence of past contributors who are still active elsewhere, open issues with community demand, not "usurped" (check if README points to successor or if a larger fork is active), not "obsolete". Penalize: archived with successor, language/platform obsolete, no license (can't legally fork-publish).
- Active forks are the best revival-candidate evidence: if a fork is already outcommitting upstream, "revival" already occurred.

### Gaps
- No study found that predicts revival success from README quality, test presence, dependents, or stars. Weights for any such score are unvalidated.

## Q4. Cheap API call budget

### Takeaway
One GraphQL query (cost ~1 point) can return most signals per repo; a few REST calls cover the rest. 5,000 points/hour for user tokens.

### Cited Findings
- GraphQL: 5,000 points/h per user token (1,000/h per repo for GITHUB_TOKEN in Actions); node limit 500,000; first/last max 100; cost = (requests needed across connections)/100 rounded, min 1; `rateLimit{cost remaining}` field available — [GitHub GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api)
- REST stats endpoints: `stats/commit_activity` (52 weeks of commits, per-day array), `stats/participation` (52 weekly counts all vs owner), `stats/contributors` (per-contributor weekly commits); cached by default-branch SHA; first call may return 202 and need retry; merge commits excluded; code_frequency returns 422 for repos with >=10,000 commits and contributors returns zero additions/deletions for them — [GitHub REST statistics](https://docs.github.com/en/rest/metrics/statistics)
- Repo object fields available in a single call: `archived`, `pushed_at`, `updated_at`, stars, forks, open_issues_count, license, default branch — [GitHub community on pushed_at](https://github.com/orgs/community/discussions/24442) (archived field per search summary)

### Inferences (suggested request plan, my design)
1. One GraphQL query per repo: isArchived, pushedAt, stargazerCount, forkCount, licenseInfo, defaultBranchRef.target.history(first:100, since:<24mo>) {author{user{login}} authoredDate, authorlogin} for human default-branch commits; releases(last:5), issues(states:OPEN) totalCount, closed totalCount, last updatedAt via `issues(first:10, orderBy:UPDATED_AT DESC)` with comments author association; pullRequests open count + oldest open; README via object(expression:"HEAD:README.md"){text} for notice regex; refs(refPrefix:"refs/heads/") count; dependencyGraphManifests optional.
2. Optional REST: `stats/participation` (1 call, 52 weeks) for a fast activity histogram; `GET /repos/{r}/forks?sort=newest` or GraphQL `forks(orderBy:PUSHED_AT)` to find active forks; check-runs on default HEAD for CI status.
3. Dependents count is not in the REST/GraphQL API (only web UI dependents graph / third-party deps.dev, libraries.io) — not verified in a cited source; treat as external lookup.

### Gaps
- Exact GraphQL fields for author association on issue comments and dependency graph availability not verified from docs here; deps.dev API endpoints not reviewed.
