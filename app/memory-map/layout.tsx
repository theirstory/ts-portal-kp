import React from 'react';
import { Box } from '@mui/material';
import { exploreFontVariables } from '../explore/fonts';
import { ExploreSidePanel } from '../explore/Components/ExploreSidePanel';
import { t } from '../explore/tokens';

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      className={exploreFontVariables}
      sx={{
        flex: 1,
        minHeight: 0,
        // Scrolls in its own container, like Explore, so sticky controls sit below the top bar.
        overflowY: 'auto',
        background: t.paper,
        color: t.ink,
        fontFamily: 'var(--explore-sans), system-ui, sans-serif',
        '& ::selection': { background: t.selection },
      }}>
      {children}
      {/* The shared transcript panel; a claim's play button opens its clip here. */}
      <ExploreSidePanel />
    </Box>
  );
}
