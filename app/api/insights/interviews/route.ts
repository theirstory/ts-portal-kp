import { NextResponse } from 'next/server';
import { loadEvidenceIndex } from '@/lib/insights/loadEvidenceBank';
import { getAllStoriesFromCollection } from '@/lib/weaviate/search';
import { testimonyUuid } from '@/scripts/lib/testimony-ids';
import { SchemaTypes } from '@/types/weaviate';

/**
 * interview_title -> the story's Weaviate uuid, video url and audio flag.
 *
 * The evidence bank identifies interviews by their TheirStory `_id`, but the
 * portal addresses stories by their Weaviate object uuid — unrelated ids.
 * Explore fetches this map once so an excerpt click can build a Citation for
 * the shared side panel without a per-click round trip. Resolved at request
 * time so a re-import reassigning uuids can't leave a stale table behind.
 *
 * Bank titles are matched by exact title, and failing that by the bank's story id: a re-sync can
 * retitle a Testimony ("Chris Grant" -> "TheirStory Interview With Chris Grant") while its uuid,
 * derived from collection id + story id, stays the same.
 */

const STORIES_LIMIT = 500;

export type InterviewRef = {
  storyUuid: string;
  videoUrl: string;
  isAudioFile: boolean;
};

export type InterviewsResponse = {
  byTitle: Record<string, InterviewRef>;
};

export async function GET() {
  try {
    const stories = await getAllStoriesFromCollection(
      SchemaTypes.Testimonies,
      ['interview_title', 'video_url', 'isAudioFile', 'collection_id'],
      STORIES_LIMIT,
      0,
    );

    const byTitle: Record<string, InterviewRef> = {};
    const byUuid = new Map<string, InterviewRef>();
    const collectionIds = new Set<string>();
    for (const obj of stories?.objects ?? []) {
      const props = obj.properties as Record<string, unknown>;
      const title = String(props?.interview_title ?? '');
      if (!obj.uuid) continue;
      const ref = {
        storyUuid: obj.uuid,
        videoUrl: String(props?.video_url ?? ''),
        isAudioFile: Boolean(props?.isAudioFile),
      };
      byUuid.set(obj.uuid, ref);
      collectionIds.add(String(props?.collection_id ?? ''));
      if (title) byTitle[title] = ref;
    }

    for (const interview of loadEvidenceIndex().roster) {
      if (byTitle[interview.interview_title] || !interview.interview_id) continue;
      for (const collectionId of collectionIds) {
        const ref = byUuid.get(testimonyUuid(collectionId, interview.interview_id));
        if (ref) {
          byTitle[interview.interview_title] = ref;
          break;
        }
      }
    }

    return NextResponse.json({ byTitle } satisfies InterviewsResponse);
  } catch (error) {
    console.error('[explore] interview lookup failed:', error);
    return NextResponse.json({ error: 'Failed to load interviews' }, { status: 500 });
  }
}
