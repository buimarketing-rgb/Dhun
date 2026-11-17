// Dhun auto-updater: runs daily on GitHub Actions.
// Reads the public RSS feeds of official music channels on YouTube (no API key needed)
// and writes new.json with the latest Hindi & English song releases.
import fs from "node:fs";

const SOURCES = [
  // Hindi / Indian labels & artists
  { handle: "tseries", lang: "hindi" }, { handle: "zeemusiccompany", lang: "hindi" },
  { handle: "SonyMusicIndia", lang: "hindi" }, { handle: "yrf", lang: "hindi" },
  { handle: "SaregamaMusic", lang: "hindi" }, { handle: "tipsofficial", lang: "hindi" },
  { handle: "TimesMusicHindi", lang: "hindi" }, { handle: "anuvjain", lang: "hindi" },
  { handle: "KaranAujlaOfficial", lang: "hindi" }, { handle: "SpeedRecords", lang: "hindi" },
  // English artists
  { handle: "TaylorSwift", lang: "english" }, { handle: "OliviaRodrigo", lang: "english" },
  { handle: "ArianaGrande", lang: "english" }, { handle: "brunomars", lang: "english" },
  { handle: "TateMcRae", lang: "english" }, { handle: "SabrinaCarpenter", lang: "english" },
  { handle: "TheWeeknd", lang: "english" }, { handle: "dualipa", lang: "english" },
  { handle: "EdSheeran", lang: "english" }, { handle: "BillieEilish", lang: "english" },
  { handle: "ladygaga", lang: "english" }, { handle: "Rihanna", lang: "english" },
];
const KEEP_DAYS = 45, PER_LANG = 40;
const MUSIC = /song|video|audio|lyric|official|music|title track|visuali[sz]er|\|| - /i;
const SKIP = /trailer|teaser|making of|behind the scenes|\bbts\b|interview|jukebox|reaction|promo|motion poster|dialogue|scene|livestream|live stream|podcast|#shorts|full album|nonstop|non-stop|mashup|announcement|unboxing|vlog/i;

const H = { "user-agent": "Mozilla/5.0 (DhunBot; +https://github.com)", "accept-language": "en-US,en;q=0.9" };
const cacheFile = "data/channels.json";
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};

async function channelId(handle) {
  if (cache[handle]) return cache[handle];
  const r = await fetch(`https://www.youtube.com/@${handle}`, { headers: H });
  if (!r.ok) throw new Error(`@${handle}: HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || html.match(/"externalId":"(UC[\w-]{22})"/);
  if (!m) throw new Error(`@${handle}: channel id not found`);
  return (cache[handle] = m[1]);
}
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
function cleanTitle(raw, author) {
  const parts = decode(raw).split(/\s*\|\s*|\s+[-–]\s+/).map(s => s.trim()).filter(Boolean);
  const strip = s => s.replace(/\((official|full|lyric(al)?|audio|video|music|song|visuali[sz]er|4k|hd)[^)]*\)/gi, "")
    .replace(/\b(full video|official video|video song|full song|lyrical video|lyrical|lyric video|official audio|audio song|music video|official music video|visualizer)\b/gi, "")
    .replace(/[\[\]]/g, "").replace(/\s{2,}/g, " ").trim();
  let title = strip(parts[0] || raw), artist = parts.slice(1, 3).map(strip).filter(Boolean).join(" · ");
  // "Artist - Song" style (common on English channels)
  if (parts.length === 2 && author && parts[0].toLowerCase().includes(author.toLowerCase().split(" ")[0])) { title = strip(parts[1]); artist = parts[0]; }
  return { title: title || decode(raw), artist: (artist || author).slice(0, 70) };
}
async function feed(src) {
  const id = await channelId(src.handle);
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { headers: H });
  if (!r.ok) throw new Error(`feed @${src.handle}: HTTP ${r.status}`);
  const xml = await r.text();
  const author = decode((xml.match(/<author>\s*<name>([^<]+)<\/name>/) || [])[1] || src.handle);
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const g = re => (e.match(re) || [])[1];
    return { vid: g(/<yt:videoId>([^<]+)</), raw: g(/<title>([^<]+)</) || "", link: g(/<link rel="alternate" href="([^"]+)"/) || "",
      published: g(/<published>([^<]+)</), views: +(g(/<media:statistics views="(\d+)"/) || 0), author, lang: src.lang };
  });
}

const cutoff = Date.now() - KEEP_DAYS * 864e5, out = [], seen = new Set();
for (const src of SOURCES) {
  try {
    for (const v of await feed(src)) {
      if (!v.vid || seen.has(v.vid) || v.link.includes("/shorts/")) continue;
      if (new Date(v.published).getTime() < cutoff || SKIP.test(v.raw) || !MUSIC.test(v.raw + " " + v.author)) continue;
      seen.add(v.vid);
      out.push({ id: v.vid, ...cleanTitle(v.raw, v.author), lang: v.lang, channel: v.author, published: v.published, views: v.views });
    }
    console.log("ok", src.handle);
  } catch (e) { console.warn("skip", e.message); }
}
const pick = lang => out.filter(s => s.lang === lang).sort((a, b) => b.published.localeCompare(a.published)).slice(0, PER_LANG);
const songs = [...pick("hindi"), ...pick("english")];
if (!songs.length) { console.error("No songs found – keeping previous new.json"); process.exit(0); }
fs.writeFileSync("new.json", JSON.stringify({ updated: new Date().toISOString(), songs }, null, 1));
fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
console.log(`wrote ${songs.length} songs`);
