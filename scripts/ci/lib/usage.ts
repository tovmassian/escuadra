// Free-plan headroom from `eas account:usage --json`. The Free plan has no update
// overage: past 1,000 update users a month, updates stop being delivered — to
// production users too, so the publish job warns early.
export interface AccountUsage {
  updates?: {
    uniqueUpdaters?: { plan?: { used: number; limit: number } };
    bandwidth?: { plan?: { usedBytes: number; limitBytes: number } };
  };
}

const WARN_AT = 0.8;

const gib = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1);

export function usageReport(usage: AccountUsage): { line: string; warnings: string[] } {
  const users = usage.updates?.uniqueUpdaters?.plan;
  const bandwidth = usage.updates?.bandwidth?.plan;
  if (!users || !bandwidth) return { line: 'EAS usage: unavailable', warnings: [] };
  const warnings: string[] = [];
  if (users.used >= users.limit * WARN_AT) {
    warnings.push(
      `Update users at ${users.used} of ${users.limit}: the Free plan stops delivering updates at the cap.`,
    );
  }
  if (bandwidth.usedBytes >= bandwidth.limitBytes * WARN_AT) {
    warnings.push(`Bandwidth at ${gib(bandwidth.usedBytes)} of ${gib(bandwidth.limitBytes)} GiB.`);
  }
  const count = (n: number): string => n.toLocaleString('en-US');
  return {
    line: `EAS usage: ${count(users.used)} / ${count(users.limit)} update users · ${gib(bandwidth.usedBytes)} / ${gib(bandwidth.limitBytes)} GiB`,
    warnings,
  };
}
