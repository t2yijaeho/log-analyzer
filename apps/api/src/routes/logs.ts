import fixtureManifest from '@log-analyzer/core/fixtures/manifest.json' with { type: 'json' };
import { LogParseError, parseLog } from '@log-analyzer/core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { z } from 'zod';
import { buildAgentBundleForLog } from '../agent/agentFactory.js';
import { ApiError } from '../errors/ApiError.js';
import { requireAccessToken } from '../middleware/auth.js';
import { fetchLog } from '../log-parser/fetchLog.js';
import { getOrCreateSession } from '../session/sessionStore.js';

export const logsRouter = Router();

const presets = fixtureManifest.fixtures.map(({ id, buttonLabel, description, sourceUrl }) => ({
  id,
  label: `${buttonLabel} — ${description}`,
  url: sourceUrl,
}));

logsRouter.get('/presets', (_req, res) => {
  res.json({ presets });
});

const fixtureIds = fixtureManifest.fixtures.map((fixture) => fixture.id) as [string, ...string[]];
const LoadLogBody = z.union([
  z.object({ url: z.string().min(1, 'url is required').max(2_048, 'url is too long') }).strict(),
  z.object({ fixtureId: z.enum(fixtureIds) }).strict(),
]);

function fixturePath(file: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', '..', 'packages', 'log-core', 'fixtures', file);
}

logsRouter.post('/', requireAccessToken, async (req, res, next) => {
  try {
    const parsedBody = LoadLogBody.safeParse(req.body);
    if (!parsedBody.success) throw ApiError.validation('invalid request body', parsedBody.error.flatten());

    const session = getOrCreateSession(req.header('X-Session-Id'));
    let text: string;
    let finalUrl: string;
    if ('fixtureId' in parsedBody.data) {
      const fixtureId = parsedBody.data.fixtureId;
      const fixture = fixtureManifest.fixtures.find((candidate) => candidate.id === fixtureId);
      if (!fixture) throw ApiError.validation('unknown fixture');
      text = await readFile(fixturePath(fixture.file), 'utf8');
      finalUrl = fixture.sourceUrl;
    } else {
      const fetched = await fetchLog(parsedBody.data.url);
      text = fetched.text;
      finalUrl = fetched.finalUrl;
    }

    let parsedLog;
    try {
      parsedLog = parseLog(text, finalUrl);
    } catch (error) {
      if (error instanceof LogParseError) throw ApiError.unrecognizedFormat(error.message);
      throw error;
    }

    session.parsedLog = parsedLog;
    session.agentBundle = buildAgentBundleForLog(parsedLog);
    session.chatInProgress = false;
    res.json({ sessionId: session.sessionId, log: parsedLog });
  } catch (error) {
    next(error);
  }
});
