import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLogStore } from '../../state/useLogStore';
import { useVizStore } from '../../state/useVizStore';
import { LogSourceBar } from './LogSourceBar';

afterEach(cleanup);

describe('LogSourceBar', () => {
  it('loads each dedicated sample button locally and resets visualization state', async () => {
    render(<LogSourceBar />);
    const signal1 = screen.getByRole('button', { name: 'Signal 1' });
    const signal2 = screen.getByRole('button', { name: 'Signal 2' });
    expect(signal1).toBeVisible();
    expect(signal2).toBeVisible();
    expect(screen.getByRole('button', { name: 'Signal 3' })).toBeVisible();

    await waitFor(() => expect(signal2).toHaveAttribute('aria-pressed', 'true'));
    useVizStore.setState({
      hoveredPairId: 'api-0001',
      selectedPairId: 'api-0001',
      cameraPreset: 'top-down',
      isPlaying: true,
      playbackSpeed: 4,
      scrubTime: 12,
      viewMode: '3d',
    });

    fireEvent.click(signal1);
    await waitFor(() => expect(signal1).toHaveAttribute('aria-pressed', 'true'));
    expect(useLogStore.getState().sourceKind).toBe('bundled');
    expect(useLogStore.getState().parsedLog?.pairs).toHaveLength(500);
    expect(useVizStore.getState()).toMatchObject({
      hoveredPairId: null,
      selectedPairId: null,
      cameraPreset: 'overview',
      isPlaying: false,
      playbackSpeed: 1,
      scrubTime: 0,
      viewMode: '2d',
    });
  });
});
