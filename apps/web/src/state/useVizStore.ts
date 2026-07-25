import { create } from 'zustand';

export type CameraPreset = 'overview' | 'top-down' | 'follow-playhead';
export type VizMode = '3d' | '2d';

interface VizState {
  hoveredPairId: string | null;
  selectedPairId: string | null;
  cameraPreset: CameraPreset;

  isPlaying: boolean;
  playbackSpeed: number;
  /** Current playhead position, in elapsed seconds within the loaded session. */
  scrubTime: number;

  /** 3D lifespan-bar scene vs the 2D latency dashboard. */
  viewMode: VizMode;

  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  play: () => void;
  pause: () => void;
  togglePlaying: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setScrubTime: (t: number) => void;
  setViewMode: (mode: VizMode) => void;
  resetForNewLog: () => void;
}

/**
 * Ephemeral 3D-interaction + playback state. Deliberately isolated from
 * useLogStore/useChatStore: the 3D scene never subscribes to chat state, and
 * high-frequency updates here (scrubTime while playing) never touch chat's
 * per-message selectors.
 *
 * Per-frame consumers (LifespanBars hover/select pulses, CameraRig follow-playhead,
 * the Playhead mesh itself) read this store imperatively via `useVizStore.getState()`
 * inside their own `useFrame`, never via the reactive hook -- only discrete
 * (pointer in/out, click, play/pause toggle) changes go through `set`. The
 * reactive hook is still perfectly fine for 2D DOM consumers (PlaybackControls'
 * scrubber, SelectedPairPanel, HoverTooltip), where a per-frame re-render of a
 * small DOM element is cheap.
 */
export const useVizStore = create<VizState>((set, get) => ({
  hoveredPairId: null,
  selectedPairId: null,
  cameraPreset: 'overview',

  isPlaying: false,
  playbackSpeed: 1,
  scrubTime: 0,
  viewMode: '2d',

  setHovered: (id) => set({ hoveredPairId: id }),
  setSelected: (id) => set({ selectedPairId: id }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlaying: () => set({ isPlaying: !get().isPlaying }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setScrubTime: (t) => set({ scrubTime: Math.max(0, t) }),
  setViewMode: (mode) => set({ viewMode: mode }),

  resetForNewLog: () =>
    set({
      hoveredPairId: null,
      selectedPairId: null,
      cameraPreset: 'overview',
      isPlaying: false,
      playbackSpeed: 1,
      scrubTime: 0,
      viewMode: '2d',
    }),
}));
