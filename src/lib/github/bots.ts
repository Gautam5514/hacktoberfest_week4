const KNOWN = /(dependabot|renovate|greenkeeper|snyk-bot|github-actions|pre-commit-ci|imgbot|allcontributors|semantic-release)/i;

/** Automation commits must not count as "someone is still working on this". */
export function isBot(login?: string | null, type?: string | null, name?: string | null): boolean {
  if (type === 'Bot') return true;
  if (login && (login.endsWith('[bot]') || KNOWN.test(login))) return true;
  return !!name && (name.endsWith('[bot]') || KNOWN.test(name));
}
