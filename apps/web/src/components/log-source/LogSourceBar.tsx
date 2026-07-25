import { useEffect, useState } from 'react';
import { accessTokenStorageKey, isStaticMode } from '../../config';
import { useChatStore } from '../../state/useChatStore';
import { useLogStore } from '../../state/useLogStore';
import { useVizStore } from '../../state/useVizStore';
import { isLikelyHttpUrl } from '../../utils/format';
import { summarizeParsedLog } from '../../utils/summarize';
import { ErrorBanner } from '../common/ErrorBanner';
import { Spinner } from '../common/Spinner';
import styles from './LogSourceBar.module.css';

function describeLoadError(code: string, message: string, detail: unknown): { message: string; detail?: string } {
  const upstreamStatus =
    detail && typeof detail === 'object' && 'upstreamStatus' in detail
      ? String((detail as { upstreamStatus?: unknown }).upstreamStatus)
      : undefined;

  switch (code) {
    case 'INVALID_URL':
      return { message: message || 'That URL is not allowed by the configured API host policy.' };
    case 'FETCH_FAILED':
      return {
        message: 'Could not fetch that log from its source.',
        detail: upstreamStatus ? `Upstream responded with status ${upstreamStatus}.` : undefined,
      };
    case 'RESPONSE_TOO_LARGE':
      return { message: 'That log is larger than the 20 MB limit.' };
    case 'UNRECOGNIZED_FORMAT':
      return { message: 'That file does not contain recognizable request/response log lines.' };
    case 'UNAUTHORIZED':
      return { message: 'Enter the deployment access token before using backend features.' };
    default:
      return { message: message || 'Something went wrong while loading that log.' };
  }
}

function resetViewsAfterLoad() {
  const { parsedLog } = useLogStore.getState();
  useChatStore.getState().reset();
  useVizStore.getState().resetForNewLog();
  if (parsedLog) useChatStore.getState().addSystemSummary(summarizeParsedLog(parsedLog));
}

export function LogSourceBar() {
  const fixtures = useLogStore((s) => s.fixtures);
  const activeFixtureId = useLogStore((s) => s.activeFixtureId);
  const loadStatus = useLogStore((s) => s.loadStatus);
  const loadError = useLogStore((s) => s.loadError);
  const initializeDefault = useLogStore((s) => s.initializeDefault);
  const loadFixture = useLogStore((s) => s.loadFixture);
  const loadLogFromUrl = useLogStore((s) => s.loadLogFromUrl);
  const loadLogFromFile = useLogStore((s) => s.loadLogFromFile);

  const [urlInput, setUrlInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem(accessTokenStorageKey) ?? '');

  useEffect(() => {
    if (useLogStore.getState().loadStatus !== 'idle') return;
    void initializeDefault().then(resetViewsAfterLoad);
  }, [initializeDefault]);

  const submitUrl = async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed || !isLikelyHttpUrl(trimmed)) {
      setValidationError('Enter a valid HTTP(S) log URL.');
      return;
    }
    setValidationError(null);
    if (await loadLogFromUrl(trimmed)) resetViewsAfterLoad();
  };

  const mappedError = loadError ? describeLoadError(loadError.code, loadError.message, loadError.detail) : null;
  const isLoading = loadStatus === 'loading';

  return (
    <div className={styles.bar}>
      <div className={styles.presetRow} aria-label="Bundled log samples">
        <span className={styles.fieldLabel}>Samples</span>
        <div className={styles.fixtureButtons}>
          {fixtures.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              className={activeFixtureId === fixture.id ? styles.fixtureActive : styles.fixtureButton}
              aria-pressed={activeFixtureId === fixture.id}
              title={fixture.description}
              disabled={isLoading}
              onClick={() => void loadFixture(fixture.id).then((ok) => ok && resetViewsAfterLoad())}
            >
              {fixture.buttonLabel}
            </button>
          ))}
        </div>
        <span className={styles.sampleDescription}>
          {fixtures.find((fixture) => fixture.id === activeFixtureId)?.description ?? 'Choose a bundled run'}
        </span>
        {isLoading ? <Spinner label="Loading…" /> : null}
      </div>

      <form
        className={styles.row}
        onSubmit={(event) => {
          event.preventDefault();
          void submitUrl(urlInput);
        }}
      >
        <label className={styles.field} style={{ flex: 1 }}>
          <span className={styles.fieldLabel}>Remote log URL</span>
          <input
            className={styles.input}
            type="url"
            placeholder="https://…/api.log"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
          />
        </label>

        <button className={styles.loadButton} type="submit" disabled={isLoading}>
          Load URL
        </button>

        <label className={styles.fileButton}>
          Open file
          <input
            className={styles.visuallyHidden}
            type="file"
            accept=".log,.txt,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadLogFromFile(file).then((ok) => ok && resetViewsAfterLoad());
              event.target.value = '';
            }}
          />
        </label>

        {!isStaticMode ? (
          <label className={styles.tokenField}>
            <span className={styles.fieldLabel}>Access token</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="off"
              placeholder="Deployment token"
              value={accessToken}
              onChange={(event) => {
                const value = event.target.value;
                setAccessToken(value);
                if (value) sessionStorage.setItem(accessTokenStorageKey, value);
                else sessionStorage.removeItem(accessTokenStorageKey);
              }}
            />
          </label>
        ) : null}
      </form>

      {isStaticMode ? (
        <div className={styles.inlineNote}>
          Static mode: bundled samples and opened files are parsed locally and never leave this browser.
        </div>
      ) : null}

      {validationError ? <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} /> : null}
      {mappedError ? <ErrorBanner message={mappedError.message} detail={mappedError.detail} /> : null}
    </div>
  );
}
