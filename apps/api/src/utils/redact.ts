/**
 * Defensive last line of defense for the "never print or log OPENAI_API_KEY" requirement.
 * Applied to anything derived from a caught `Error`'s message before it reaches
 * `console.error` or an outgoing `error` SSE/JSON payload -- OpenAI SDK errors do not embed
 * the full key in their messages, but this catches it unconditionally regardless of source.
 */
const OPENAI_KEY_PATTERN = /sk-[A-Za-z0-9_-]{10,}/g;

export function redactSecrets(input: string): string {
  return input.replace(OPENAI_KEY_PATTERN, 'sk-***REDACTED***');
}
