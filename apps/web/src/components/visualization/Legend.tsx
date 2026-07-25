import { OUTCOME_ORDER, OUTCOME_STYLES } from '../../theme/outcomeColors';
import styles from './Legend.module.css';

/**
 * Always-visible outcome legend -- not decorative. Per the dataviz-skill CVD
 * diagnostic recorded in theme/outcomeColors.ts, some of these colors do not
 * reliably separate by hue alone (most importantly ERROR vs RESPONSE), so the
 * text label here (and in HoverTooltip/SelectedPairPanel/ToolActivityChip) is the
 * load-bearing part of the encoding, not the swatch.
 */
export function Legend() {
  return (
    <div className={styles.legend} aria-label="Outcome legend">
      {OUTCOME_ORDER.map((outcome) => {
        const style = OUTCOME_STYLES[outcome];
        return (
          <div key={outcome} className={styles.item} title={style.description}>
            <span className={styles.swatch} style={{ background: style.hex }} aria-hidden="true" />
            <span className={styles.label}>{style.label}</span>
            {style.pulse ? <span className={styles.hint}>pulses</span> : null}
          </div>
        );
      })}
    </div>
  );
}
