import { NextResponse } from 'next/server';
import { getAllStoriesFromCollection } from '@/lib/weaviate/search';
import { SchemaTypes } from '@/types/weaviate';

/**
 * interview_title -> the story's Weaviate uuid, video url and audio flag.
 *
 * The evidence bank identifies interviews by their TheirStory `_id`, but the
 * portal addresses stories by their Weaviate object uuid — unrelated ids.
 * Explore fetches this map once so an excerpt click can build a Citation for
 * the shared side panel without a per-click round trip. Resolved at request
 * time so a re-import reassigning uuids can't leave a stale table behind.
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
      ['interview_title', 'video_url', 'isAudioFile'],
      STORIES_LIMIT,
      0,
    );

    const byTitle: Record<string, InterviewRef> = {};
    for (const obj of stories?.objects ?? []) {
      const props = obj.properties as Record<string, unknown>;
      const title = String(props?.interview_title ?? '');
      if (!title || !obj.uuid) continue;
      byTitle[title] = {
        storyUuid: obj.uuid,
        videoUrl: String(props?.video_url ?? ''),
        isAudioFile: Boolean(props?.isAudioFile),
      };
    }

    return NextResponse.json({ byTitle } satisfies InterviewsResponse);
  } catch (error) {
    console.error('[explore] interview lookup failed:', error);
    return NextResponse.json({ error: 'Failed to load interviews' }, { status: 500 });
  }
}
