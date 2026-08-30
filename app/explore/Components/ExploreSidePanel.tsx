'use client';

import React, { useEffect, useMemo } from 'react';
import { Drawer } from '@mui/material';
import { ChatInteractionProvider } from '@/app/discover/ChatInteractionContext';
import { SidePanel } from '@/app/discover/Components/SidePanel';
import { useChatStore } from '@/app/stores/useChatStore';

const DRAWER_WIDTH = 520;

/**
 * Hosts the portal's shared side panel for Explore. Discover renders the same
 * panel as a split pane; Explore keeps its full-width layout and slides it in
 * from the right instead.
 *
 * Explore opens the panel straight onto a transcript, so there is no "source"
 * view behind it — the back control closes the panel rather than returning to
 * a mode that was never shown.
 */
export const ExploreSidePanel = () => {
  const sidePanelMode = useChatStore((s) => s.sidePanelMode);
  const closeSidePanel = useChatStore((s) => s.closeSidePanel);

  const interaction = useMemo(() => ({ onGoBack: closeSidePanel }), [closeSidePanel]);

  // The panel's state is shared with Discover, so discard whatever it was left
  // on when entering Explore, and again on the way out. Only the panel state is
  // cleared — the Discover conversation itself is untouched.
  useEffect(() => {
    closeSidePanel();
    return () => closeSidePanel();
  }, [closeSidePanel]);

  return (
    <Drawer
      anchor="right"
      // Explore only ever opens a transcript; it has no chat message behind it
      // to populate Discover's other panel modes.
      open={sidePanelMode === 'transcript'}
      onClose={closeSidePanel}
      slotProps={{
        paper: {
          sx: { width: { xs: '100%', sm: DRAWER_WIDTH }, maxWidth: '100%' },
        },
      }}>
      <ChatInteractionProvider value={interaction}>
        <SidePanel />
      </ChatInteractionProvider>
    </Drawer>
  );
};
