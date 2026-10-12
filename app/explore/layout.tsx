import React from 'react';
import { Box } from '@mui/material';
import { loadEvidenceBank } from '@/lib/insights/loadEvidenceBank';
import { exploreFontVariables } from './fonts';
import { EvidenceProvider } from './Components/EvidenceProvider';
import { ExploreHeader } from './Components/ExploreHeader';
import { ExploreSidePanel } from './Components/ExploreSidePanel';
import { t } from './tokens';

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  // Every Explore route renders per request (dynamic params / search params), so this picks up
  // excerpts portal-sync added since the last sync.
  const bank = loadEvidenceBank();

  return (
    <Box
      className={exploreFontVariables}
      sx={{
        flex: 1,
        minHeight: 0,
        // Explore scrolls in its own container so its sticky header sits below
        // the portal top bar rather than fighting it for `top: 0`.
        overflowY: 'auto',
        background: t.paper,
        color: t.ink,
        fontFamily: 'var(--explore-sans), system-ui, sans-serif',
        '& ::selection': { background: t.selection },
      }}>
      <EvidenceProvider bank={bank}>
        <ExploreHeader />
        {children}
        <ExploreSidePanel />
      </EvidenceProvider>
    </Box>
  );
}
