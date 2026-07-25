// Outcome -> visual encoding, chosen via the `dataviz` skill rather than picked by eye.
//
// This is a STATUS encoding (state: good -> warning -> serious -> critical), not an
// identity/categorical one, so it draws from the skill's fixed, mode-invariant status
// scale (never themed, never re-ordered) plus the skill's neutral "muted" ink token for
// the one non-severity case (UNKNOWN = "couldn't classify", not a real outcome):
//
//   RESPONSE -> good     #0ca30c
//   PENDING  -> warning  #fab219  (in-flight / needs attention)
//   TIMEOUT  -> serious  #ec835a  (a failure variant, distinct from ERROR)
//   ERROR    -> critical #d03b3b  (must pop hardest)
//   UNKNOWN  -> muted    #898781  (recedes -- a parse-quality fallback, not a severity)
//
// Validated with the skill's scripts/validate_palette.js against the fixed dark scene
// surface (#1a1a19, reused below as SCENE_BACKGROUND -- the skill's own documented dark
// chart surface, so the pre-computed numbers below stay valid without re-deriving them):
//   contrast vs #1a1a19 -- good 5.19:1, warning 9.49:1, serious 6.60:1, critical 3.62:1,
//   muted 4.85:1 -- all clear the >=3:1 mark-contrast gate (muted also clears 4.5:1 text
//   contrast, so it's safe to use as legend/label ink too, not just a swatch).
//
// IMPORTANT diagnostic from the same run, treating the 5 hexes as an identity/categorical
// set (the skill's CVD-separation check, run as a sanity diagnostic even though a status
// scale isn't held to that gate): critical vs good (ERROR vs RESPONSE -- the single most
// important pair here) separate by only ~4.1 dE under deuteranopia simulation, and serious
// vs warning (TIMEOUT vs PENDING) by ~13.6 dE even for normal vision -- both well under the
// skill's floors. That means color ALONE cannot reliably distinguish outcomes for a
// meaningful share of users, colorblind or not. Consequently, every surface reusing these
// colors (Legend, HoverTooltip, SelectedPairPanel, ToolActivityChip) always ships the
// outcome as visible text next to the swatch -- never color alone -- and PENDING additionally
// gets an animated pulse as a non-color secondary cue for "in flight."
import type { Outcome } from '@log-analyzer/core';

export interface OutcomeStyle {
  label: string;
  description: string;
  /** Flat hex for 2D swatches: legend chips, tooltip dots, chat tool chips. */
  hex: string;
  /**
   * Multiplier applied to `hex` when computing each bar instance's (HDR-ish, unlit)
   * render color -- this is what makes ERROR "pop" and RESPONSE/UNKNOWN recede once
   * bloom is applied, without needing per-instance material uniforms (see
   * components/visualization/LifespanBars.tsx). ERROR highest, UNKNOWN lowest.
   */
  intensity: number;
  /** True only for PENDING -- an additional non-color animated cue (see LifespanBars). */
  pulse: boolean;
}

export const OUTCOME_STYLES: Record<Outcome, OutcomeStyle> = {
  RESPONSE: {
    label: 'Response',
    description: 'Completed normally',
    hex: '#0ca30c',
    intensity: 0.55,
    pulse: false,
  },
  PENDING: {
    label: 'Pending',
    description: 'Request seen, no terminal event yet',
    hex: '#fab219',
    intensity: 1.05,
    pulse: true,
  },
  TIMEOUT: {
    label: 'Timeout',
    description: 'No terminal event before the timeout window',
    hex: '#ec835a',
    intensity: 1.2,
    pulse: false,
  },
  ERROR: {
    label: 'Error',
    description: 'Completed with an error status',
    hex: '#d03b3b',
    intensity: 1.7,
    pulse: false,
  },
  UNKNOWN: {
    label: 'Unknown',
    description: 'Could not be classified while parsing',
    hex: '#898781',
    intensity: 0.35,
    pulse: false,
  },
};

/** Fixed legend/display order -- independent of any per-log sort or filter. */
export const OUTCOME_ORDER: Outcome[] = ['RESPONSE', 'ERROR', 'TIMEOUT', 'PENDING', 'UNKNOWN'];

// Scene-fixed dark void -- deliberately NOT theme-dependent. Bloom + emissive-style
// bars read poorly on a light background, so the WebGL canvas stays a fixed dark
// "theatre" regardless of the surrounding app's light/dark theme; only the 2D chrome
// (panels, chat, legend) follows prefers-color-scheme, via theme.css.
export const SCENE_BACKGROUND = '#1a1a19';
