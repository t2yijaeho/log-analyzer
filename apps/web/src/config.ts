export type AppMode = 'static' | 'full';

const configuredMode = import.meta.env.VITE_APP_MODE;

export const appMode: AppMode = configuredMode === 'static' ? 'static' : 'full';
export const isStaticMode = appMode === 'static';
export const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';
export const accessTokenStorageKey = 'log-analyzer-access-token';
