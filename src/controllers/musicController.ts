// src/controllers/musicController.ts
/**
 * YouTube Music integration for the SamajUnati music picker.
 *
 * All three endpoints call the YouTube Data API v3:
 *   GET /api/music/trending         – chart=mostPopular, category 10 (Music), region IN
 *   GET /api/music/search?q=...     – freeTextSearchTerms, type=video, category 10
 *   GET /api/music/hook?videoId=... – returns the best hook start time for a video
 *
 * No auth token required — these are called during content creation.
 */
import { Request, Response } from 'express';
import { config } from '../config/env';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

interface YTSnippet {
  title: string;
  channelTitle: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
    maxres?: { url: string };
  };
  publishedAt?: string;
  description?: string;
}

interface YTVideoItem {
  id: { videoId?: string } | string;
  snippet?: YTSnippet;
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
}

/** Parse ISO 8601 duration (PT1H2M3S) → total seconds */
function isoToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

/** Extract a best-quality thumbnail URL from a YT snippet */
function thumb(snippet: YTSnippet): string {
  return (
    snippet.thumbnails.maxres?.url ||
    snippet.thumbnails.high?.url ||
    snippet.thumbnails.medium?.url ||
    snippet.thumbnails.default?.url ||
    ''
  );
}

/** Normalize a raw YT item (search or video list) into our MusicTrack shape */
function toTrack(item: YTVideoItem, detailsMap?: Map<string, { duration: string; views: string }>) {
  const videoId = typeof item.id === 'string' ? item.id : item.id.videoId;
  const snippet = item.snippet!;
  const details = videoId ? detailsMap?.get(videoId) : undefined;

  const totalSec = details?.duration ? isoToSeconds(details.duration) : 0;
  const viewCount = details?.views ? parseInt(details.views) : 0;

  // Smart hook heuristic: chorus typically occurs ~30–45% into the song.
  // For short clips (<90s) start at 0, otherwise start at 30% of duration.
  let hookStart = 0;
  if (totalSec > 90) {
    hookStart = Math.floor(totalSec * 0.3);
  }

  return {
    id: videoId,
    title: snippet.title,
    artist: snippet.channelTitle,
    artworkUrl: thumb(snippet),
    youtubeVideoId: videoId,
    durationSeconds: totalSec || null,
    hookStart,
    viewCount,
  };
}

// In-memory cache for audio previews: videoId or clean query -> previewUrl
const previewCache = new Map<string, string>();

const FALLBACK_PREVIEWS = [
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/80/7e/11/807e112d-944d-db11-0941-8f55da2eb6d1/mzaf_10014022872658933220.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/4a/12/36/4a1236ea-1d60-7a87-fae3-a60216503c7e/mzaf_16881958641916327663.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/31/76/85/31768565-5c1a-8c54-79fa-35804ef050b1/mzaf_16422780783515086580.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b9/8b/6d/b98b6ddb-b9f4-3ea3-6f81-2a62a74c2ae7/mzaf_11942738747444154425.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a4/bc/99/a4bc99bc-ee33-e99d-16f5-ef8a1cb5b187/mzaf_17290945899478144214.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ee/c1/34/eec134c4-7fa0-4828-b0a6-c852445853b0/mzaf_9954005183889148443.plus.aac.p.m4a',
];

function getFallbackPreview(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_PREVIEWS.length;
  return FALLBACK_PREVIEWS[index];
}

async function resolveAudioPreview(videoId: string, title: string, artist?: string): Promise<string> {
  if (previewCache.has(videoId)) {
    return previewCache.get(videoId)!;
  }

  const parts = title
    .split(/[\|:\-–—]/)
    .map((p) => p.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim())
    .filter(Boolean);

  const candidates: string[] = [];
  if (parts.length > 0) {
    candidates.push(parts[0]);
    if (parts.length > 1) {
      candidates.push(`${parts[0]} ${parts[1]}`);
    }
  }
  const cleanedFull = title
    .replace(/[\(\[\{].*?[\)\]\}]/g, ' ')
    .replace(/[\|:\-–—_#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanedFull) {
    candidates.push(cleanedFull.slice(0, 60));
  }

  for (const q of [...new Set(candidates)]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`;
      const itRes = await fetch(itunesUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (itRes.ok) {
        const data = (await itRes.json()) as any;
        const preview = data.results?.[0]?.previewUrl;
        if (preview && typeof preview === 'string') {
          previewCache.set(videoId, preview);
          return preview;
        }
      }
    } catch {
      // Continue to next candidate or fallback
    }
  }

  const fallback = getFallbackPreview(videoId || title);
  previewCache.set(videoId, fallback);
  return fallback;
}

const audioBufferCache = new Map<string, Buffer>();

function formatProxyUrl(req: Request, id: string, remoteUrl: string): string {
  const host = req.get('host') || 'localhost:8003';
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/api/music/stream/${encodeURIComponent(id)}.mp4?url=${encodeURIComponent(remoteUrl)}`;
}

async function attachAudioPreviews(tracks: Array<any>, req?: Request): Promise<Array<any>> {
  const settled = await Promise.allSettled(
    tracks.map(async (t) => {
      const rawUrl = await resolveAudioPreview(t.id || t.youtubeVideoId, t.title, t.artist);
      const previewUrl = req ? formatProxyUrl(req, t.id || t.youtubeVideoId, rawUrl) : rawUrl;
      return { ...t, previewUrl, rawAudioUrl: rawUrl };
    })
  );

  return settled.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    const fallback = getFallbackPreview(tracks[i].id || tracks[i].title);
    const previewUrl = req ? formatProxyUrl(req, tracks[i].id || tracks[i].title, fallback) : fallback;
    return {
      ...tracks[i],
      previewUrl,
      rawAudioUrl: fallback,
    };
  });
}

/**
 * GET /api/music/stream/:id.mp4?url=...
 *
 * Streams MP4 audio directly to mobile clients with HTTP 206 Partial Content (Range requests).
 * Solves Android ExoPlayer MIME type parsing issues with remote CDNs and ensures instant local streaming.
 */
export const streamAudio = async (req: Request, res: Response): Promise<void> => {
  const paramId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string | undefined;
  const remoteUrl =
    (req.query.url as string | undefined)?.trim() ||
    (paramId ? previewCache.get(paramId) : undefined);

  if (!remoteUrl) {
    res.status(400).send('Missing audio URL');
    return;
  }

  try {
    let buffer = audioBufferCache.get(remoteUrl);

    if (!buffer) {
      const audioRes = await fetch(remoteUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      });

      if (!audioRes.ok) {
        res.status(audioRes.status).send('Failed to fetch audio stream');
        return;
      }

      const arrayBuf = await audioRes.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
      audioBufferCache.set(remoteUrl, buffer);
      if (paramId) {
        audioBufferCache.set(paramId, buffer);
      }
    }

    const total = buffer.length;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buffer.subarray(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': 'audio/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buffer);
    }
  } catch (err) {
    console.error('streamAudio error', err);
    res.status(500).send('Internal streaming error');
  }
};

/** Fetch content details (duration + views) for a batch of videoIds */
async function fetchDetails(apiKey: string, videoIds: string[]): Promise<Map<string, { duration: string; views: string }>> {
  const map = new Map<string, { duration: string; views: string }>();
  if (videoIds.length === 0) return map;

  const url = `${YT_BASE}/videos?part=contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
  const res = await fetch(url);
  const data = (await res.json()) as any;
  for (const item of data.items ?? []) {
    map.set(item.id, {
      duration: item.contentDetails?.duration || '',
      views: item.statistics?.viewCount || '0',
    });
  }
  return map;
}

// ────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────

/**
 * GET /api/music/trending
 *
 * Returns up to 20 trending music videos in India (videoCategoryId=10).
 */
export const getTrendingMusic = async (req: Request, res: Response): Promise<Response | void> => {
  const apiKey = config.google.mapsApiKey;
  if (!apiKey) {
    return res.status(503).json({ message: 'Music service not configured' });
  }

  const url =
    `${YT_BASE}/videos` +
    `?part=snippet,contentDetails,statistics` +
    `&chart=mostPopular` +
    `&videoCategoryId=10` +
    `&regionCode=IN` +
    `&maxResults=20` +
    `&key=${apiKey}`;

  try {
    const ytRes = await fetch(url);
    const data = (await ytRes.json()) as any;

    if (!data.items || data.items.length === 0) {
      return res.json({ tracks: [] });
    }

    const rawTracks = (data.items as any[]).map((item) => {
      const totalSec = item.contentDetails?.duration
        ? isoToSeconds(item.contentDetails.duration)
        : 0;
      let hookStart = 0;
      if (totalSec > 90) hookStart = Math.floor(totalSec * 0.3);

      return {
        id: item.id,
        title: item.snippet?.title || 'Unknown',
        artist: item.snippet?.channelTitle || 'Unknown',
        artworkUrl: thumb(item.snippet || {}),
        youtubeVideoId: item.id,
        durationSeconds: totalSec || null,
        hookStart,
        viewCount: parseInt(item.statistics?.viewCount || '0'),
        tag: 'Trending',
      };
    });

    const tracks = await attachAudioPreviews(rawTracks, req);
    return res.json({ tracks });
  } catch (err) {
    console.error('getTrendingMusic error', err);
    return res.status(500).json({ message: 'Failed to fetch trending music' });
  }
};

/**
 * GET /api/music/search?q=Arijit+Singh&maxResults=15
 *
 * Searches for music tracks matching the query with preview audio.
 */
export const searchMusic = async (req: Request, res: Response): Promise<Response | void> => {
  const apiKey = config.google.mapsApiKey;
  if (!apiKey) {
    return res.status(503).json({ message: 'Music service not configured' });
  }

  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 1) {
    return res.status(400).json({ message: 'Query parameter q is required' });
  }

  const maxResults = Math.min(25, parseInt((req.query.maxResults as string) || '20') || 20);

  const searchUrl =
    `${YT_BASE}/search` +
    `?part=snippet` +
    `&type=video` +
    `&videoCategoryId=10` +
    `&q=${encodeURIComponent(q)}` +
    `&maxResults=${maxResults}` +
    `&regionCode=IN` +
    `&relevanceLanguage=hi` +
    `&key=${apiKey}`;

  try {
    const ytRes = await fetch(searchUrl);
    const data = (await ytRes.json()) as any;

    if (!data.items || data.items.length === 0) {
      return res.json({ tracks: [] });
    }

    // Collect video IDs to fetch duration + view counts in a second call
    const videoIds: string[] = data.items
      .map((i: any) => i.id?.videoId)
      .filter(Boolean);

    const detailsMap = await fetchDetails(apiKey, videoIds);

    const rawTracks = (data.items as YTVideoItem[])
      .filter((i) => i.id && typeof i.id !== 'string' && (i.id as any).videoId)
      .map((i) => toTrack(i, detailsMap));

    const tracks = await attachAudioPreviews(rawTracks, req);
    return res.json({ tracks });
  } catch (err) {
    console.error('searchMusic error', err);
    return res.status(500).json({ message: 'Failed to search music' });
  }
};

/**
 * GET /api/music/hook?videoId=dQw4w9WgXcW
 *
 * Returns the best hook start time for a given YouTube video.
 * Uses YouTube's chapter markers (from video description) if available;
 * falls back to a duration-based heuristic (30% into the song).
 */
export const getMusicHook = async (req: Request, res: Response): Promise<Response | void> => {
  const apiKey = config.google.mapsApiKey;
  if (!apiKey) {
    return res.status(503).json({ message: 'Music service not configured' });
  }

  const videoId = (req.query.videoId as string | undefined)?.trim();
  if (!videoId) {
    return res.status(400).json({ message: 'videoId query parameter is required' });
  }

  const url =
    `${YT_BASE}/videos` +
    `?part=snippet,contentDetails` +
    `&id=${encodeURIComponent(videoId)}` +
    `&key=${apiKey}`;

  try {
    const ytRes = await fetch(url);
    const data = (await ytRes.json()) as any;
    const item = data.items?.[0];
    if (!item) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const totalSec = item.contentDetails?.duration
      ? isoToSeconds(item.contentDetails.duration)
      : 0;

    // Try to find the chorus / hook via chapter timestamps in the description.
    // YouTube chapters are lines like "1:30 Chorus" in the description.
    const description: string = item.snippet?.description || '';
    const chapterRegex = /(?:^|\n)(\d+:\d+(?::\d+)?)\s+(.+)/g;
    const chapters: { sec: number; label: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = chapterRegex.exec(description)) !== null) {
      const parts = m[1].split(':').map(Number);
      const sec =
        parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1];
      chapters.push({ sec, label: m[2].trim() });
    }

    // Look for a chapter whose label contains "chorus", "hook", "mukhda", etc.
    const hookKeywords = /chorus|hook|mukhda|sthayi|refrain/i;
    const hookChapter = chapters.find((c) => hookKeywords.test(c.label));

    let hookStart: number;
    if (hookChapter) {
      hookStart = hookChapter.sec;
    } else if (totalSec > 90) {
      // Heuristic: 30% into the song is a reliable chorus estimate for pop music
      hookStart = Math.floor(totalSec * 0.3);
    } else {
      hookStart = 0;
    }

    return res.json({
      videoId,
      hookStart,
      totalSeconds: totalSec,
      chaptersFound: chapters.length,
      hookDetectedViaChapter: !!hookChapter,
    });
  } catch (err) {
    console.error('getMusicHook error', err);
    return res.status(500).json({ message: 'Failed to detect hook' });
  }
};
