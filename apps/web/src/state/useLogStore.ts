import { LogParseError, parseLog, type ParsedLog } from '@log-analyzer/core';
import { create } from 'zustand';
import { loadBundledLog, loadLog } from '../api/logs';
import { ApiError } from '../api/client';
import { isStaticMode } from '../config';
import { bundledFixtures, loadBundledFixtureText, type BundledFixture } from '../data/fixtures';

export type AsyncStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type SourceKind = 'bundled' | 'file' | 'url' | null;

export interface LoadErrorInfo {
  code: string;
  message: string;
  detail?: unknown;
}

interface LogState {
  fixtures: BundledFixture[];
  activeFixtureId: string | null;
  sourceKind: SourceKind;
  sessionId: string | null;
  parsedLog: ParsedLog | null;
  sourceUrl: string | null;
  loadStatus: AsyncStatus;
  loadError: LoadErrorInfo | null;
  initializeDefault: () => Promise<void>;
  loadFixture: (id: string) => Promise<boolean>;
  loadLogFromUrl: (url: string) => Promise<boolean>;
  loadLogFromFile: (file: File) => Promise<boolean>;
}

const MAX_LOCAL_BYTES = 20 * 1024 * 1024;

function asLoadError(error: unknown): LoadErrorInfo {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, detail: error.detail };
  }
  if (error instanceof LogParseError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'An unexpected error occurred while loading the log.',
  };
}

export const useLogStore = create<LogState>((set, get) => {
  const commitLocalLog = (text: string, sourceUrl: string, sourceKind: SourceKind, fixtureId: string | null) => {
    const parsedLog = parseLog(text, sourceUrl);
    set({
      sessionId: null,
      parsedLog,
      sourceUrl,
      sourceKind,
      activeFixtureId: fixtureId,
      loadStatus: 'loaded',
      loadError: null,
    });
  };

  const loadRemoteThroughApi = async (url: string, fixtureId: string | null) => {
    const res = fixtureId
      ? await loadBundledLog(fixtureId, get().sessionId)
      : await loadLog(url, get().sessionId);
    set({
      sessionId: res.sessionId,
      parsedLog: res.log,
      sourceUrl: url,
      sourceKind: fixtureId ? 'bundled' : 'url',
      activeFixtureId: fixtureId,
      loadStatus: 'loaded',
      loadError: null,
    });
  };

  return {
    fixtures: bundledFixtures,
    activeFixtureId: null,
    sourceKind: null,
    sessionId: null,
    parsedLog: null,
    sourceUrl: null,
    loadStatus: 'idle',
    loadError: null,

    initializeDefault: async () => {
      if (get().loadStatus !== 'idle') return;
      await get().loadFixture('signal2');
    },

    loadFixture: async (id) => {
      const fixture = bundledFixtures.find((candidate) => candidate.id === id);
      if (!fixture) {
        set({ loadStatus: 'error', loadError: { code: 'UNKNOWN_FIXTURE', message: `Unknown fixture "${id}"` } });
        return false;
      }
      set({ loadStatus: 'loading', loadError: null });
      try {
        if (isStaticMode) {
          commitLocalLog(loadBundledFixtureText(id), fixture.sourceUrl, 'bundled', id);
        } else {
          await loadRemoteThroughApi(fixture.sourceUrl, id);
        }
        return true;
      } catch (error) {
        set({ loadStatus: 'error', loadError: asLoadError(error) });
        return false;
      }
    },

    loadLogFromUrl: async (url) => {
      set({ loadStatus: 'loading', loadError: null });
      try {
        if (url.length > 2_048) throw new Error('URL exceeds 2,048 characters.');
        if (isStaticMode) {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength > MAX_LOCAL_BYTES) throw new Error('Log exceeds the 20 MB limit.');
          commitLocalLog(new TextDecoder().decode(bytes), url, 'url', null);
        } else {
          await loadRemoteThroughApi(url, null);
        }
        return true;
      } catch (error) {
        set({ loadStatus: 'error', loadError: asLoadError(error) });
        return false;
      }
    },

    loadLogFromFile: async (file) => {
      set({ loadStatus: 'loading', loadError: null });
      try {
        if (file.size > MAX_LOCAL_BYTES) throw new Error('Log exceeds the 20 MB limit.');
        commitLocalLog(await file.text(), `local://${encodeURIComponent(file.name)}`, 'file', null);
        return true;
      } catch (error) {
        set({ loadStatus: 'error', loadError: asLoadError(error) });
        return false;
      }
    },
  };
});
