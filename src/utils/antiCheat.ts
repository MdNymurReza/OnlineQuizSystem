import { useEffect, useCallback } from 'react';

export interface AntiCheatOptions {
  onViolation: (type: string, details?: string) => void;
  onFullscreenExit?: () => void;
}

export function useAntiCheat({ onViolation, onFullscreenExit }: AntiCheatOptions) {
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      onViolation('tab_switch', 'User switched tabs or minimized the browser.');
    }
  }, [onViolation]);

  const handleFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      onViolation('fullscreen_exit', 'User exited fullscreen mode.');
      onFullscreenExit?.();
    }
  }, [onViolation, onFullscreenExit]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    onViolation('right_click', 'User attempted to right-click.');
  }, [onViolation]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Disable Copy (Ctrl+C), Paste (Ctrl+V), DevTools (F12, Ctrl+Shift+I)
    if (
      (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u')) ||
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && e.key === 'I')
    ) {
      e.preventDefault();
      onViolation('keyboard_shortcut', `User attempted to use restricted shortcut: ${e.key}`);
    }
  }, [onViolation]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleVisibilityChange, handleFullscreenChange, handleContextMenu, handleKeyDown]);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error('Error entering fullscreen:', err);
    }
  };

  return { enterFullscreen };
}
