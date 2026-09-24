import { describe, expect, it } from 'vitest';
import { usageReport } from '../../lib/usage.ts';

const LIMIT = 107374182400;

describe('usageReport', () => {
  it('prints update users and bandwidth against the Free caps', () => {
    const usage = {
      updates: {
        uniqueUpdaters: { plan: { used: 44, limit: 1000 } },
        bandwidth: { plan: { usedBytes: 272507447, limitBytes: LIMIT } },
      },
    };
    expect(usageReport(usage)).toEqual({
      line: 'EAS usage: 44 / 1,000 update users · 0.3 / 100.0 GiB',
      warnings: [],
    });
  });

  it('warns from 80% of either cap', () => {
    const usage = {
      updates: {
        uniqueUpdaters: { plan: { used: 800, limit: 1000 } },
        bandwidth: { plan: { usedBytes: 0, limitBytes: LIMIT } },
      },
    };
    expect(usageReport(usage).warnings).toHaveLength(1);
  });

  it('says so when EAS reports another shape', () => {
    expect(usageReport({})).toEqual({ line: 'EAS usage: unavailable', warnings: [] });
  });
});
