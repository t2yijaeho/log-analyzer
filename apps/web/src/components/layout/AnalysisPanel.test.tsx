import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalysisPanel } from './AnalysisPanel';

afterEach(cleanup);

describe('AnalysisPanel', () => {
  it('shows local analysis in static mode', async () => {
    render(<AnalysisPanel staticMode />);
    expect(await screen.findByText('Local insights')).toBeVisible();
    expect(screen.getByText(/GitHub Pages runs entirely in your browser/)).toBeVisible();
  });

  it('shows chat only in protected full-stack mode', async () => {
    render(<AnalysisPanel staticMode={false} />);
    expect(await screen.findByText('Chat', {}, { timeout: 10_000 })).toBeVisible();
    expect(screen.queryByText('Local insights')).not.toBeInTheDocument();
  }, 15_000);
});
