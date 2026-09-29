import React from 'react';
import { Box } from '@mui/material';
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from 'next/font/google';
import { loadEvidenceBank } from '@/lib/insights/loadEvidenceBank';
import { EvidenceProvider } from './Components/EvidenceProvider';
import { ExploreHeader } from './Components/ExploreHeader';
import { ExploreSidePanel } from './Components/ExploreSidePanel';
import { t } from './tokens';

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--explore-serif',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--explore-sans',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--explore-mono',
});

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  // Every Explore route renders per request (dynamic params / search params), so this picks up
  // excerpts portal-sync added since the last sync.
  const bank = loadEvidenceBank();

  return (
    <Box
      className={`${serif.variable} ${sans.variable} ${monoFont.variable}`}
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
