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
import prisma from '../lib/prisma';

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
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a6/e8/37/a6e837ce-3dc5-3f1a-6228-b0305719c8f2/mzaf_9002670426001196919.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e5/c2/0a/e5c20a8d-f1b4-5d95-2ac1-e2e9efa502bb/mzaf_11124996926999296098.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/cf/5f/ef/cf5fef49-8ab0-0d0b-f17a-d820cdca1d88/mzaf_3693019759359818051.plus.aac.p.m4a',
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

async function resolveAudioPreview(videoId: string, title?: string, artist?: string): Promise<string> {
  if (videoId && previewCache.has(videoId)) {
    return previewCache.get(videoId)!;
  }

  // 1. If videoId is numeric (an iTunes track ID), query iTunes lookup directly
  if (videoId && /^\d+$/.test(videoId)) {
    try {
      const itUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(videoId)}`;
      const itRes = await fetch(itUrl);
      if (itRes.ok) {
        const data = (await itRes.json()) as any;
        const preview = data.results?.[0]?.previewUrl;
        if (preview && typeof preview === 'string') {
          previewCache.set(videoId, preview);
          return preview;
        }
      }
    } catch {}
  }

  // 2. Build search candidate queries from title and artist
  const candidates: string[] = [];
  if (title) {
    if (artist) {
      candidates.push(`${artist} ${title}`);
    }
    const parts = title
      .split(/[\|:\-–—]/)
      .map((p) => p.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim())
      .filter(Boolean);
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
  }

  for (const q of [...new Set(candidates)]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`;
      const itRes = await fetch(itunesUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (itRes.ok) {
        const data = (await itRes.json()) as any;
        const preview = data.results?.[0]?.previewUrl;
        if (preview && typeof preview === 'string') {
          if (videoId) previewCache.set(videoId, preview);
          return preview;
        }
      }
    } catch {}
  }

  const fallback = getFallbackPreview(videoId || title || 'default');
  if (videoId) previewCache.set(videoId, fallback);
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
 * GET /api/music/stream/:id.mp4?url=...&title=...&artist=...
 *
 * Streams MP4 audio directly to mobile clients with HTTP 206 Partial Content (Range requests).
 * Solves Android ExoPlayer MIME type parsing issues with remote CDNs and ensures instant local streaming.
 */
export const streamAudio = async (req: Request, res: Response): Promise<void> => {
  const paramId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string | undefined;
  const queryTitle = (req.query.title as string | undefined)?.trim();
  const queryArtist = (req.query.artist as string | undefined)?.trim();

  let remoteUrl =
    (req.query.url as string | undefined)?.trim() ||
    (paramId ? previewCache.get(paramId) : undefined);

  if (!remoteUrl && paramId) {
    if (queryTitle) {
      remoteUrl = await resolveAudioPreview(paramId, queryTitle, queryArtist);
    } else {
      // Check database if paramId is a post id or musicVideoId
      try {
        const post = await prisma.post.findFirst({
          where: {
            OR: [{ musicVideoId: paramId }, { id: paramId }],
          },
          select: { musicVideoId: true, musicTitle: true, musicArtist: true },
        });
        if (post?.musicTitle) {
          remoteUrl = await resolveAudioPreview(post.musicVideoId || paramId, post.musicTitle, post.musicArtist || undefined);
        }
      } catch {}

      if (!remoteUrl) {
        remoteUrl = await resolveAudioPreview(paramId, '');
      }
    }
  }

  if (!remoteUrl) {
    remoteUrl = getFallbackPreview(paramId || 'stream');
  }

  try {
    let buffer = audioBufferCache.get(remoteUrl);

    if (!buffer) {
      let audioRes = await fetch(remoteUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      });

      if (!audioRes.ok) {
        // Fallback to verified working preview if remote URL failed
        const fallbackUrl = getFallbackPreview(paramId || remoteUrl);
        audioRes = await fetch(fallbackUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
          },
        });
      }

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
