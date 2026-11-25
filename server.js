const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// JioSaavn DES-ECB Decryption using Triple-DES equivalence (Zero external dependencies)
function decryptMediaUrl(enc) {
  if (!enc) return null;
  try {
    const rawKey = Buffer.from('38346591', 'utf8');
    const tripleKey = Buffer.concat([rawKey, rawKey, rawKey]);
    const decipher = crypto.createDecipheriv('des-ede3-ecb', tripleKey, null);
    decipher.setAutoPadding(true);
    let dec = decipher.update(enc, 'base64', 'utf8');
    dec += decipher.final('utf8');
    // Default to 320kbps CD Quality stream
    return dec.replace('_96.mp4', '_320.mp4');
  } catch (err) {
    return null;
  }
}

// Clean HTML entities from text
function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Fetch helper with standard browser headers
function fetchJioSaavn(endpoint, callback) {
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  };

  https.get(endpoint, options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        callback(null, json);
      } catch (e) {
        callback(e, null);
      }
    });
  }).on('error', (err) => {
    callback(err, null);
  });
}

// Search Songs
function searchSongs(query, callback) {
  const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&p=1&n=25&q=${encodeURIComponent(query)}&_format=json&_marker=0&api_version=4&ctx=android`;
  fetchJioSaavn(url, (err, data) => {
    if (err || !data || !data.results) {
      return callback([]);
    }

    const songs = data.results.map(item => {
      const encrypted = item.more_info?.encrypted_media_url;
      const stream320 = decryptMediaUrl(encrypted);
      const stream160 = stream320 ? stream320.replace('_320.mp4', '_160.mp4') : null;
      const stream96 = stream320 ? stream320.replace('_320.mp4', '_96.mp4') : null;

      return {
        id: item.id,
        title: cleanText(item.title),
        artist: cleanText(item.more_info?.singers || item.more_info?.music || item.subtitle || 'Artist'),
        album: cleanText(item.more_info?.album || ''),
        year: item.year || '',
        duration: parseInt(item.more_info?.duration || 0),
        image: (item.image || '').replace('150x150', '500x500'),
        thumbnail: item.image || '',
        streamUrl: stream320,
        streamUrl160: stream160,
        streamUrl96: stream96,
        hasLyrics: item.more_info?.has_lyrics === 'true'
      };
    }).filter(s => s.streamUrl);

    callback(songs);
  });
}

// In-Memory cache for trending sections
const trendingCache = {
  timestamp: 0,
  data: null
};

// Curated Top Artists
const TOP_ARTISTS = [
  { name: 'Arijit Singh', image: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20201118055627_500x500.jpg', query: 'Arijit Singh hits' },
  { name: 'Taylor Swift', image: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200227163857_500x500.jpg', query: 'Taylor Swift top' },
  { name: 'Diljit Dosanjh', image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221007180447_500x500.jpg', query: 'Diljit Dosanjh hits' },
  { name: 'The Weeknd', image: 'https://c.saavncdn.com/artists/The_Weeknd_500x500.jpg', query: 'The Weeknd hits' },
  { name: 'Shreya Ghoshal', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_004_20221118123223_500x500.jpg', query: 'Shreya Ghoshal hits' },
  { name: 'Sidhu Moose Wala', image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20230609072049_500x500.jpg', query: 'Sidhu Moose Wala' },
  { name: 'Atif Aslam', image: 'https://c.saavncdn.com/artists/Atif_Aslam_500x500.jpg', query: 'Atif Aslam romantic' },
  { name: 'Kishore Kumar', image: 'https://c.saavncdn.com/artists/Kishore_Kumar_500x500.jpg', query: 'Kishore Kumar classics' },
  { name: 'Ed Sheeran', image: 'https://c.saavncdn.com/artists/Ed_Sheeran_500x500.jpg', query: 'Ed Sheeran pop' },
  { name: 'Karan Aujla', image: 'https://c.saavncdn.com/artists/Karan_Aujla_004_20230818090724_500x500.jpg', query: 'Karan Aujla hits' }
];

function getTrendingCollections(callback) {
  const now = Date.now();
  if (trendingCache.data && (now - trendingCache.timestamp < 10 * 60 * 1000)) {
    return callback(trendingCache.data);
  }

  const queries = [
    { key: 'trendingHindi', title: 'Trending Bollywood Hits', q: 'Trending Hindi 2026' },
    { key: 'globalHits', title: 'Global Top 50 (Billboard)', q: 'Billboard Hot 100 Global' },
    { key: 'punjabiBangers', title: 'Punjabi Heat', q: 'Punjabi Hits Karan Aujla Diljit' },
    { key: 'classics', title: 'Golden 90s & Evergreen Classics', q: 'Kishore Kumar Kumar Sanu 90s' },
    { key: 'lofi', title: 'Late Night Chill & Lo-Fi', q: 'Lo-Fi Chill Hindi English' },
    { key: 'romantic', title: 'Soulful Romance', q: 'Romantic Love Songs Hindi' }
  ];

  const results = {
    artists: TOP_ARTISTS
  };
  let completed = 0;

  queries.forEach(cat => {
    searchSongs(cat.q, (songs) => {
      results[cat.key] = {
        title: cat.title,
        songs: songs.slice(0, 16)
      };
      completed++;
      if (completed === queries.length) {
        trendingCache.data = results;
        trendingCache.timestamp = now;
        callback(results);
      }
    });
  });
}

// Synced Karaoke Lyrics from LRCLIB + JioSaavn Fallback
function getSyncedLyrics(title, artist, songId, callback) {
  const cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/From\s+".*"/i, '').trim();
  const cleanArtist = artist.split(',')[0].split('&')[0].trim();
  const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;

  const fallbackSaavn = () => {
    if (!songId) return callback({ synced: false, plain: 'Lyrics not available for this song yet.' });
    const saavnUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(songId)}&ctx=web6dot0&_format=json&_marker=0`;
    fetchJioSaavn(saavnUrl, (err, sData) => {
      if (!err && sData && sData.lyrics) {
        return callback({ synced: false, plain: cleanText(sData.lyrics) });
      }
      callback({ synced: false, plain: 'Lyrics not available for this song yet.' });
    });
  };

  https.get(url, { headers: { 'User-Agent': 'SpotFreeApp/2.0' } }, (res) => {
    if (res.statusCode !== 200) {
      return fallbackSaavn();
    }
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.syncedLyrics) {
          const lines = json.syncedLyrics.split('\n').map(l => {
            const m = l.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
            if (m) {
              const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
              return { time, text: m[3] };
            }
            return null;
          }).filter(Boolean);
          if (lines.length > 0) {
            return callback({ synced: true, lines });
          }
        }
        if (json.plainLyrics) {
          return callback({ synced: false, plain: cleanText(json.plainLyrics) });
        }
      } catch (e) {}

      fallbackSaavn();
    });
  }).on('error', () => {
    fallbackSaavn();
  });
}

// Get Local Wi-Fi IPv4
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// HTTP Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // ROUTE: Search Songs
  if (pathname === '/api/search') {
    const query = parsedUrl.searchParams.get('q');
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing query parameter "q"' }));
    }

    searchSongs(query, (songs) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: songs.length, songs }));
    });
    return;
  }

  // ROUTE: Trending & Artists
  if (pathname === '/api/trending') {
    getTrendingCollections((collections) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, collections }));
    });
    return;
  }

  // ROUTE: Synced & Plain Lyrics
  if (pathname === '/api/lyrics') {
    const title = parsedUrl.searchParams.get('title') || '';
    const artist = parsedUrl.searchParams.get('artist') || '';
    const id = parsedUrl.searchParams.get('id') || '';

    getSyncedLyrics(title, artist, id, (lyricsData) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...lyricsData }));
    });
    return;
  }

  // ROUTE: Direct Song Downloader (1-Click Offline Save)
  if (pathname === '/api/download') {
    const streamUrl = parsedUrl.searchParams.get('url');
    const songTitle = (parsedUrl.searchParams.get('title') || 'Song').replace(/[^a-zA-Z0-9 _-]/g, '');
    const songArtist = (parsedUrl.searchParams.get('artist') || 'SpotFree').replace(/[^a-zA-Z0-9 _-]/g, '');

    if (!streamUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing stream URL');
    }

    const filename = `${songTitle} - ${songArtist}.m4a`;

    https.get(streamUrl, (cdnRes) => {
      res.writeHead(200, {
        'Content-Type': 'audio/mp4',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': cdnRes.headers['content-length'] || ''
      });
      cdnRes.pipe(res);
    }).on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Download failed from stream provider.');
    });
    return;
  }

  // STATIC FILE ROUTING
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, fallback) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fallback);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLocalIP();
  console.log('\n============================================================');
  console.log('       🎵 SPOTFREE PRO • UNLIMITED FREE MUSIC APP 🎵        ');
  console.log('============================================================');
  console.log(`[✔] Local PC Access:    http://localhost:${PORT}`);
  console.log(`[✔] Android Phone WiFi:  http://${lanIP}:${PORT}`);
  console.log('------------------------------------------------------------');
  console.log('[*] On your Android Phone: Connect to same WiFi, open Chrome,');
  console.log(`    visit http://${lanIP}:${PORT} and tap "Install App"`);
  console.log('    to install SpotFree Pro on your home screen with native controls!');
  console.log('============================================================\n');

  const startCmd = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
  exec(`${startCmd} http://localhost:${PORT}`, () => {});
});
