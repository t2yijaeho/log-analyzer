import { parseLog } from '@log-analyzer/core';
import { describe, expect, it } from 'vitest';
import { bundledFixtures, loadBundledFixtureText } from './fixtures';

describe('bundled fixtures', () => {
  it('ships all three requested dashboard samples', () => {
    expect(bundledFixtures.map((fixture) => fixture.id)).toEqual(['signal1', 'signal2', 'signal3']);
  });

  it.each([
    ['signal1', 500, 0, 0],
    ['signal2', 430, 40, 30],
    ['signal3', 500, 0, 0],
  ])('loads and parses %s locally', async (id, responses, errors, timeouts) => {
    const fixture = bundledFixtures.find((candidate) => candidate.id === id);
    expect(fixture).toBeDefined();
    const parsed = parseLog(await loadBundledFixtureText(id), fixture!.sourceUrl);
    expect(parsed.pairs).toHaveLength(500);
    expect(parsed.outcomeCounts.RESPONSE).toBe(responses);
    expect(parsed.outcomeCounts.ERROR).toBe(errors);
    expect(parsed.outcomeCounts.TIMEOUT).toBe(timeouts);
  });
});
