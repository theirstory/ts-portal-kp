import type { Metadata } from 'next';
import { Suspense } from 'react';
import journeysData from '@/data/journeys-canon/model.json';
import systemData from '@/data/system-map/model.json';
import narratorsData from '@/data/narrators.json';
import type { Model as JourneysModel } from '@/lib/journeys-canon/model';
import type { MapModel } from '@/lib/system-map/view';
import { MemoryMap } from './Components/MemoryMap';
import type { MemoryNarrator } from './Components/shared';

export const metadata: Metadata = {
  title: 'Memory Map',
  description:
    'Journeys, shared events and the cause-and-effect claims narrators make about Permanente, each traced to a recorded moment.',
};

const narrators: MemoryNarrator[] = narratorsData.narrators.map((n) => ({
  slug: n.slug,
  name: n.name,
  regions: n.regions,
  cohort: n.cohort,
}));

const journeys = journeysData as unknown as JourneysModel;

/** Edges and contradictions are recomputed in the browser; `raw` names are for review only. */
const system: MapModel = {
  columns: systemData.columns as MapModel['columns'],
  narrators: systemData.narrators as MapModel['narrators'],
  factors: systemData.factors as MapModel['factors'],
  claims: (systemData.claims as unknown as MapModel['claims']).map((claim) => {
    const { raw, ...rest } = claim as MapModel['claims'][number] & { raw?: unknown };
    void raw;
    return rest as MapModel['claims'][number];
  }),
};

export default function MemoryMapPage() {
  return (
    <Suspense>
      <MemoryMap narrators={narrators} journeys={journeys} system={system} />
    </Suspense>
  );
}
