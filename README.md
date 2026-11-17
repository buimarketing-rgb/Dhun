# Dhun 🎵

A Spotify-style music player for Hindi & English songs.

- Trending Hindi charts, Billboard Hot 100 and 12 mood/occasion playlists play inside the app through YouTube's official player
- **Auto-updates daily**: a GitHub Action reads official music channels' YouTube feeds every morning (6 AM IST) and adds new releases to `new.json`
- Play your own MP3s too, with likes, playlists, shuffle/repeat, song radio, sleep timer and "similar songs" suggestions

Live site: https://buimarketing-rgb.github.io/dhun/

To update right away: **Actions → Update new songs & publish → Run workflow**.
To follow more channels, add their YouTube @handle to `SOURCES` in `scripts/update.mjs`.
