import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBundledFixtureText } from '../data/fixtures';
import { useLogStore } from './useLogStore';

beforeEach(() => {
  useLogStore.setState({
    activeFixtureId: null,
    sourceKind: null,
    sessionId: null,
    parsedLog: null,
    sourceUrl: null,
    loadStatus: 'idle',
    loadError: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useLogStore local mode', () => {
  it('initializes Signal 2 exactly once', async () => {
    await Promise.all([
      useLogStore.getState().initializeDefault(),
      useLogStore.getState().initializeDefault(),
    ]);
    const state = useLogStore.getState();
    expect(state.activeFixtureId).toBe('signal2');
    expect(state.parsedLog?.outcomeCounts.ERROR).toBe(40);
    expect(state.parsedLog?.outcomeCounts.TIMEOUT).toBe(30);
  });

  it('parses an opened file without creating a server session', async () => {
    const fixtureText = loadBundledFixtureText('signal1');
    const file = new File([fixtureText], 'local.log', { type: 'text/plain' });
    expect(await useLogStore.getState().loadLogFromFile(file)).toBe(true);
    const state = useLogStore.getState();
    expect(state.sourceKind).toBe('file');
    expect(state.sessionId).toBeNull();
    expect(state.parsedLog?.pairs).toHaveLength(500);
  });

  it('loads an optional remote URL in the browser without creating a server session', async () => {
    const fixtureText = loadBundledFixtureText('signal1');
    const fetchMock = vi.fn().mockResolvedValue(new Response(fixtureText, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await useLogStore.getState().loadLogFromUrl('https://example.com/sample.log')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/sample.log');
    expect(useLogStore.getState()).toMatchObject({
      sourceKind: 'url',
      sessionId: null,
      activeFixtureId: null,
    });
  });
});
