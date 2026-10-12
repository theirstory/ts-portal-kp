'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import {
  contradictionEdgeIds,
  contradictionsFor,
  edgesFor,
  findings as computeFindings,
  layoutMap,
  visibleClaims,
} from '@/lib/system-map/view';
import type { MapModel, Selection } from '@/lib/system-map/view';
import { loop, mono, shell, t } from '@/app/explore/tokens';
import { Chip, Label, SectionIntro } from '../shared';
import { ClaimsPanel } from './ClaimsPanel';
import { LoopMap } from './LoopMap';

const MIN_OPTIONS = [1, 2, 3];
const DEFAULT_MIN = 2;

/** Width of a factor label in the map's font, measured once fonts load; estimated before that. */
function useTextMeasure(rootRef: React.RefObject<HTMLElement | null>) {
  const estimate = useCallback((text: string) => text.length * 7.4, []);
  const [measure, setMeasure] = useState<(text: string) => number>(() => estimate);
  useEffect(() => {
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    (fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled || !rootRef.current) return;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      // Measured bold: selected pills use weight 600 and must not clip.
      ctx.font = `600 13px ${getComputedStyle(rootRef.current).fontFamily}`;
      setMeasure(() => (text: string) => ctx.measureText(text).width);
    });
    return () => {
      cancelled = true;
    };
  }, [rootRef]);
  return measure;
}

/**
 * "The loops they describe": the cause-and-effect claims map. The narrator selection comes from the
 * Memory Map's shared filter.
 */
export const SystemSection = ({
  model,
  selectedNarrators,
  narratorColor,
}: {
  model: MapModel;
  selectedNarrators: string[];
  narratorColor: (slug: string) => string;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const measure = useTextMeasure(rootRef);

  const allSlugs = useMemo(() => model.narrators.map((n) => n.slug), [model]);
  const narratorBySlug = useMemo(() => new Map(model.narrators.map((n) => [n.slug, n])), [model]);
  const factorByName = useMemo(() => new Map(model.factors.map((f) => [f.name, f])), [model]);

  const [minNarrators, setMinNarrators] = useState(DEFAULT_MIN);
  const [includeAsked, setIncludeAsked] = useState(true);
  const [showContradictions, setShowContradictions] = useState(false);
  const [showAllFactors, setShowAllFactors] = useState(false);

  // A minimum of 2 means nothing when one narrator is selected.
  const effectiveMin = Math.max(1, Math.min(minNarrators, selectedNarrators.length));

  // Everything any narrator said (under the asked-directly toggle): fixes the layout and the gray arrows.
  const everyone = useMemo(
    () => visibleClaims(model.claims, { narrators: allSlugs, includeAskedDirectly: includeAsked }),
    [model, allSlugs, includeAsked],
  );
  const allEdges = useMemo(() => edgesFor(everyone, model.narrators), [everyone, model]);
  const layoutEdges = useMemo(
    () => allEdges.filter((e) => e.narrators.length >= minNarrators),
    [allEdges, minNarrators],
  );

  const claims = useMemo(
    () => visibleClaims(model.claims, { narrators: selectedNarrators, includeAskedDirectly: includeAsked }),
    [model, selectedNarrators, includeAsked],
  );
  const edges = useMemo(() => edgesFor(claims, model.narrators), [claims, model]);
  // Disagreements are flagged across every arrow the selection made, whatever the minimum: one side
  // is often a single narrator. With the toggle on, both sides are drawn.
  const contradictions = useMemo(() => contradictionsFor(edges, model.factors), [edges, model]);
  const contradictionIds = useMemo(
    () => (showContradictions ? contradictionEdgeIds(contradictions) : null),
    [showContradictions, contradictions],
  );
  const activeEdges = useMemo(
    () => edges.filter((e) => e.narrators.length >= effectiveMin || contradictionIds?.has(e.id)),
    [edges, effectiveMin, contradictionIds],
  );
  const activeIds = useMemo(() => new Set(activeEdges.map((e) => e.id)), [activeEdges]);
  const ghostEdges = useMemo(() => layoutEdges.filter((e) => !activeIds.has(e.id)), [layoutEdges, activeIds]);
  const activeFactors = useMemo(() => new Set(activeEdges.flatMap((e) => [e.from, e.to])), [activeEdges]);

  const shownFactors = useMemo(() => {
    if (showAllFactors) return model.factors;
    const names = new Set([...layoutEdges, ...activeEdges].flatMap((e) => [e.from, e.to]));
    return model.factors.filter((f) => names.has(f.name));
  }, [model, showAllFactors, layoutEdges, activeEdges]);

  const layout = useMemo(
    () => layoutMap(model.columns, shownFactors, layoutEdges, measure),
    [model.columns, shownFactors, layoutEdges, measure],
  );

  // Open on the most widely shared arrow across the whole collection, so the panel is never empty.
  const findingList = useMemo(() => {
    const all = visibleClaims(model.claims, { narrators: allSlugs, includeAskedDirectly: true });
    const e = edgesFor(all, model.narrators);
    return computeFindings(e, contradictionsFor(e, model.factors), all);
  }, [model, allSlugs]);

  const [selection, setSelection] = useState<Selection | null>(findingList[0]?.selection ?? null);

  const selectedEdgeIds = useMemo(() => {
    if (!selection) return new Set<string>();
    if (selection.type === 'edges') return new Set(selection.ids);
    return new Set(edges.filter((e) => e.from === selection.name || e.to === selection.name).map((e) => e.id));
  }, [selection, edges]);

  const panelClaims = useMemo(() => {
    const order = new Map(edges.map((e, i) => [e.id, i]));
    const forEdge = (c: (typeof claims)[number]) => `${c.from}|${c.polarity}|${c.to}`;
    return claims
      .filter((c) => selectedEdgeIds.has(forEdge(c)) && (selection?.type === 'edges' || activeIds.has(forEdge(c))))
      .sort(
        (a, b) =>
          (order.get(forEdge(a)) ?? 0) - (order.get(forEdge(b)) ?? 0) ||
          allSlugs.indexOf(a.narrator) - allSlugs.indexOf(b.narrator) ||
          a.t - b.t,
      );
  }, [claims, edges, selectedEdgeIds, activeIds, selection, allSlugs]);
  const belowMinimum =
    selection?.type === 'factor'
      ? claims.filter(
          (c) =>
            selectedEdgeIds.has(`${c.from}|${c.polarity}|${c.to}`) && !activeIds.has(`${c.from}|${c.polarity}|${c.to}`),
        ).length
      : 0;

  return (
    <Box ref={rootRef} sx={{ pb: 10 }}>
      <SectionIntro title="The loops they describe">
        Every arrow is a cause-and-effect claim a narrator made in their own words: this strengthens that, or this
        undermines that. Thicker arrows were made by more narrators. Select a factor or an arrow to see who said it.
      </SectionIntro>

      {/* Controls */}
      <Box
        sx={{
          mt: 3,
          background: t.paper,
          borderTop: `1px solid ${t.rule}`,
          borderBottom: `1px solid ${t.rule}`,
        }}>
        <Box sx={{ ...shell, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <Label>Min. narrators per arrow</Label>
            {MIN_OPTIONS.map((m) => (
              <Chip key={m} on={minNarrators === m} onClick={() => setMinNarrators(m)}>
                {m}
              </Chip>
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <Label>Show</Label>
            <Chip
              on={includeAsked}
              onClick={() => setIncludeAsked((v) => !v)}
              title="Claims that answered a question naming the topic, e.g. “How does the integrated care model benefit patients?”">
              Claims asked directly
            </Chip>
            <Chip on={showContradictions} onClick={() => setShowContradictions((v) => !v)}>
              Contradictions
            </Chip>
            <Chip
              on={showAllFactors}
              onClick={() => setShowAllFactors((v) => !v)}
              title="Include factors with no arrow at this minimum">
              All factors
            </Chip>
          </Box>
          {showContradictions && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
              <Label>Disagreements</Label>
              {contradictions.length === 0 && (
                <Box component="span" sx={{ fontSize: '13px', color: t.muted3 }}>
                  None among the selected narrators.
                </Box>
              )}
              {contradictions.map((c) =>
                c.type === 'opposite' ? (
                  <Chip
                    key={`o-${c.from}-${c.to}`}
                    on={false}
                    color={loop.contradiction}
                    onClick={() =>
                      setSelection({
                        type: 'edges',
                        ids: [c.strengthens, c.undermines],
                        label: `${c.from} → ${c.to}, both ways`,
                      })
                    }>
                    {c.from} → {c.to}: both ways
                  </Chip>
                ) : (
                  <Chip
                    key={`m-${c.factor}`}
                    on={false}
                    color={loop.contradiction}
                    onClick={() => setSelection({ type: 'factor', name: c.factor })}>
                    {c.factor}: cuts both ways
                  </Chip>
                ),
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Map and panel */}
      <Box
        sx={{
          ...shell,
          maxWidth: 1600,
          mt: 2.5,
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 400px' },
          alignItems: 'start',
        }}>
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              background: t.surface,
              border: `1px solid ${t.rule}`,
              borderRadius: '8px',
              // Phone widths: the map scrolls sideways inside its card, never the page.
              overflowX: 'auto',
              p: { xs: 1, md: 1.5 },
            }}>
            <LoopMap
              columns={model.columns}
              layout={layout}
              factors={shownFactors}
              activeEdges={activeEdges}
              ghostEdges={ghostEdges}
              activeFactors={activeFactors}
              selection={selection}
              contradictionIds={contradictionIds}
              showAskedMarker={includeAsked}
              onSelect={setSelection}
            />
          </Box>
          <Legend showAskedMarker={includeAsked} showContradictions={showContradictions} />
        </Box>
        <Box
          sx={{
            position: { lg: 'sticky' },
            top: { lg: 180 },
            maxHeight: { lg: 'calc(100vh - 220px)' },
            overflowY: { lg: 'auto' },
          }}>
          <ClaimsPanel
            selection={selection}
            claims={panelClaims}
            belowMinimum={belowMinimum}
            minNarrators={effectiveMin}
            onShowAll={() => setMinNarrators(1)}
            factors={factorByName}
            narrators={narratorBySlug}
            narratorColor={narratorColor}
          />
        </Box>
      </Box>

      <MethodNote />
    </Box>
  );
};

const Legend = ({ showAskedMarker, showContradictions }: { showAskedMarker: boolean; showContradictions: boolean }) => (
  <Box
    aria-label="Legend"
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px 22px',
      alignItems: 'center',
      mt: 1.25,
      fontSize: '12.5px',
      color: t.muted3,
    }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="34" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="33" y2="5" stroke={loop.strengthens} strokeWidth="2.5" />
      </svg>
      strengthens
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="34" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="33" y2="5" stroke={loop.undermines} strokeWidth="2.5" strokeDasharray="6 4" />
      </svg>
      undermines
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="54" height="16" aria-hidden="true">
        <line x1="1" y1="8" x2="16" y2="8" stroke={t.muted3} strokeWidth="1.3" />
        <line x1="22" y1="8" x2="53" y2="8" stroke={t.muted3} strokeWidth="9" />
      </svg>
      thicker = more narrators made the claim (agreement, not truth)
    </Box>
    {showAskedMarker && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <svg width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="#fff" stroke={t.muted3} strokeWidth="1.6" />
        </svg>
        rests only on answers to questions that named the topic
      </Box>
    )}
    {showContradictions && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <svg width="34" height="14" aria-hidden="true">
          <line x1="3" y1="7" x2="31" y2="7" stroke={loop.contradiction} strokeWidth="11" strokeLinecap="round" />
        </svg>
        part of a disagreement
      </Box>
    )}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="34" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="33" y2="5" stroke={loop.ghost} strokeWidth="1" />
      </svg>
      made only by narrators not selected
    </Box>
  </Box>
);

const MethodNote = () => (
  <Box component="section" aria-label="Method" sx={{ ...shell, mt: 5 }}>
    <Box sx={{ maxWidth: 820, borderTop: `1px solid ${t.rule}`, pt: 2.5 }}>
      <Box component="h2" sx={{ m: 0, ...mono(11, 0.14), color: t.muted3 }}>
        How this was made
      </Box>
      <Box component="p" sx={{ mt: 1.25, mb: 0, fontSize: '14px', lineHeight: 1.65, color: t.ink2 }}>
        Claims were extracted by AI from the interview transcripts, then verified word for word against them: every
        quote appears in the recording exactly as transcribed, and each clip runs from the first quoted word to the
        last. Factor names come from a shared vocabulary and editorial merges, and the four columns are an editorial
        framing, with causes generally on the left and results on the right. Some claims answered questions that named
        the topic; the toggle above removes them. Arrow thickness counts how many narrators made a claim. It measures
        agreement, not truth or importance. This is a map of claims to test with more narrators, not a model of how
        Permanente works. Passages narrators asked to have cut are left out.
      </Box>
    </Box>
  </Box>
);
