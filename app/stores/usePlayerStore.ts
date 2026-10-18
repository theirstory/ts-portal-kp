import MuxPlayerElement from '@mux/mux-player';
import { create } from 'zustand';

interface PlayerState {
  play: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setPlay: (play: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  seekTo: (time: number) => void;
  /** A seek requested before the player could take it (not mounted, or no metadata yet). */
  pendingSeek: number | null;
  /** Applies pendingSeek; StoryVideo calls it once the player has metadata. */
  applyPendingSeek: () => void;
  setPlayerRef: (ref: MuxPlayerElement | null) => void;
  playerRef: MuxPlayerElement | null;
}

// HAVE_METADATA: the player knows the duration and can seek.
const hasMetadata = (player: MuxPlayerElement): boolean => (player.readyState ?? 0) >= 1;

const usePlayerStore = create<PlayerState>((set) => ({
  play: false,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playerRef: null,
  pendingSeek: null,
  setPlay: (play) =>
    set((state) => {
      if (state.playerRef) {
        if (play) {
          const playResult = state.playerRef.play?.();
          if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
            (playResult as Promise<void>).catch(() => {});
          }
        } else {
          state.playerRef.pause?.();
        }
      }

      return {
        play,
        ...(play ? {} : { isPlaying: false }),
      };
    }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlayerRef: (ref) => set({ playerRef: ref }),
  // A seek can arrive before the player has mounted or loaded its metadata (e.g. ?start= on page
  // load), when setting currentTime is lost or leaves the player stuck; it is held until then.
  seekTo: (time) => {
    set((state) => {
      const player = state.playerRef;
      if (player && hasMetadata(player)) {
        player.currentTime = time;
        return { currentTime: time, pendingSeek: null };
      }
      return { currentTime: time, pendingSeek: time };
    });
  },
  applyPendingSeek: () => {
    set((state) => {
      const player = state.playerRef;
      if (state.pendingSeek === null || !player || !hasMetadata(player)) return {};
      player.currentTime = state.pendingSeek;
      return { currentTime: state.pendingSeek, pendingSeek: null };
    });
  },
}));

export default usePlayerStore;
