const API =
  "https://white-playlist-api-v2.mahantem2.workers.dev/api/v1";

const AUDIO_API =
  "https://white-playlist-api-v2.mahantem2.workers.dev/api/v1/audio";

/* =========================================================
   TELEGRAM
   ========================================================= */

const tg =
  window.Telegram?.WebApp || null;

if (tg) {
  tg.ready();
  tg.expand();

  try {
    tg.setHeaderColor("#090909");
    tg.setBackgroundColor("#090909");
  } catch (_) {}
}

// Keeps --app-vh in sync with the real visible height this page has to
// work with. Inside Telegram, that's tg.viewportStableHeight — the
// area actually below Telegram's own header/chrome — which varies by
// device/OS and doesn't always match 100dvh in Telegram's in-app
// browser (some devices under-report, some over-report, so the full
// player's bottom controls end up cut off or with a gap). Outside
// Telegram it just falls back to window.innerHeight. .player uses
// var(--app-vh, 100dvh) so it always fills exactly the real visible
// area, edge to edge, on every phone size — see style.css.
function syncViewportHeight() {
  const h =
    (tg && (tg.viewportStableHeight || tg.viewportHeight)) ||
    window.innerHeight;
  document.documentElement.style.setProperty("--app-vh", h + "px");
  // Telegram's viewportChanged doesn't always also fire a window
  // "resize" event, so refit the lyrics box here too (fitLyricsText
  // is a no-op if the player is closed or lyrics aren't loaded yet).
  if (typeof fitLyricsText === "function") fitLyricsText();
}
syncViewportHeight();
window.addEventListener("resize", syncViewportHeight);
window.addEventListener("orientationchange", syncViewportHeight);
if (tg?.onEvent) {
  tg.onEvent("viewportChanged", syncViewportHeight);
}

/* =========================================================
   STATE
   ========================================================= */

const state = {
  userId:
    tg?.initDataUnsafe?.user?.id
      ? String(tg.initDataUnsafe.user.id)
      : null,

  songs: [],
  favorites: [],
  artists: [],
  albums: [],
  playlists: [],
  queue: [],
  queueIndex: -1,
  currentSong: null,
  isPlaying: false,
  shuffle: false,
  repeatOne: false,

  // Home dashboard data (all real, fetched from existing/new
  // read-only endpoints — never fabricated client-side).
  recentlyPlayed: [],
  mostPlayed: [],
  topArtists: []
};

/* =========================================================
   DOM
   ========================================================= */

const audio =
  document.getElementById("audio");

const miniPlayer =
  document.getElementById("miniPlayer");

const playerOverlay =
  document.getElementById("playerOverlay");

/* =========================================================
   SVG ICONS
   ========================================================= */

const ICONS = {
  search: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5"></circle>
      <line x1="16" y1="16" x2="21" y2="21"></line>
    </svg>
  `,

  music: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18V5l10-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="16" cy="16" r="3"></circle>
    </svg>
  `,

  heart: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.8 2.2Z"></path>
    </svg>
  `,

  heartFilled: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.8 2.2Z"></path>
    </svg>
  `,

  play: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z"></path>
    </svg>
  `,

  pause: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h4v14H6z"></path>
      <path d="M14 5h4v14h-4z"></path>
    </svg>
  `,

  plus: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `,

  back: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="15 5 8 12 15 19"></polyline>
    </svg>
  `,

  chevron: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="9 5 16 12 9 19"></polyline>
    </svg>
  `,

  home: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5"></path>
      <path d="M5.5 10.5V20h13v-9.5"></path>
      <path d="M9.5 20v-5h5v5"></path>
    </svg>
  `,

  shuffle: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="16 3 21 3 21 8"></polyline>
      <line x1="4" y1="20" x2="21" y2="3"></line>
      <polyline points="21 16 21 21 16 21"></polyline>
      <line x1="15" y1="15" x2="21" y2="21"></line>
      <line x1="4" y1="4" x2="10" y2="10"></line>
    </svg>
  `,

  repeatAll: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
      <polyline points="7 23 3 19 7 15"></polyline>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
    </svg>
  `,

  repeatOne: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
      <polyline points="7 23 3 19 7 15"></polyline>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
      <path d="M11 9.6 12.3 8.8v6.4"></path>
    </svg>
  `,

  previous: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="19 20 9 12 19 4 19 20"></polygon>
      <line x1="5" y1="19" x2="5" y2="5"></line>
    </svg>
  `,

  next: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="5 4 15 12 5 20 5 4"></polygon>
      <line x1="19" y1="5" x2="19" y2="19"></line>
    </svg>
  `,

  artist: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"></path>
    </svg>
  `,

  album: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3"></rect>
      <circle cx="12" cy="12" r="3"></circle>
      <circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"></circle>
    </svg>
  `,

  playlist: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4" y1="6" x2="14" y2="6"></line>
      <line x1="4" y1="11" x2="14" y2="11"></line>
      <line x1="4" y1="16" x2="10" y2="16"></line>
      <circle cx="18" cy="16.5" r="2.2"></circle>
      <path d="M20.2 16.5V6.5l-3 1"></path>
    </svg>
  `,

  dots: `
    <svg viewBox="0 0 24 24" aria-hidden="true" style="fill: currentColor; stroke: none;">
      <circle cx="5" cy="12" r="2"></circle>
      <circle cx="12" cy="12" r="2"></circle>
      <circle cx="19" cy="12" r="2"></circle>
    </svg>
  `
};

/* =========================================================
   API
   ========================================================= */

async function api(endpoint, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (state.userId) {
    headers["X-Telegram-User-Id"] = state.userId;
  }

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response =
    await fetch(`${API}${endpoint}`, {
      ...options,
      headers
    });

  let data;

  try {
    data = await response.json();
  } catch (_) {
    throw new Error("Invalid server response");
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/* =========================================================
   INIT
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupNavigation();
  setupSearch();
  setupPlayer();
  setupModals();
  setupHomeNavigation();
  setupSmartMix();
  setupSharePlaylist();

  renderHomeGreeting();

  // Must run before the other loads below so referral attribution
  // sees this as the very first request for a brand-new user (see
  // attributeReferral() server-side, which only fires on the exact
  // moment a user row is created).
  await resolveTelegramLaunchContext();

  await Promise.allSettled([
    loadSongs(),
    loadFavorites(),
    loadArtists(),
    loadAlbums(),
    loadPlaylists(),
    loadHomeInsights()
  ]);

  renderRecentSongs();
  renderHomeDashboard();
}

/* =========================================================
   TELEGRAM DEEP LINKS
   (shared playlist / referral launches. Extends the existing
   /start handling instead of replacing it — a normal launch
   with no payload behaves exactly as before.)
   ========================================================= */

function getStartParam() {
  // The native Direct Link mechanism (t.me/<bot>/<app>?startapp=)
  // populates this automatically when Telegram supports it.
  if (tg?.initDataUnsafe?.start_param) {
    return tg.initDataUnsafe.start_param;
  }

  // The classic bot deep link (t.me/<bot>?start=<payload>) goes
  // through the bot's /start handler, which replies with an "Open
  // White Playlist" button whose web_app URL carries the payload as
  // a plain query string — that's what we read here.
  const params = new URLSearchParams(window.location.search);
  return params.get("startapp") || params.get("tgWebAppStartParam");
}

async function resolveTelegramLaunchContext() {
  const payload = getStartParam();

  if (!payload) return;

  const playlistMatch = payload.match(
    /^playlist_([a-zA-Z0-9]+)$/
  );

  const shareToken = playlistMatch?.[1];

  if (!shareToken) return;

  if (state.userId) {
    try {
      // The referrer is resolved server-side from this same token
      // (playlist_shares.owner_user_id) — we never send any user
      // id, Telegram or otherwise, in this request or in the share
      // link itself.
      await api("/referral/attribute", {
        method: "POST",
        body: JSON.stringify({
          share_token: shareToken
        })
      });
    } catch (error) {
      // Non-fatal: referral tracking should never block app launch.
      console.error("Referral attribution:", error);
    }
  }

  openSharedPlaylist(shareToken);
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const page = button.dataset.page;

      if (page) {
        showPage(page);
      }
    });
  });

  document
    .getElementById("seeAllSongs")
    .addEventListener("click", () => showPage("songsPage"));

  document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.back);
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);

  if (page) {
    page.classList.add("active");
  }

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageId
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   HOME DASHBOARD
   (personalized Home page: greeting, continue listening,
   recently played, most played, top artists, playlists,
   favorites and picked-for-you — all built from real,
   already-existing user data. No fake data is generated
   anywhere in this section.)
   ========================================================= */

function setupHomeNavigation() {
  document
    .getElementById("seeAllHomePlaylists")
    ?.addEventListener("click", () => showPage("playlistsPage"));

  document
    .getElementById("seeAllHomeFavorites")
    ?.addEventListener("click", () => showPage("favoritesPage"));

  document
    .getElementById("homeSharePlaylistsPrompt")
    ?.addEventListener("click", () => showPage("playlistsPage"));
}

/* =========================================================
   SMART MIX
   (personalized queue, generated server-side from real
   recently_played/favorites/playlists/library data — see
   GET /smart-mix. Reuses the existing player/queue via
   playSong(), never a second player.)
   ========================================================= */

function setupSmartMix() {
  document
    .getElementById("smartMixButton")
    ?.addEventListener("click", generateSmartMix);
}

async function generateSmartMix() {
  const card = document.getElementById("smartMixButton");
  const playIcon = document.getElementById("smartMixPlay");

  if (card.classList.contains("loading")) return;

  card.classList.add("loading");
  playIcon.classList.add("spinning");

  try {
    const data = await api("/smart-mix");
    const songs = Array.isArray(data.songs) ? data.songs : [];

    if (!songs.length) {
      alert("Send a few songs to White Playlist first, then Smart Mix can build a queue for you.");
      return;
    }

    playSong(songs[0], songs);
    openFullPlayer();
  } catch (error) {
    console.error("Smart Mix:", error);
    alert(error.message || "Couldn't generate Smart Mix.");
  } finally {
    card.classList.remove("loading");
    playIcon.classList.remove("spinning");
  }
}

function renderHomeGreeting() {
  const el = document.getElementById("homeGreeting");
  if (!el) return;

  const hour = new Date().getHours();

  const timeGreeting =
    hour < 5 ? "Good night" :
    hour < 12 ? "Good morning" :
    hour < 18 ? "Good afternoon" :
    "Good evening";

  const firstName =
    tg?.initDataUnsafe?.user?.first_name || null;

  el.textContent =
    firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
}

// Fetches the data the redesigned Home page needs beyond what
// init() already loads. Uses the existing (previously unused by
// the frontend) GET /recently-played endpoint for real listening
// history, plus the new GET /recently-played/insights endpoint for
// aggregated Most Played / Top Artists — both derived from the
// existing recently_played table, no schema changes.
async function loadHomeInsights() {
  try {
    const [recentData, insightsData] = await Promise.all([
      api("/recently-played"),
      api("/recently-played/insights")
    ]);

    state.recentlyPlayed = recentData.songs || [];
    state.mostPlayed = insightsData.mostPlayed || [];
    state.topArtists = insightsData.topArtists || [];
  } catch (error) {
    console.error("Home insights:", error);

    state.recentlyPlayed = [];
    state.mostPlayed = [];
    state.topArtists = [];
  }
}

function renderHomeDashboard() {
  renderContinueListening();
  renderRecentlyPlayedHome();
  renderMostPlayed();
  renderTopArtists();
  renderHomePlaylists();
  renderHomeFavorites();
  renderHomeRecommendations();
}

function showHomeSection(sectionId, visible) {
  const section = document.getElementById(sectionId);
  if (section) section.classList.toggle("hidden", !visible);
}

// Small horizontal-card song renderer shared by Recently Played,
// Favorites and Picked For You. Reuses coverInnerHTML/escapeHTML
// exactly as songHTML() does, just a more compact layout.
function hcardHTML(song) {
  const title = song.title || "Unknown";
  const artist = song.artist || "Unknown Artist";

  return `
    <button
      class="hcard"
      data-action="play"
      data-id="${song.id}"
      aria-label="Play ${escapeHTML(title)}"
    >
      <div class="hcard-cover">
        ${coverInnerHTML(song.cover_url, title)}
      </div>
      <div class="hcard-title">${escapeHTML(title)}</div>
      <div class="hcard-meta">${escapeHTML(artist)}</div>
    </button>
  `;
}

function artistCoverInnerHTML(coverUrl, name) {
  if (!coverUrl) {
    return ICONS.artist;
  }

  return coverInnerHTML(coverUrl, name);
}

/* CONTINUE LISTENING — the single most recently played song. */
function renderContinueListening() {
  const container = document.getElementById("continueListeningCard");
  const song = state.recentlyPlayed[0];

  if (!container || !song) {
    showHomeSection("continueListeningSection", false);
    return;
  }

  const title = song.title || "Unknown";
  const artist = song.artist || "Unknown Artist";

  container.innerHTML = `
    <button
      class="continue-card"
      data-action="play"
      data-id="${song.id}"
      aria-label="Continue listening to ${escapeHTML(title)}"
    >
      <div class="continue-cover">
        ${coverInnerHTML(song.cover_url, title)}
      </div>

      <div class="continue-info">
        <div class="continue-label">Continue Listening</div>
        <div class="continue-title">${escapeHTML(title)}</div>
        <div class="continue-artist">${escapeHTML(artist)}</div>
      </div>

      <span class="continue-play" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
      </span>
    </button>
  `;

  bindSongButtons(container, state.recentlyPlayed);
  showHomeSection("continueListeningSection", true);
}

/* RECENTLY PLAYED — real listening history (skips the first item,
   already shown above in Continue Listening). */
function renderRecentlyPlayedHome() {
  const container = document.getElementById("recentlyPlayedList");
  if (!container) return;

  const songs = state.recentlyPlayed.slice(1, 11);

  if (!songs.length) {
    showHomeSection("recentlyPlayedSection", false);
    return;
  }

  container.innerHTML = songs.map(hcardHTML).join("");
  bindSongButtons(container, state.recentlyPlayed);
  showHomeSection("recentlyPlayedSection", true);
}

/* MOST PLAYED — ranked list from real aggregated play counts. */
function renderMostPlayed() {
  const container = document.getElementById("mostPlayedList");
  if (!container) return;

  const songs = state.mostPlayed.slice(0, 5);

  if (!songs.length) {
    showHomeSection("mostPlayedSection", false);
    return;
  }

  container.innerHTML = songs.map((song, index) => `
    <div class="song-item" data-song-id="${song.id}">
      <div class="rank-badge" aria-hidden="true">${index + 1}</div>

      <button
        class="song-cover"
        data-action="play"
        data-id="${song.id}"
        aria-label="Play ${escapeHTML(song.title || "song")}"
      >
        ${coverInnerHTML(song.cover_url, song.title)}
      </button>

      <button
        class="song-info"
        data-action="play"
        data-id="${song.id}"
        style="text-align:left"
      >
        <div class="song-title">
          ${escapeHTML(song.title || "Unknown")}
        </div>
        <div class="song-meta">
          ${escapeHTML(song.artist || "Unknown Artist")}
          •
          ${escapeHTML(song.album || "Unknown Album")}
        </div>
      </button>

      <div class="song-actions">
        <button
          class="song-menu-btn"
          data-action="menu"
          data-id="${song.id}"
          aria-label="More options"
        >
          ${ICONS.dots}
        </button>
      </div>
    </div>
  `).join("");

  bindSongButtons(container, state.mostPlayed);
  showHomeSection("mostPlayedSection", true);
}

/* TOP ARTISTS — real aggregated play counts, opens the existing
   Artist detail page (no second artist system). */
function renderTopArtists() {
  const container = document.getElementById("topArtistsList");
  if (!container) return;

  const artists = state.topArtists.slice(0, 6);

  if (!artists.length) {
    showHomeSection("topArtistsSection", false);
    return;
  }

  container.innerHTML = artists.map(artist => `
    <button
      class="artist-card"
      data-artist-id="${artist.id}"
      aria-label="Open ${escapeHTML(artist.name)}"
    >
      <div class="artist-card-cover">
        ${artistCoverInnerHTML(artist.cover_url, artist.name)}
      </div>
      <div class="artist-card-name">${escapeHTML(artist.name)}</div>
    </button>
  `).join("");

  container.querySelectorAll("[data-artist-id]").forEach(button => {
    button.addEventListener("click", () => {
      // Top Artists ids are the same opaque per-performer keys as
      // the Artists tab now — don't coerce to a number.
      openArtist(button.dataset.artistId);
    });
  });

  showHomeSection("topArtistsSection", true);
}

/* YOUR PLAYLISTS — reuses existing playlist ordering/data as-is,
   opens the existing Playlist detail page. */
function renderHomePlaylists() {
  const container = document.getElementById("homePlaylistsList");
  if (!container) return;

  const playlists = state.playlists.slice(0, 8);

  if (!playlists.length) {
    showHomeSection("homePlaylistsSection", false);
    return;
  }

  container.innerHTML = playlists.map(playlist => `
    <button
      class="playlist-card"
      data-playlist-id="${playlist.id}"
      aria-label="Open ${escapeHTML(playlist.name)}"
    >
      <div class="playlist-card-cover">
        ${playlist.cover_url ? coverInnerHTML(playlist.cover_url, playlist.name) : ICONS.playlist}
      </div>
      <div class="playlist-card-title">
        ${escapeHTML(playlist.name)}
      </div>
      <div class="playlist-card-meta">
        ${playlist.song_count || 0} songs
      </div>
    </button>
  `).join("");

  container.querySelectorAll("[data-playlist-id]").forEach(button => {
    button.addEventListener("click", () => {
      openPlaylist(Number(button.dataset.playlistId));
    });
  });

  showHomeSection("homePlaylistsSection", true);
}

/* YOUR FAVORITES — reuses existing favorites data. */
function renderHomeFavorites() {
  const container = document.getElementById("homeFavoritesList");
  if (!container) return;

  const songs = state.favorites.slice(0, 8);

  if (!songs.length) {
    showHomeSection("homeFavoritesSection", false);
    return;
  }

  container.innerHTML = songs.map(hcardHTML).join("");
  bindSongButtons(container, state.favorites);
  showHomeSection("homeFavoritesSection", true);
}

// Mirrors worker.js's ARTIST_NAME_DELIMITER/splitArtistNames — a raw
// credit string can pack multiple performers together ("A & B",
// "A feat. B"). Used only to check whether a given performer is one
// of them, e.g. matching a song's credit against a Top Artists entry
// that may union several raw credits.
const ARTIST_NAME_DELIMITER =
  /\s*(?:&|\+|,|\/|\bfeaturing\b|\bfeat\.?\b|\bft\.?\b|\bvs\.?\b|\bwith\b|\bx\b)\s*/gi;

function songCreditIncludesArtist(rawCredit, targetName) {
  if (!rawCredit || !targetName) return false;

  const target = String(targetName).trim().toLowerCase();

  return String(rawCredit)
    .split(ARTIST_NAME_DELIMITER)
    .map(part => part.trim().toLowerCase())
    .some(part => part === target);
}

/* PICKED FOR YOU — "Because You Listen To <top artist>", built
   only from real songs already in the library by the user's #1
   artist that haven't already shown up in Most Played / Recently
   Played. Hidden entirely when there isn't enough real data. */
function renderHomeRecommendations() {
  const container = document.getElementById("homeRecommendationsList");
  const titleEl = document.getElementById("homeRecommendationsTitle");
  if (!container || !titleEl) return;

  const topArtist = state.topArtists[0];

  if (!topArtist) {
    showHomeSection("homeRecommendationsSection", false);
    return;
  }

  const alreadySurfacedIds = new Set(
    [...state.mostPlayed, ...state.recentlyPlayed]
      .map(song => Number(song.id))
  );

  // topArtist.id is now an opaque per-performer key (it can union
  // several raw artist_id rows, e.g. solo credits plus features), so
  // songs can no longer be matched by comparing artist_id numbers.
  // Match by performer name instead — split on the same delimiters
  // the backend uses (see ARTIST_NAME_DELIMITER in worker.js) so a
  // song credited to "X feat. Y" still counts as one of X's songs.
  const songs = state.songs
    .filter(song =>
      songCreditIncludesArtist(song.artist, topArtist.name) &&
      !alreadySurfacedIds.has(Number(song.id))
    )
    .slice(0, 8);

  if (!songs.length) {
    showHomeSection("homeRecommendationsSection", false);
    return;
  }

  titleEl.textContent = `Because You Listen To ${topArtist.name}`;
  container.innerHTML = songs.map(hcardHTML).join("");
  bindSongButtons(container, songs);
  showHomeSection("homeRecommendationsSection", true);
}

/* =========================================================
   SONGS
   ========================================================= */

async function loadSongs() {
  try {
    const data = await api("/songs?limit=500");

    state.songs = data.songs || [];

    renderSongs();
    renderRecentSongs();
  } catch (error) {
    console.error("Songs:", error);

    showError("allSongs", "Couldn't load songs.");
    showError("recentSongs", "Couldn't load songs.");
  }
}

function renderSongs() {
  const container = document.getElementById("allSongs");

  if (!state.songs.length) {
    container.innerHTML = `<div class="empty">No songs yet.</div>`;
    return;
  }

  container.innerHTML = state.songs.map(songHTML).join("");
  bindSongButtons(container, state.songs);
}

function renderRecentSongs() {
  const container = document.getElementById("recentSongs");
  const songs = state.songs.slice(0, 10);

  if (!songs.length) {
    container.innerHTML =
      `<div class="empty">Send a song to White Playlist to get started.</div>`;
    return;
  }

  container.innerHTML = songs.map(songHTML).join("");
  bindSongButtons(container, songs);
}

function songHTML(song) {
  const liked =
    state.favorites.some(
      item => Number(item.id) === Number(song.id)
    );

  const artist = song.artist || "Unknown Artist";
  const album = song.album || "Unknown Album";
  const isInPlaylistDetail = song._playlistId !== undefined;

  return `
    <div class="song-item" data-song-id="${song.id}">

      <button
        class="song-cover"
        data-action="play"
        data-id="${song.id}"
        aria-label="Play ${escapeHTML(song.title || "song")}"
      >
        ${coverInnerHTML(song.cover_url, song.title)}
      </button>

      <button
        class="song-info"
        data-action="play"
        data-id="${song.id}"
        style="text-align:left"
      >
        <div class="song-title">
          ${escapeHTML(song.title || "Unknown")}
        </div>

        <div class="song-meta">
          ${escapeHTML(artist)}
          •
          ${escapeHTML(album)}
        </div>
      </button>

      <div class="song-actions">
        <button
          class="song-menu-btn"
          data-action="menu"
          data-id="${song.id}"
          aria-label="More options"
        >
          ${ICONS.dots}
        </button>
      </div>

    </div>
  `;
}

// songsList is the actual array of song objects backing the list
// currently rendered in `container` (e.g. state.songs, state.favorites,
// an artist's/album's/playlist's songs, or search results). It's used
// both to resolve the clicked song and, on play, as the queue context
// so playback stays within the list the user played from. menuContext
// describes that list for the ⋯ menu (e.g. { type: "playlist", playlistId }).
function bindSongButtons(container, songsList, menuContext = {}) {
  if (!container) return;

  const list = Array.isArray(songsList) ? songsList : state.songs;

  container.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.action;
      const id = Number(button.dataset.id);
      const song =
        list.find(item => Number(item.id) === id) ||
        findSong(id);

      if (!song) return;

      if (action === "play") playSong(song, list);
      if (action === "menu") openSongActionsMenu(song, menuContext);
    });
  });

  // Visual-only: every place that (re)builds a song list calls this,
  // so re-apply the currently-playing highlight here too — otherwise
  // any re-render (e.g. after favoriting) would silently drop it.
  highlightPlayingRow();
}

function findSong(id) {
  return state.songs.find(
    song => Number(song.id) === Number(id)
  );
}

/* =========================================================
   SONG ACTIONS MENU (⋯)
   ========================================================= */

let selectedSongForMenu = null;
let selectedSongMenuContext = null;

function openSongActionsMenu(song, context = {}) {
  if (!song) return;

  selectedSongForMenu = song;
  selectedSongMenuContext = context;

  const modal = document.getElementById("songActionsModal");
  const titleEl = document.getElementById("songActionsTitle");
  const favoriteBtn = document.getElementById("songActionFavorite");
  const favoriteLabel = document.getElementById("songActionFavoriteLabel");
  const deleteBtn = document.getElementById("songActionDelete");
  const removeFromPlaylistBtn = document.getElementById(
    "songActionRemoveFromPlaylist"
  );

  if (!modal || !titleEl || !favoriteBtn || !favoriteLabel) return;

  titleEl.textContent = song.title || "Song";

  const liked =
    state.favorites.some(
      item => Number(item.id) === Number(song.id)
    );

  favoriteLabel.textContent = liked ? "Unfavorite" : "Favorite";
  favoriteBtn.classList.toggle("active", liked);

  // The full player already has its own dedicated like/heart button,
  // so the ⋯ menu opened from there skips the redundant Favorite
  // entry. Every other ⋯ menu (song lists, playlists, search, etc.)
  // is unaffected — it only hides here when context.type === "player".
  favoriteBtn.classList.toggle("hidden", context?.type === "player");

  const isPlaylistContext = context?.type === "playlist";

  if (deleteBtn) {
    deleteBtn.classList.toggle("hidden", isPlaylistContext);
  }

  if (removeFromPlaylistBtn) {
    removeFromPlaylistBtn.classList.toggle(
      "hidden",
      !isPlaylistContext
    );
  }

  modal.classList.remove("hidden");
}

function closeSongActionsMenu() {
  document
    .getElementById("songActionsModal")
    ?.classList.add("hidden");

  selectedSongForMenu = null;
  selectedSongMenuContext = null;
}

/* =========================================================
   FAVORITES
   ========================================================= */

async function loadFavorites() {
  try {
    const data = await api("/favorites");

    state.favorites = data.favorites || [];

    renderFavoriteSongs();
  } catch (error) {
    console.error("Favorites:", error);
  }
}

function renderFavoriteSongs() {
  const container = document.getElementById("favoriteSongs");

  if (!state.favorites.length) {
    container.innerHTML =
      `<div class="empty">No favorite songs yet.</div>`;
    return;
  }

  container.innerHTML =
    state.favorites.map(songHTML).join("");

  bindSongButtons(container, state.favorites);
}

async function toggleFavorite(song) {
  const liked =
    state.favorites.some(
      item => Number(item.id) === Number(song.id)
    );

  try {
    if (liked) {
      await api("/favorites", {
        method: "DELETE",
        body: JSON.stringify({
          song_id: song.id
        })
      });
    } else {
      await api("/favorites", {
        method: "POST",
        body: JSON.stringify({
          song_id: song.id
        })
      });
    }

    await loadFavorites();

    renderSongs();
    renderRecentSongs();
    renderHomeFavorites();

    updatePlayerLike();
  } catch (error) {
    console.error("Favorite:", error);
    alert("Couldn't update favorite.");
  }
}

/* =========================================================
   ARTISTS
   ========================================================= */

async function loadArtists() {
  try {
    const data = await api("/artists?limit=500");

    state.artists = data.artists || [];

    renderArtists();
  } catch (error) {
    console.error("Artists:", error);
    showError("artistsList", "Couldn't load artists.");
  }
}

function renderArtists() {
  const container = document.getElementById("artistsList");

  if (!state.artists.length) {
    container.innerHTML =
      `<div class="empty">No artists yet.</div>`;
    return;
  }

  container.innerHTML =
    state.artists.map(artist => `
      <button
        class="library-item"
        data-artist-id="${escapeHTML(String(artist.id))}"
      >
        <div class="library-icon">
          ${artistCoverInnerHTML(artist.cover_url, artist.name)}
        </div>

        <div class="library-info">
          <div class="library-name">
            ${escapeHTML(artist.name)}
          </div>

          <div class="library-meta">
            ${artist.song_count || 0} songs
          </div>
        </div>

        <div class="library-arrow">
          ${ICONS.chevron}
        </div>
      </button>
    `).join("");

  container.querySelectorAll("[data-artist-id]").forEach(button => {
    button.addEventListener("click", () => {
      openArtist(button.dataset.artistId);
    });
  });
}

async function openArtist(id) {
  try {
    const data = await api(`/artists/${id}`);

    const artist = data.artist;
    const songs = data.songs || [];
    const container = document.getElementById("artistDetail");

    container.innerHTML = `
      <div class="detail-header artist-detail-header">
        <div class="artist-detail-cover">
          ${artistCoverInnerHTML(artist.cover_url, artist.name)}
        </div>

        <h1 class="detail-title">
          ${escapeHTML(artist.name)}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>
      </div>

      <div class="song-list">
        ${songs.map(songHTML).join("")}
      </div>
    `;

    bindSongButtons(container, songs);
    showPage("artistDetailPage");
  } catch (error) {
    console.error("Artist detail:", error);
  }
}

/* =========================================================
   ALBUMS
   ========================================================= */

async function loadAlbums() {
  try {
    const data = await api("/albums");

    state.albums = data.albums || [];

    renderAlbums();
  } catch (error) {
    console.error("Albums:", error);
    showError("albumsList", "Couldn't load albums.");
  }
}

function renderAlbums() {
  const container = document.getElementById("albumsList");

  if (!state.albums.length) {
    container.innerHTML =
      `<div class="empty">No albums yet.</div>`;
    return;
  }

  container.innerHTML =
    state.albums.map(album => `
      <button
        class="library-item"
        data-album-id="${album.id}"
      >
        <div class="library-icon">
          ${album.cover_url ? coverInnerHTML(album.cover_url, album.title) : ICONS.album}
        </div>

        <div class="library-info">
          <div class="library-name">
            ${escapeHTML(album.title)}
          </div>

          <div class="library-meta">
            ${escapeHTML(album.artist || "Unknown Artist")}
            •
            ${album.song_count || 0} songs
          </div>
        </div>

        <div class="library-arrow">
          ${ICONS.chevron}
        </div>
      </button>
    `).join("");

  container.querySelectorAll("[data-album-id]").forEach(button => {
    button.addEventListener("click", () => {
      // album.id is now an opaque key (like artist.id), not
      // necessarily numeric — don't coerce it.
      openAlbum(button.dataset.albumId);
    });
  });
}

async function openAlbum(id) {
  try {
    const data = await api(`/albums/${id}`);

    const album = data.album;
    const songs = data.songs || [];
    const container = document.getElementById("albumDetail");

    container.innerHTML = `
      <div class="detail-header">
        <h1 class="detail-title">
          ${escapeHTML(album.title)}
        </h1>

        <div class="detail-subtitle">
          ${escapeHTML(album.artist || "Unknown Artist")}
          •
          ${songs.length} songs
        </div>
      </div>

      <div class="song-list">
        ${songs.map(songHTML).join("")}
      </div>
    `;

    bindSongButtons(container, songs);
    showPage("albumDetailPage");
  } catch (error) {
    console.error("Album detail:", error);
  }
}

/* =========================================================
   PLAYLISTS
   ========================================================= */

async function loadPlaylists() {
  try {
    const data = await api("/playlists");

    state.playlists = data.playlists || [];

    renderPlaylists();
  } catch (error) {
    console.error("Playlists:", error);
    showError("playlistsList", "Couldn't load playlists.");
  }
}

function renderPlaylists() {
  const container = document.getElementById("playlistsList");

  if (!state.playlists.length) {
    container.innerHTML =
      `<div class="empty">Create your first playlist.</div>`;
    return;
  }

  container.innerHTML =
    state.playlists.map(playlist => `
      <div style="display: flex; align-items: center; gap: 8px;">
        <button
          class="library-item"
          style="flex: 1;"
          data-playlist-id="${playlist.id}"
        >
          <div class="library-icon">
            ${playlist.cover_url ? coverInnerHTML(playlist.cover_url, playlist.name) : ICONS.playlist}
          </div>

          <div class="library-info">
            <div class="library-name">
              ${escapeHTML(playlist.name)}
            </div>

            <div class="library-meta">
              ${playlist.song_count || 0} songs
            </div>
          </div>

          <div class="library-arrow">
            ${ICONS.chevron}
          </div>
        </button>

        <button
          class="playlist-delete-btn"
          data-delete-playlist-id="${playlist.id}"
          style="flex: 0 0 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: #777; background: none; border: none; cursor: pointer;"
          aria-label="Delete playlist"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; fill: none;">
            <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"></path>
          </svg>
        </button>
      </div>
    `).join("");

  container.querySelectorAll("[data-playlist-id]").forEach(button => {
    button.addEventListener("click", () => {
      openPlaylist(Number(button.dataset.playlistId));
    });
  });

  container.querySelectorAll(".playlist-delete-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const playlistId = Number(button.dataset.deletePlaylistId);
      const playlist = state.playlists.find(
        item => Number(item.id) === playlistId
      );

      if (!playlist) return;

      showConfirmationModal(
        "Delete Playlist",
        `Delete "${playlist.name || "Untitled Playlist"}"? Songs remain in your library.`,
        () => deletePlaylist(playlist)
      );
    });
  });
}

async function openPlaylist(id) {
  try {
    const data = await api(`/playlists/${id}/songs`);

    const playlist = data.playlist || {};
    const songs = Array.isArray(data.songs) ? data.songs : [];
    const container = document.getElementById("playlistDetail");

    const editBadge = `
      <span class="playlist-cover-picker-edit-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 20h4L18 10l-4-4L4 16v4z"></path>
          <path d="M13 7l4 4"></path>
        </svg>
      </span>
    `;

    container.innerHTML = `
      <div class="detail-header">
        <button
          type="button"
          class="playlist-detail-cover"
          id="playlistDetailCover"
          aria-label="Change playlist cover"
        >
          ${playlist.cover_url ? coverInnerHTML(playlist.cover_url, playlist.name) : ICONS.playlist}
          ${editBadge}
        </button>

        <h1 class="detail-title">
          ${escapeHTML(playlist.name || "Untitled Playlist")}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        id="playlistDetailCoverInput"
        class="hidden"
      >

      <div id="playlistShareBlock"></div>

      <div class="song-list">
        ${
          songs.length
            ? songs.map(song => {
                const songWithPlaylistId = {
                  ...song,
                  _playlistId: id
                };
                return songHTML(songWithPlaylistId);
              }).join("")
            : `<div class="empty">This playlist is empty.</div>`
        }
      </div>
    `;

    bindSongButtons(container, songs, {
      type: "playlist",
      playlistId: id
    });

    setupPlaylistDetailCoverPicker(id, container);

    showPage("playlistDetailPage");

    renderPlaylistShareBlock(id);
  } catch (error) {
    console.error("Playlist:", error);
    alert(error.message || "Couldn't load playlist.");
  }
}

// Wires the tap-to-change cover on the playlist detail header. Picks
// and compresses the image the same way the Create Playlist modal
// does, then uploads it immediately since the playlist already
// exists here (no separate "save" step to wait for).
function setupPlaylistDetailCoverPicker(playlistId, container) {
  const button = container.querySelector("#playlistDetailCover");
  const input = container.querySelector("#playlistDetailCoverInput");
  if (!button || !input) return;

  button.addEventListener("click", () => input.click());

  input.addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const dataUrl = await resizeImageToDataURL(file, 400, .82);

      await api(`/playlists/${playlistId}/cover`, {
        method: "POST",
        body: JSON.stringify({ image: dataUrl })
      });

      button.innerHTML = `
        ${coverInnerHTML(dataUrl, "Playlist cover")}
        <span class="playlist-cover-picker-edit-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 20h4L18 10l-4-4L4 16v4z"></path>
            <path d="M13 7l4 4"></path>
          </svg>
        </span>
      `;

      // Keep the Playlists list/home cards in sync without a full
      // reload of this page.
      await loadPlaylists();
    } catch (error) {
      console.error("Playlist cover:", error);
      alert("Couldn't update the cover. Try a different photo.");
    }
  });
}

/* =========================================================
   SHAREABLE PLAYLISTS + REFERRAL
   (owner-side controls live on the existing playlist detail
   page below; the recipient-side view is a separate page,
   sharedPlaylistPage, opened via a t.me deep link.)
   ========================================================= */

function setupSharePlaylist() {
  document
    .getElementById("saveSharedPlaylistBtn")
    ?.addEventListener("click", saveCurrentSharedPlaylist);
}

let currentSharedPlaylistToken = null;

// Fetches share status for `playlistId` and renders the
// Share/Manage controls into #playlistShareBlock. Kept separate
// from openPlaylist's main render so a failure here (e.g. the
// migration for this feature hasn't been run yet) can't break the
// rest of the playlist page — songs still load and play either way.
async function renderPlaylistShareBlock(playlistId) {
  const block = document.getElementById("playlistShareBlock");
  if (!block) return;

  block.innerHTML = `<div class="playlist-share-row"><span class="playlist-share-loading">Loading share status…</span></div>`;

  try {
    const data = await api(`/playlists/${playlistId}/share`);
    renderShareControls(block, playlistId, data);
  } catch (error) {
    console.error("Share status:", error);
    block.innerHTML = "";
  }
}

function renderShareControls(block, playlistId, status) {
  if (!status.is_shared) {
    block.innerHTML = `
      <div class="playlist-share-row">
        <button class="playlist-share-btn" id="playlistShareToggleBtn">
          🔗 Share Playlist
        </button>
      </div>
    `;

    document
      .getElementById("playlistShareToggleBtn")
      .addEventListener("click", () => togglePlaylistShare(playlistId, true));

    return;
  }

  block.innerHTML = `
    <div class="playlist-share-row playlist-share-row--active">
      <div class="playlist-share-label">✅ Shared</div>

      <div class="playlist-share-actions">
        <button class="playlist-share-action" id="playlistShareSendBtn">
          Share via Telegram
        </button>
        <button class="playlist-share-action" id="playlistShareCopyBtn">
          Copy Link
        </button>
        <button class="playlist-share-action playlist-share-action--danger" id="playlistShareStopBtn">
          Stop Sharing
        </button>
      </div>
    </div>
  `;

  document
    .getElementById("playlistShareSendBtn")
    .addEventListener("click", () => sendPlaylistShareViaTelegram(status.share_url));

  document
    .getElementById("playlistShareCopyBtn")
    .addEventListener("click", () => copyPlaylistShareLink(status.share_url));

  document
    .getElementById("playlistShareStopBtn")
    .addEventListener("click", () => {
      showConfirmationModal(
        "Stop Sharing",
        "The link will stop working. Your playlist itself is unaffected, and you can share it again anytime.",
        () => togglePlaylistShare(playlistId, false)
      );
    });
}

async function togglePlaylistShare(playlistId, share) {
  const block = document.getElementById("playlistShareBlock");

  try {
    const data = await api(`/playlists/${playlistId}/share`, {
      method: share ? "POST" : "DELETE"
    });

    if (block) {
      renderShareControls(block, playlistId, data);
    }

    if (share && data.share_url) {
      sendPlaylistShareViaTelegram(data.share_url);
    }
  } catch (error) {
    console.error("Share playlist:", error);
    alert(error.message || "Couldn't update sharing.");
  }
}

function sendPlaylistShareViaTelegram(url) {
  if (!url) return;

  const text = "🎧 Check out my playlist on White Playlist";

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    );
  } else {
    copyPlaylistShareLink(url);
  }
}

function copyPlaylistShareLink(url) {
  if (!url) return;

  navigator.clipboard
    ?.writeText(url)
    .then(() => alert("Link copied."))
    .catch(() => alert(url));
}

// Recipient side: view a playlist through its share token.
async function openSharedPlaylist(shareToken) {
  currentSharedPlaylistToken = shareToken;

  const container = document.getElementById("sharedPlaylistDetail");
  if (!container) return;

  container.innerHTML = `<div class="loading">Loading...</div>`;
  showPage("sharedPlaylistPage");

  try {
    const data = await api(`/shared/${shareToken}`);
    const playlist = data.playlist || {};
    const songs = Array.isArray(data.songs) ? data.songs : [];

    state.sharedPlaylistSongs = songs;

    container.innerHTML = `
      <div class="detail-header">
        <h1 class="detail-title">
          ${escapeHTML(playlist.name || "Shared Playlist")}
        </h1>

        <div class="detail-subtitle">
          Shared by ${escapeHTML(playlist.owner_name || "a White Playlist user")}
          •
          ${songs.length} songs
        </div>
      </div>

      ${
        playlist.is_owner
          ? ""
          : `<div class="playlist-share-row">
              <button class="playlist-share-btn" id="saveSharedPlaylistBtn">
                Save a Copy
              </button>
            </div>`
      }

      <div class="song-list">
        ${
          songs.length
            ? songs.map(sharedSongHTML).join("")
            : `<div class="empty">This playlist is empty.</div>`
        }
      </div>
    `;

    bindSharedSongButtons(container, songs);
    setupSharePlaylist();
  } catch (error) {
    console.error("Shared playlist:", error);
    container.innerHTML = `<div class="empty">${escapeHTML(error.message || "This playlist link is invalid or no longer shared.")}</div>`;
  }
}

// A trimmed-down variant of songHTML() with no ⋯ menu — favoriting
// or deleting a song you don't own doesn't apply here, and view+play
// is all the spec calls for on a shared playlist.
function sharedSongHTML(song) {
  const artist = song.artist || "Unknown Artist";
  const album = song.album || "Unknown Album";

  return `
    <div class="song-item" data-song-id="${song.id}">
      <button
        class="song-cover"
        data-action="play"
        data-id="${song.id}"
        aria-label="Play ${escapeHTML(song.title || "song")}"
      >
        ${coverInnerHTML(song.cover_url, song.title)}
      </button>

      <button
        class="song-info"
        data-action="play"
        data-id="${song.id}"
        style="text-align:left"
      >
        <div class="song-title">
          ${escapeHTML(song.title || "Unknown")}
        </div>

        <div class="song-meta">
          ${escapeHTML(artist)}
          •
          ${escapeHTML(album)}
        </div>
      </button>
    </div>
  `;
}

function bindSharedSongButtons(container, songs) {
  container.querySelectorAll("[data-action='play']").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(button.dataset.id);
      const song = songs.find(item => Number(item.id) === id);

      if (song) playSong(song, songs);
    });
  });
}

async function saveCurrentSharedPlaylist() {
  if (!currentSharedPlaylistToken) return;

  const btn = document.getElementById("saveSharedPlaylistBtn");
  if (btn) btn.disabled = true;

  try {
    const data = await api(`/shared/${currentSharedPlaylistToken}/save`, {
      method: "POST"
    });

    alert(
      data.already_saved
        ? "You already saved this playlist."
        : "Saved to your playlists."
    );

    loadPlaylists();
  } catch (error) {
    console.error("Save shared playlist:", error);
    alert(error.message || "Couldn't save this playlist.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function showConfirmationModal(title, message, onConfirm) {
  const modal = document.getElementById("confirmationModal");
  const titleEl = document.getElementById("confirmationTitle");
  const messageEl = document.getElementById("confirmationMessage");
  const confirmBtn = document.getElementById("confirmationConfirm");
  const cancelBtn = document.getElementById("confirmationCancel");

  if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    return;
  }

  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.classList.remove("hidden");

  const cleanup = () => {
    modal.classList.add("hidden");
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  const handleConfirm = () => {
    cleanup();
    onConfirm();
  };

  const handleCancel = () => {
    cleanup();
  };

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);
}

async function deleteSong(song) {
  if (!song?.id) return;

  const title = song.title || song.name || "Unknown";

  try {
    await api(`/songs/${song.id}`, {
      method: "DELETE"
    });

    if (
      state.currentSong &&
      Number(state.currentSong.id) === Number(song.id)
    ) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      state.currentSong = null;
      state.isPlaying = false;
      state.queue = [];
      state.queueIndex = -1;
      updatePlayButtons();
      miniPlayer?.classList.add("hidden");
    }

    await Promise.allSettled([
      loadSongs(),
      loadFavorites(),
      loadArtists(),
      loadAlbums(),
      loadPlaylists(),
      loadHomeInsights()
    ]);

    renderHomeDashboard();

    alert(`Deleted "${title}".`);
  } catch (error) {
    console.error("Delete song:", error);
    alert(error.message || "Couldn't delete song.");
  }
}

async function deleteAllSongs() {
  try {
    await api("/songs", {
      method: "DELETE"
    });

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.currentSong = null;
    state.isPlaying = false;
    state.queue = [];
    state.queueIndex = -1;
    updatePlayButtons();
    miniPlayer?.classList.add("hidden");

    await Promise.allSettled([
      loadSongs(),
      loadFavorites(),
      loadArtists(),
      loadAlbums(),
      loadPlaylists(),
      loadHomeInsights()
    ]);

    renderHomeDashboard();

    alert("All songs deleted.");
  } catch (error) {
    console.error("Delete all songs:", error);
    alert(error.message || "Couldn't delete all songs.");
  }
}

function forwardSong(song) {
  if (!song?.id) return;

  if (!tg || typeof tg.switchInlineQuery !== "function") {
    alert("Forwarding requires opening White Playlist from Telegram.");
    return;
  }

  // switchInlineQuery() hands off to Telegram's own native
  // recipient/chat picker — it does not open, close, or reload
  // the Mini App. The query text is the track's actual name (not
  // its Song ID); the Worker's inline handler searches only this
  // user's own library for matches and lets them pick the exact
  // track to send.
  const query =
    (song.title || "").trim();

  if (!query) {
    alert("Couldn't forward song.");
    return;
  }

  try {
    tg.switchInlineQuery(
      query,
      ["users", "groups", "channels"]
    );
  } catch (error) {
    console.error("Forward:", error);
    alert("Couldn't open Telegram sharing.");
  }
}

async function deletePlaylist(playlist) {
  if (!playlist?.id) return;

  const name = playlist.name || "Untitled Playlist";

  try {
    await api(`/playlists`, {
  method: "DELETE",
  body: JSON.stringify({
    playlist_id: playlist.id
  })
});

    await loadPlaylists();
    showPage("playlistsPage");
    alert(`Deleted "${name}". Songs remain in your library.`);
  } catch (error) {
    console.error("Delete playlist:", error);
    alert(error.message || "Couldn't delete playlist.");
  }
}

async function removeSongFromPlaylist(playlistId, songId) {
  if (!playlistId || !songId) return;

  try {
    await api(`/playlists/${playlistId}/songs`, {
  method: "DELETE",
  body: JSON.stringify({
    song_id: songId
  })
});

    await loadPlaylists();
    await openPlaylist(playlistId);
    alert("Removed from playlist.");
  } catch (error) {
    console.error("Remove from playlist:", error);
    alert(error.message || "Couldn't remove song.");
  }
}

function setupModals() {
  document
    .getElementById("createPlaylistButton")
    .addEventListener("click", () => {
      document.getElementById("playlistName").value = "";
      resetPlaylistCoverPicker();

      document
        .getElementById("playlistModal")
        .classList.remove("hidden");
    });

  document
    .getElementById("cancelPlaylist")
    .addEventListener("click", closePlaylistModal);

  document
    .getElementById("savePlaylist")
    .addEventListener("click", createPlaylist);

  document
    .getElementById("playlistCoverPicker")
    ?.addEventListener("click", () => {
      document.getElementById("playlistCoverInput")?.click();
    });

  document
    .getElementById("playlistCoverInput")
    ?.addEventListener("change", handlePlaylistCoverInputChange);

  document
    .getElementById("closeAddPlaylist")
    .addEventListener("click", () => {
      document
        .getElementById("addToPlaylistModal")
        .classList.add("hidden");
    });

  document
    .getElementById("closeSongActions")
    .addEventListener("click", closeSongActionsMenu);

  document
    .getElementById("songActionFavorite")
    .addEventListener("click", () => {
      const song = selectedSongForMenu;
      closeSongActionsMenu();
      if (song) toggleFavorite(song);
    });

  document
    .getElementById("songActionPlaylist")
    .addEventListener("click", () => {
      const song = selectedSongForMenu;
      closeSongActionsMenu();
      if (song) openAddToPlaylist(song);
    });

  document
    .getElementById("songActionDelete")
    .addEventListener("click", () => {
      const song = selectedSongForMenu;
      closeSongActionsMenu();

      if (!song) return;

      showConfirmationModal(
        "Delete Song",
        `Delete "${song.title || "Unknown"}"? This removes the song from your library.`,
        () => deleteSong(song)
      );
    });

  document
    .getElementById("songActionForward")
    .addEventListener("click", () => {
      const song = selectedSongForMenu;
      closeSongActionsMenu();
      if (song) forwardSong(song);
    });

  document
    .getElementById("songActionRemoveFromPlaylist")
    ?.addEventListener("click", () => {
      const song = selectedSongForMenu;
      const context = selectedSongMenuContext;
      closeSongActionsMenu();

      if (!song || context?.type !== "playlist" || !context.playlistId) {
        return;
      }

      showConfirmationModal(
        "Remove from Playlist",
        `Remove "${song.title || "this song"}" from this playlist? The song stays in your library.`,
        () => removeSongFromPlaylist(context.playlistId, song.id)
      );
    });

  document
    .getElementById("deleteAllSongsButton")
    ?.addEventListener("click", () => {
      if (!state.songs.length) return;

      showConfirmationModal(
        "Delete All Songs",
        "Delete all songs from your library? This cannot be undone and will remove them from playlists and favorites too.",
        () => deleteAllSongs()
      );
    });
}

// Holds the compressed cover image (as a data URL) the user picked
// in the Create Playlist modal, if any, until the playlist is saved.
let selectedPlaylistCoverDataURL = null;

function resetPlaylistCoverPicker() {
  selectedPlaylistCoverDataURL = null;

  const input = document.getElementById("playlistCoverInput");
  if (input) input.value = "";

  const preview = document.getElementById("playlistCoverPreview");
  if (preview) {
    preview.outerHTML = `
      <span id="playlistCoverPreview" class="playlist-cover-picker-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4"></rect>
          <circle cx="9.5" cy="10" r="1.6"></circle>
          <path d="M5 17l4.5-4.5a2 2 0 0 1 2.8 0L17 17"></path>
        </svg>
        <small>Add cover</small>
      </span>
    `;
  }
}

async function handlePlaylistCoverInputChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const dataUrl = await resizeImageToDataURL(file, 400, .82);
    selectedPlaylistCoverDataURL = dataUrl;

    const preview = document.getElementById("playlistCoverPreview");
    if (preview) {
      preview.outerHTML = `
        <img id="playlistCoverPreview" src="${dataUrl}" alt="Playlist cover" />
      `;
    }
  } catch (error) {
    console.error("Playlist cover:", error);
    alert("Couldn't use that image. Try a different photo.");
  }
}

// Resizes/compresses a picked image client-side (max square side
// `maxSize`, JPEG quality `quality`) before it's ever sent to the
// Worker — keeps the payload small and the D1 row lightweight.
function resizeImageToDataURL(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Couldn't read file"));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("Couldn't read image"));

      img.onload = () => {
        const scale = Math.min(
          1,
          maxSize / Math.max(img.width, img.height)
        );

        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function uploadPlaylistCover(playlistId, dataUrl) {
  try {
    await api(`/playlists/${playlistId}/cover`, {
      method: "POST",
      body: JSON.stringify({ image: dataUrl })
    });
  } catch (error) {
    // Non-fatal: the playlist itself was created successfully, only
    // the cover failed to attach. Surface it quietly in the console
    // rather than blocking playlist creation with an alert.
    console.error("Playlist cover upload:", error);
  }
}

function closePlaylistModal() {
  document
    .getElementById("playlistModal")
    .classList.add("hidden");
}

async function createPlaylist() {
  const input = document.getElementById("playlistName");
  const name = input.value.trim();

  if (!name) return;

  try {
    const data = await api("/playlists", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    if (selectedPlaylistCoverDataURL && data.playlist_id) {
      await uploadPlaylistCover(
        data.playlist_id,
        selectedPlaylistCoverDataURL
      );
    }

    closePlaylistModal();
    await loadPlaylists();
  } catch (error) {
    console.error("Create playlist:", error);
    alert(error.message);
  }
}

/* =========================================================
   ADD TO PLAYLIST
   ========================================================= */

let selectedSongForPlaylist = null;

async function openAddToPlaylist(song) {
  selectedSongForPlaylist = song;

  const modal =
    document.getElementById("addToPlaylistModal");

  const list =
    document.getElementById("addPlaylistList");

  list.innerHTML =
    `<div class="loading">Loading playlists...</div>`;

  modal.classList.remove("hidden");

  await loadPlaylists();

  if (!state.playlists.length) {
    list.innerHTML =
      `<div class="empty">Create a playlist first.</div>`;
    return;
  }

  list.innerHTML =
    state.playlists.map(playlist => `
      <button
        class="library-item"
        data-add-playlist-id="${playlist.id}"
      >
        <div class="library-icon">
          ${ICONS.plus}
        </div>

        <div class="library-info">
          <div class="library-name">
            ${escapeHTML(playlist.name)}
          </div>

          <div class="library-meta">
            ${playlist.song_count || 0} songs
          </div>
        </div>
      </button>
    `).join("");

  list.querySelectorAll("[data-add-playlist-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const playlistId =
        Number(button.dataset.addPlaylistId);

      try {
        await api(`/playlists/${playlistId}/songs`, {
          method: "POST",
          body: JSON.stringify({
            song_id: selectedSongForPlaylist.id
          })
        });

        modal.classList.add("hidden");
        await loadPlaylists();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

/* =========================================================
   PLAYER
   ========================================================= */

function setupPlayer() {
  updatePlaybackModeButton();
  setupLyricsResize();

  document
    .getElementById("miniPlayer")
    .addEventListener("click", event => {
      if (
        event.target.closest("#miniPlay") ||
        event.target.closest("#miniLike")
      ) {
        return;
      }

      openFullPlayer();
    });

  document
    .getElementById("miniPlay")
    .addEventListener("click", togglePlay);

  document
    .getElementById("miniLike")
    .addEventListener("click", () => {
      if (state.currentSong) {
        toggleFavorite(state.currentSong);
      }
    });

  document
    .getElementById("playerClose")
    .addEventListener("click", closeFullPlayer);

  document
    .getElementById("playerMenuButton")
    .addEventListener("click", () => {
      if (state.currentSong) {
        openSongActionsMenu(state.currentSong, { type: "player" });
      }
    });

  document
    .getElementById("mainPlay")
    .addEventListener("click", togglePlay);

  document
    .getElementById("playerLike")
    .addEventListener("click", () => {
      if (state.currentSong) {
        toggleFavorite(state.currentSong);
      }
    });

  document
    .getElementById("previousButton")
    .addEventListener("click", previousSong);

  document
    .getElementById("nextButton")
    .addEventListener("click", nextSong);

  document
    .getElementById("shuffleButton")
    .addEventListener("click", cyclePlaybackMode);

  document
    .getElementById("progress")
    .addEventListener("input", event => {
      setProgressFill(event.target.value);

      if (!audio.duration) return;

      audio.currentTime =
        (Number(event.target.value) / 100) *
        audio.duration;

      // Visual-only: repaint the already-cached waveform bars to
      // reflect the new position while scrubbing. Does not touch
      // audio playback or trigger any re-fetch/re-decode.
      redrawWaveformProgress();
    });

  audio.addEventListener("play", () => {
    state.isPlaying = true;
    updatePlayButtons();
    startWaveformAnim();
  });

  audio.addEventListener("pause", () => {
    state.isPlaying = false;
    updatePlayButtons();
    stopWaveformAnim();
  });

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateDuration);
  audio.addEventListener("ended", handleSongEnded);

  // Waveform canvas is sized off its own rendered box, so it needs a
  // repaint (not a recompute) whenever the layout changes.
  window.addEventListener("resize", redrawWaveformProgress);
}

// contextList is the list the song was selected from (e.g. the
// current Songs list, Favorites, an Artist's/Album's/Playlist's
// songs, or search results). The queue is built from that list so
// Next/Previous/Autoplay/Shuffle stay within it. When no contextList
// is given (e.g. resuming playback with no specific list in view),
// this falls back to the main Songs list, matching prior behavior.
function playSong(song, contextList) {
  const queueSource =
    Array.isArray(contextList) && contextList.length
      ? contextList
      : state.songs;

  state.queue = queueSource.slice();

  state.queueIndex =
    state.queue.findIndex(
      item => Number(item.id) === Number(song.id)
    );

  startPlayback(song);
}

// Actually starts/resumes audio playback for `song` without touching
// state.queue/state.queueIndex — used by playSong() above (after it
// sets up the queue) and by nextSong()/previousSong() (which advance
// queueIndex themselves and must keep the existing queue/context).
function startPlayback(song) {
  // If this exact song is already loaded on the <audio> element and
  // hasn't finished playing, just resume it instead of reassigning
  // audio.src — avoids discarding the current buffer/position and
  // re-requesting the audio from the Worker/Telegram unnecessarily.
  const expectedSrc =
    `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;

  const sameSongStillLoaded =
    state.currentSong &&
    Number(state.currentSong.id) === Number(song.id) &&
    audio.src === expectedSrc &&
    !audio.ended;

  if (sameSongStillLoaded) {
    if (audio.paused) {
      audio.play().catch(error => {
        console.error("Playback:", error);
      });
    }
    updatePlayerUI();
    return;
  }

  state.currentSong = song;

  audio.src = expectedSrc;

  audio.play().catch(error => {
    console.error("Playback:", error);
  });

  updatePlayerUI();

  api("/recently-played", {
    method: "POST",
    body: JSON.stringify({
      song_id: song.id
    })
  }).catch(console.error);
}

function togglePlay() {
  if (!state.currentSong) {
    if (state.songs.length) {
      playSong(state.songs[0]);
    }
    return;
  }

  if (audio.paused) {
    audio.play().catch(console.error);
  } else {
    audio.pause();
  }
}

// Single control cycling through three playback modes:
//   normal (repeat-all, the default) -> repeat-one -> shuffle -> normal
// state.shuffle and state.repeatOne stay mutually exclusive booleans
// so the existing `if (state.shuffle)` check in nextSong() keeps
// working unchanged.
function cyclePlaybackMode() {
  if (!state.shuffle && !state.repeatOne) {
    state.repeatOne = true;
  } else if (state.repeatOne) {
    state.repeatOne = false;
    state.shuffle = true;
  } else {
    state.shuffle = false;
  }

  updatePlaybackModeButton();
}

function updatePlaybackModeButton() {
  const button = document.getElementById("shuffleButton");
  if (!button) return;

  const mode =
    state.repeatOne ? "repeatOne" :
    state.shuffle ? "shuffle" :
    "normal";

  const icon =
    mode === "repeatOne" ? ICONS.repeatOne :
    mode === "shuffle" ? ICONS.shuffle :
    ICONS.repeatAll;

  button.innerHTML = icon;
  button.classList.toggle("active", mode !== "normal");
  button.setAttribute("aria-pressed", String(mode !== "normal"));
  button.setAttribute(
    "aria-label",
    mode === "repeatOne" ? "Repeat one" :
    mode === "shuffle" ? "Shuffle" :
    "Repeat all"
  );
}

// Same as nextSong(), except when repeat-one is active the current
// song simply plays again instead of advancing the queue.
function handleSongEnded() {
  if (state.repeatOne && state.currentSong) {
    audio.currentTime = 0;
    audio.play().catch(console.error);
    return;
  }

  nextSong();
}

function nextSong() {
  if (!state.queue.length) return;

  let nextIndex;

  if (state.shuffle) {
    nextIndex =
      Math.floor(Math.random() * state.queue.length);
  } else {
    nextIndex = state.queueIndex + 1;

    if (nextIndex >= state.queue.length) {
      nextIndex = 0;
    }
  }

  state.queueIndex = nextIndex;
  startPlayback(state.queue[nextIndex]);
}

function previousSong() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  if (!state.queue.length) return;

  let index = state.queueIndex - 1;

  if (index < 0) {
    index = state.queue.length - 1;
  }

  state.queueIndex = index;
  startPlayback(state.queue[index]);
}

// Updates the full-player title/artist immediately whenever the song
// identity changes. No fade/animation here on purpose — animating
// this text (fade out, swap, fade back in) visibly reads as
// flickering every time the song changes, so it's just a direct
// text swap now.
function setPlayerIdentityText(title, artist) {
  const titleEl = document.getElementById("playerTitle");
  const artistEl = document.getElementById("playerArtist");
  if (!titleEl || !artistEl) return;

  if (titleEl.textContent === title && artistEl.textContent === artist) {
    return; // already showing this song's identity — nothing to do
  }

  titleEl.textContent = title;
  artistEl.textContent = artist;
}

function updatePlayerUI() {
  if (!state.currentSong) return;

  const song = state.currentSong;

  const title = song.title || "Unknown";
  const artist = song.artist || "Unknown Artist";

  document.getElementById("miniTitle").textContent = title;
  document.getElementById("miniArtist").textContent = artist;
  setPlayerIdentityText(title, artist);

  setCoverArt(
    "miniCover",
    song.cover_url,
    title,
    "𝄞"
  );

  setCoverArt(
    "playerCover",
    song.cover_url,
    title,
    `<div class="player-cover-symbol" aria-hidden="true">𝄞</div>`
  );

  miniPlayer.classList.remove("hidden");

  updatePlayerLike();
  updatePlayButtons();
  highlightPlayingRow();

  // Each call below is internally deduped/cached per song, so it's
  // safe that updatePlayerUI() runs both on a brand-new song and on
  // a plain resume — none of these re-fetch or re-decode anything
  // that's already cached for this song.
  updatePlayerDynamicColor(song);
  loadWaveform(song);
  loadLyrics(song);
}

function updatePlayerLike() {
  if (!state.currentSong) return;

  const liked =
    state.favorites.some(
      item =>
        Number(item.id) ===
        Number(state.currentSong.id)
    );

  const miniLike = document.getElementById("miniLike");
  const playerLike = document.getElementById("playerLike");

  miniLike.innerHTML =
    liked ? ICONS.heartFilled : ICONS.heart;

  playerLike.innerHTML =
    liked ? ICONS.heartFilled : ICONS.heart;

  miniLike.classList.toggle("active", liked);
  playerLike.classList.toggle("active", liked);

  miniLike.setAttribute("aria-pressed", String(liked));
  playerLike.setAttribute("aria-pressed", String(liked));
}

function updatePlayButtons() {
  const mini = document.getElementById("miniPlay");
  const main = document.getElementById("mainPlay");

  if (mini) {
    mini.innerHTML =
      state.isPlaying ? ICONS.pause : ICONS.play;
  }

  if (main) {
    main.innerHTML =
      state.isPlaying ? ICONS.pause : ICONS.play;
  }

  // Visual-only hook (CSS reads this class for the subtle cover
  // animation + mini player state). Does not affect audio/state logic.
  document.body.classList.toggle("is-playing", state.isPlaying);
}

// Visual-only: marks whichever rendered song-item(s) match the
// current song with a "playing" class so the list can show a clear
// active state. Purely additive DOM styling — does not read from or
// write to any playback state, and never affects which songs are
// rendered or how lists are built.
function highlightPlayingRow() {
  document
    .querySelectorAll(".song-item.playing")
    .forEach(el => el.classList.remove("playing"));

  if (!state.currentSong) return;

  document
    .querySelectorAll(
      `.song-item[data-song-id="${state.currentSong.id}"]`
    )
    .forEach(el => el.classList.add("playing"));
}

function openFullPlayer() {
  playerOverlay.classList.remove("hidden");

  // The waveform canvas has zero size while the overlay is
  // display:none, so any draw that happened while it was closed was
  // a no-op — repaint now that it's actually laid out. Peaks are
  // already cached (or being generated) via loadWaveform(), so this
  // never re-fetches or re-decodes anything.
  redrawWaveformProgress();

  // .player-lyrics also has zero height while the overlay is
  // display:none, so fitLyricsText() couldn't measure it earlier —
  // refit now that it's actually laid out.
  fitLyricsText();

  // Lyrics may have already loaded while the player was closed (the
  // box had zero size then, so prewarmLyricsFontSizes() no-op'd) —
  // now that it's actually laid out, warm the rest of the lines in
  // the background so playback doesn't pay for it later.
  prewarmLyricsFontSizes(currentLyricsLines);
}

function closeFullPlayer() {
  playerOverlay.classList.add("hidden");
}

// Visual-only: paints the portion of the track already played.
// Does not read or change playback state.
function setProgressFill(percent) {
  const bar = document.getElementById("progress");
  if (bar) bar.style.setProperty("--fill", `${percent}%`);
}

function updateProgress() {
  if (!audio.duration) return;

  const percent =
    (audio.currentTime / audio.duration) * 100;

  document.getElementById("progress").value = percent;
  setProgressFill(percent);

  document.getElementById("currentTime").textContent =
    formatTime(audio.currentTime);

  // Both of these are cheap, cache-only repaints (no network, no
  // decoding, no recomputation) — they just reflect the currentTime
  // that this same "timeupdate" tick already gave us. Reusing this
  // existing listener instead of adding new "timeupdate" listeners.
  redrawWaveformProgress();
  updateLyricsSync();
}

function updateDuration() {
  document.getElementById("duration").textContent =
    formatTime(audio.duration);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);

  const remaining = Math.floor(seconds % 60);

  return (
    minutes +
    ":" +
    String(remaining).padStart(2, "0")
  );
}

/* =========================================================
   WAVEFORM
   ----------------------------------------------------------------
   Real amplitude bars decoded from the actual MP3 via the Web
   Audio API — never randomly generated. Fully decoupled from
   playback: it runs off a separate fetch() of the same audio URL
   (never touches audio.src / audio.play()), is generated
   asynchronously, and is cached per song (in-memory for this
   session, localStorage across sessions) so the same song is only
   ever downloaded/decoded once.
   ========================================================= */

const WAVEFORM_BAR_COUNT = 96;

// song.id -> Array<number> peaks (0..1), in-memory for this session
const waveformCache = new Map();

// Bumped on every loadWaveform() call so a slow decode for a song
// the user has since skipped past can never overwrite the bars for
// whatever song is actually playing now.
let waveformRequestToken = 0;

// Lazily created on first use (always inside a user-gesture-derived
// call path, e.g. playSong()/togglePlay()), and reused for every
// song afterward — never a second AudioContext.
let waveformAudioCtx = null;

let lastWaveformPeaks = null;

function waveformStorageKey(songId) {
  return `wp_wave_${songId}`;
}

function loadWaveformFromStorage(songId) {
  try {
    const raw = localStorage.getItem(waveformStorageKey(songId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(v => v / 100)
      : null;
  } catch (_) {
    return null;
  }
}

// Stores peaks compactly (0-100 ints) and keeps a small LRU index so
// this never grows unbounded across many different songs.
function saveWaveformToStorage(songId, peaks) {
  try {
    const compact = peaks.map(v => Math.round(v * 100));
    localStorage.setItem(
      waveformStorageKey(songId),
      JSON.stringify(compact)
    );

    const indexRaw = localStorage.getItem("wp_wave_index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const next = index.filter(id => id !== songId);
    next.push(songId);

    while (next.length > 40) {
      const evictId = next.shift();
      localStorage.removeItem(waveformStorageKey(evictId));
    }

    localStorage.setItem("wp_wave_index", JSON.stringify(next));
  } catch (_) {
    // Storage full/unavailable/private-mode — the waveform simply
    // won't persist across sessions. Playback and the in-memory
    // cache for the current session are unaffected either way.
  }
}

function setWaveformState(stateName) {
  const canvas = document.getElementById("waveformCanvas");
  if (canvas) canvas.dataset.state = stateName;
}

// Generates (or retrieves already-cached) amplitude peaks for
// `song`, then draws them. This is the only entry point that ever
// fetches/decodes the MP3 for waveform purposes, and it always
// checks the cache first — a song already played once this session
// (or on a previous visit, via localStorage) never triggers a
// second fetch or decode.
function loadWaveform(song) {
  if (!song || song.id == null) return;

  const token = ++waveformRequestToken;

  const memCached = waveformCache.get(song.id);
  if (memCached) {
    drawWaveform(memCached);
    setWaveformState("ready");
    return;
  }

  const stored = loadWaveformFromStorage(song.id);
  if (stored && stored.length) {
    waveformCache.set(song.id, stored);
    drawWaveform(stored);
    setWaveformState("ready");
    return;
  }

  setWaveformState("loading");
  drawWaveform(null); // clear any previous song's bars immediately

  const audioUrl =
    `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;

  // fetchPriority "low" (where supported) so this never competes
  // with the <audio> element's own request for bandwidth on the
  // song that's actually about to play.
  fetch(audioUrl, { priority: "low" })
    .then(res => {
      if (!res.ok) throw new Error(`Waveform fetch failed (${res.status})`);
      return res.arrayBuffer();
    })
    .then(buffer => {
      if (token !== waveformRequestToken) return null; // superseded

      if (!waveformAudioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error("Web Audio API unsupported");
        waveformAudioCtx = new Ctx();
      }

      return waveformAudioCtx.decodeAudioData(buffer);
    })
    .then(audioBuffer => {
      if (!audioBuffer || token !== waveformRequestToken) return;

      const peaks = computeWaveformPeaks(audioBuffer, WAVEFORM_BAR_COUNT);

      waveformCache.set(song.id, peaks);
      saveWaveformToStorage(song.id, peaks);

      if (token === waveformRequestToken) {
        drawWaveform(peaks);
        setWaveformState("ready");
      }
    })
    .catch(error => {
      console.error("Waveform:", error);
      if (token === waveformRequestToken) {
        setWaveformState("unavailable");
      }
    });
}

// Downsamples channel 0 into `barCount` peak values (0..1) using the
// max sample magnitude per bucket — this is what gives a waveform
// its real jagged look, unlike an averaged/smoothed curve.
function computeWaveformPeaks(audioBuffer, barCount) {
  const channel = audioBuffer.getChannelData(0);
  const samplesPerBar = Math.max(1, Math.floor(channel.length / barCount));

  // For long tracks, samplesPerBar can be in the hundreds of
  // thousands — scanning every sample in every bucket is what makes
  // this block the main thread (felt as lag right when a song
  // starts). A stride caps how many samples we actually look at per
  // bar, independent of track length, while still taking the max
  // within the bucket, so the shape stays the same.
  const stride = Math.max(1, Math.floor(samplesPerBar / 300));

  const peaks = new Array(barCount).fill(0);

  for (let bar = 0; bar < barCount; bar++) {
    const start = bar * samplesPerBar;
    const end = Math.min(start + samplesPerBar, channel.length);

    let max = 0;
    for (let i = start; i < end; i += stride) {
      const v = Math.abs(channel[i]);
      if (v > max) max = v;
    }

    peaks[bar] = max;
  }

  const loudest = Math.max(...peaks, 0.0001);
  return peaks.map(v => Math.min(1, v / loudest));
}

// Paints the bars. Cheap enough to call on every timeupdate tick —
// it never recomputes peaks, only repaints already-known numbers.
function drawWaveform(peaks) {
  lastWaveformPeaks = peaks;

  const canvas = document.getElementById("waveformCanvas");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!peaks || !peaks.length) return;

  const percent =
    audio.duration
      ? (audio.currentTime / audio.duration) * 100
      : 0;

  const barCount = peaks.length;
  const gap = 1.5 * dpr;
  const barWidth =
    Math.max(1, (canvas.width - gap * (barCount - 1)) / barCount);
  const activeBars = Math.round((percent / 100) * barCount);
  const midY = canvas.height / 2;

  for (let i = 0; i < barCount; i++) {
    const amp = Math.max(0.06, peaks[i]);
    const barHeight = amp * canvas.height;
    const x = i * (barWidth + gap);

    // Unplayed bars stay a neutral, colorless gray; once a bar has
    // been played it switches to the song's own dominant cover
    // color (waveformActiveColor, kept in sync with the player's
    // glow — see updatePlayerDynamicColor()), falling back to plain
    // white for covers with no extractable color.
    ctx.fillStyle =
      i < activeBars
        ? waveformActiveColor
        : "rgba(255,255,255,.16)";

    drawRoundedBar(ctx, x, midY - barHeight / 2, barWidth, barHeight, barWidth / 2);
  }
}

// Pill-shaped bar (fully rounded ends) instead of a hard-edged
// rectangle — purely visual, same position/size math as before.
function drawRoundedBar(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  if (r <= 0) {
    ctx.fillRect(x, y, width, height);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fill();
}

// Called from the existing "timeupdate"/"input" handling — no new
// listeners. Purely a repaint of already-cached peaks.
function redrawWaveformProgress() {
  if (lastWaveformPeaks) {
    drawWaveform(lastWaveformPeaks);
  }
}

// "timeupdate" only fires a handful of times per second, which made
// the played/unplayed split on the waveform visibly jump instead of
// moving smoothly. This repaints on every animation frame while
// audio is actually playing (still just a cheap repaint of already
// computed peaks, no recompute), and stops as soon as it's not.
let waveformAnimFrame = null;

function startWaveformAnim() {
  if (waveformAnimFrame) return;
  const tick = () => {
    redrawWaveformProgress();
    waveformAnimFrame = requestAnimationFrame(tick);
  };
  waveformAnimFrame = requestAnimationFrame(tick);
}

function stopWaveformAnim() {
  if (waveformAnimFrame) {
    cancelAnimationFrame(waveformAnimFrame);
    waveformAnimFrame = null;
  }
}

/* =========================================================
   DYNAMIC PLAYER COLORS
   ----------------------------------------------------------------
   Extracts a dominant color from the current song's cover and uses
   it only for the player's ambient glow (--player-glow /
   --player-glow-soft — see style.css), never for --accent, so
   text/icon contrast is untouched. Runs once per song/cover change
   only — never on timeupdate — and is cached per song.
   ========================================================= */

// song.id -> { glow, glowSoft, wave }
const playerGlowCache = new Map();
let lastGlowCoverUrl = undefined;

// Solid color the waveform's played bars use — kept in step with
// the player's ambient glow above so the whole player reads as one
// per-song color, defaulting to plain white until a cover color has
// been extracted (see applyPlayerGlow() / resetPlayerGlow()).
let waveformActiveColor = "rgba(255,255,255,.92)";

function updatePlayerDynamicColor(song) {
  if (!song) return;

  const coverUrl = song.cover_url || null;

  if (coverUrl === lastGlowCoverUrl) return; // nothing changed
  lastGlowCoverUrl = coverUrl;

  if (!coverUrl) {
    resetPlayerGlow();
    return;
  }

  const cached = playerGlowCache.get(song.id);
  if (cached) {
    applyPlayerGlow(cached);
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    // If the player has since moved to a different cover, this
    // result is stale — drop it rather than flash the wrong color.
    if (lastGlowCoverUrl !== coverUrl) return;

    try {
      const glow = extractDominantColor(img);
      playerGlowCache.set(song.id, glow);
      applyPlayerGlow(glow);
    } catch (error) {
      console.error("Dynamic color:", error);
    }
  };

  img.onerror = () => {
    // Cover failed to load for color purposes — leave the default
    // glow in place, exactly as if no cover_url existed.
  };

  img.src = coverUrl;
}

// Samples a small downscaled copy of the cover and buckets pixels
// into coarse RGB bins, picking the most common bin (a real
// "dominant color" pass rather than a flat average, so a high-
// contrast cover doesn't just wash out to gray).
function extractDominantColor(img) {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map();
  let sumR = 0, sumG = 0, sumB = 0, counted = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue; // skip transparent pixels

    const r = data[i], g = data[i + 1], b = data[i + 2];

    // Skip near-black/near-white pixels — they rarely represent a
    // song's "color" and would otherwise dominate the bucket count
    // on covers with large dark or light backgrounds.
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 30 || min > 225) continue;

    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
    entry.r += r; entry.g += g; entry.b += b; entry.count++;
    buckets.set(key, entry);

    sumR += r; sumG += g; sumB += b; counted++;
  }

  let best = null;
  for (const entry of buckets.values()) {
    if (!best || entry.count > best.count) best = entry;
  }

  let r, g, b;
  if (best) {
    r = Math.round(best.r / best.count);
    g = Math.round(best.g / best.count);
    b = Math.round(best.b / best.count);
  } else if (counted) {
    r = Math.round(sumR / counted);
    g = Math.round(sumG / counted);
    b = Math.round(sumB / counted);
  } else {
    // Cover was effectively all near-black/near-white — fall back
    // to the app's original lavender-white accent tone.
    r = 178; g = 160; b = 219;
  }

  return {
    glow: `rgba(${r}, ${g}, ${b}, .55)`,
    glowSoft: `rgba(${r}, ${g}, ${b}, .18)`,
    wave: `rgba(${r}, ${g}, ${b}, .95)`
  };
}

function applyPlayerGlow(colorPair) {
  document.documentElement.style.setProperty("--player-glow", colorPair.glow);
  document.documentElement.style.setProperty("--player-glow-soft", colorPair.glowSoft);
  waveformActiveColor = colorPair.wave || "rgba(255,255,255,.92)";
  redrawWaveformProgress();
}

function resetPlayerGlow() {
  document.documentElement.style.removeProperty("--player-glow");
  document.documentElement.style.removeProperty("--player-glow-soft");
  waveformActiveColor = "rgba(255,255,255,.92)";
  redrawWaveformProgress();
}

/* =========================================================
   LYRICS
   ----------------------------------------------------------------
   Real, timestamped lyrics from LRCLIB (free, no API key, CORS-
   open) matched by artist + track title. Never invents lyrics or
   timestamps: a track with no synced-lyrics match is shown as
   clearly unavailable rather than guessed.
   ========================================================= */

const LYRICS_API = "https://lrclib.net/api";

// song.id -> { lines, unavailable, instrumental? }
const lyricsCache = new Map();

let lyricsRequestToken = 0;
let activeLyricsLineIndex = -1;

// The synced lines for whatever song is currently loaded — kept as
// its own array (rather than re-reading lyricsCache each tick) so
// updateLyricsSync()/renderLyricsLine() have a simple, always-current
// reference. Populated by buildLyricsList(), cleared when a song has
// no usable lyrics.
let currentLyricsLines = [];

// Bounds for fitLyricsText()'s auto-sizing: short lines render up
// near the max, long lines shrink toward the min instead of ever
// overflowing or horizontally scrolling.
const LYRICS_FONT_MIN = 17;
const LYRICS_FONT_MAX = 34;

function lyricsStorageKey(songId) {
  return `wp_lrc_${songId}`;
}

// Mirrors saveWaveformToStorage()'s small LRU index so lyrics text
// (a few KB per song) doesn't grow localStorage unbounded either.
function saveLyricsToStorage(songId, result) {
  try {
    localStorage.setItem(
      lyricsStorageKey(songId),
      JSON.stringify(result)
    );

    const indexRaw = localStorage.getItem("wp_lrc_index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const next = index.filter(id => id !== songId);
    next.push(songId);

    while (next.length > 40) {
      const evictId = next.shift();
      localStorage.removeItem(lyricsStorageKey(evictId));
    }

    localStorage.setItem("wp_lrc_index", JSON.stringify(next));
  } catch (_) {
    // Storage full/unavailable — lyrics just won't persist across
    // sessions; the in-memory cache for this session is unaffected.
  }
}

// Fetches (or retrieves cached) lyrics for `song` and renders them
// into the inline player lyrics ticker. Called whenever the full
// player loads a song (see updatePlayerUI()), since the ticker is
// always part of the player layout now — no panel to open.
function loadLyrics(song) {
  if (!song || song.id == null) return;

  const token = ++lyricsRequestToken;
  const track = document.getElementById("playerLyricsTrack");
  if (!track) return;

  activeLyricsLineIndex = -1;
  currentLyricsLines = [];

  const cached = lyricsCache.get(song.id);
  if (cached) {
    buildLyricsList(cached);
    return;
  }

  let stored = null;
  try {
    const raw = localStorage.getItem(lyricsStorageKey(song.id));
    stored = raw ? JSON.parse(raw) : null;
  } catch (_) {
    stored = null;
  }

  if (stored) {
    lyricsCache.set(song.id, stored);
    buildLyricsList(stored);
    return;
  }

  track.innerHTML = `<div class="player-lyrics-status">Loading lyrics…</div>`;

  fetchLyricsFromLRCLIB(song)
    .then(result => {
      if (token !== lyricsRequestToken) return; // song changed meanwhile

      lyricsCache.set(song.id, result);
      saveLyricsToStorage(song.id, result);

      buildLyricsList(result);
    })
    .catch(error => {
      console.error("Lyrics:", error);
      if (token !== lyricsRequestToken) return;

      const result = { lines: [], unavailable: true };
      lyricsCache.set(song.id, result);
      buildLyricsList(result);
    });
}

// Queries LRCLIB by artist + track title (and duration, when known,
// to disambiguate covers/remixes). Tries the exact-match endpoint
// first, then falls back to search and picks the closest duration
// match. Never fabricates a result — any failure/empty response
// resolves to { lines: [], unavailable: true }.
async function fetchLyricsFromLRCLIB(song) {
  const title = (song.title || "").trim();
  const artist = (song.artist || "").trim();

  if (!title || !artist) {
    return { lines: [], unavailable: true };
  }

  const getParams = new URLSearchParams({
    track_name: title,
    artist_name: artist
  });

  if (song.duration) {
    getParams.set("duration", String(Math.round(song.duration)));
  }

  try {
    const res = await fetch(`${LYRICS_API}/get?${getParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseLyricsResponse(data);
      if (parsed) return parsed;
    }
  } catch (_) {
    // fall through to search
  }

  try {
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist
    });

    const res = await fetch(`${LYRICS_API}/search?${searchParams.toString()}`);
    if (!res.ok) return { lines: [], unavailable: true };

    const results = await res.json();
    if (!Array.isArray(results) || !results.length) {
      return { lines: [], unavailable: true };
    }

    const withSync = results.filter(r => r.syncedLyrics);
    const candidates = withSync.length ? withSync : results;

    let best = candidates[0];
    if (song.duration) {
      let bestDiff = Infinity;
      for (const candidate of candidates) {
        const diff = Math.abs((candidate.duration || 0) - song.duration);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = candidate;
        }
      }
    }

    return parseLyricsResponse(best) || { lines: [], unavailable: true };
  } catch (_) {
    return { lines: [], unavailable: true };
  }
}

// Turns one LRCLIB record into { lines, unavailable, instrumental? }.
// Plain-only lyrics (no syncedLyrics) are treated as unavailable for
// sync purposes rather than displayed with guessed timestamps.
function parseLyricsResponse(data) {
  if (!data) return null;

  if (data.instrumental) {
    return { lines: [], unavailable: true, instrumental: true };
  }

  if (!data.syncedLyrics) return null;

  const lines = parseLRC(data.syncedLyrics);
  if (!lines.length) return null;

  return { lines, unavailable: false };
}

// Parses standard/enhanced LRC text into an ordered array of
// { time, text, words } — words is null unless the source actually
// included per-word <mm:ss.xx> tags (karaoke-style), so word
// highlighting only ever appears where real word timing exists.
function parseLRC(lrcText) {
  const lines = [];
  const rawLines = lrcText.split("\n");

  const lineTimeRe = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
  const wordTimeRe = /<(\d+):(\d+(?:\.\d+)?)>/g;

  for (const rawLine of rawLines) {
    const timestamps = [...rawLine.matchAll(lineTimeRe)];
    if (!timestamps.length) continue;

    let content = rawLine.replace(lineTimeRe, "").trim();

    let words = null;
    wordTimeRe.lastIndex = 0;
    if (wordTimeRe.test(content)) {
      wordTimeRe.lastIndex = 0;
      words = [];

      const parts = content.split(wordTimeRe);
      // parts alternates: [textBefore, min, sec, textBefore, min, sec, ...]
      for (let i = 1; i < parts.length; i += 3) {
        const min = Number(parts[i]);
        const sec = Number(parts[i + 1]);
        const text = (parts[i + 2] || "").trim();
        if (text) {
          words.push({ time: min * 60 + sec, text });
        }
      }

      content = content.replace(wordTimeRe, "").trim();
    }

    for (const match of timestamps) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      lines.push({
        time: min * 60 + sec,
        text: content,
        words
      });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

// Stores the synced lines for `result` (called once per song load —
// see loadLyrics()) and renders whichever line is currently active,
// if any is already known (e.g. rebuilt mid-playback). Unlike the
// old design, the full list is never mounted in the DOM at once —
// only the single active line is ever rendered (see
// renderLyricsLine()), swapped in as playback crosses each synced
// timestamp (see updateLyricsSync()).
// Persian/Arabic (and Hebrew) script ranges — used to detect
// right-to-left lyrics so they read in the correct direction instead
// of always laying out left-to-right.
const RTL_TEXT_RE = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

// KEYWORD VIBE COLORING — a curated word list per language.
// classifyWordVibe()/LYRICS_COLOR_WORDS strip punctuation/case and
// check the word against these; matches get tinted red (dark/
// negative — death, drugs, profanity, hate...), green (hopeful/
// positive), or — for a literal color name — that exact color, via
// .player-lyrics-word--negative/--positive or an inline style in
// renderLyricsLine(). Most words stay plain white; only matches get
// colored.
const LYRICS_NEGATIVE_WORDS = new Set([
  // English — hate / dark feelings
  "hate","pain","broken","hurt","scar","scars","scared","fear",
  "afraid","dark","darkness","evil","demon","devil","enemy","enemies",
  "betray","betrayal","lie","lies","liar","war","fight","grave",
  "curse","cursed","rage","angry","anger","sad","sadness","sorrow",
  "misery","suffer","suffering","wound","wounds","nightmare","hell",
  "sin","shame","regret","loss","lost","cold","empty","void","scream",
  "venom","toxic","ashes","ruin","ruined","destroy","destroyed",
  "grief","mourn","revenge","hopeless","trap","trapped","chains",
  "prison","drown","drowning","numb","fake","cry","crying","tears",
  "alone","lonely","blood","bleed","bleeding","burn","burning",
  // English — death / killing (every common conjugation)
  "die","died","dies","dying","kill","kills","killed","killing",
  "killer","murder","murders","murdered","murderer","murdering",
  "suicide","corpse","coffin","funeral","graveyard","deadly","lethal",
  "execute","executed","execution","slain","slay","slays","slaughter",
  "massacre","homicide","fatal","perish","perished","death","dead",
  "gun","knife","stab","stabbed","shot","shoot","shooting","choke",
  "choked","strangle","strangled","bury","buried",
  // English — drugs / pills
  "pill","pills","drug","drugs","xanax","molly","cocaine","coke",
  "heroin","weed","meth","overdose","addict","addicted","addiction",
  "syringe","needle","dope","narcotic","opioid","high","stoned",
  // English — common profanity
  "fuck","fucking","fucked","fucker","shit","bitch","ass","asshole",
  "damn","bastard","slut","whore","dick","pussy","crap","hoe",
  // Persian — hate / dark feelings
  "کینه","بغض","نفرت","درد","خون","گریه","اشک","غم","غمگین","تنها",
  "تنهایی","شکسته","زخم","ترس","تاریک","تاریکی","شیطان","دشمن",
  "خیانت","دروغ","جنگ","اسلحه","چاقو","قبر","زهر","نفرین","خشم",
  "عصبانی","غصه","رنج","کابوس","جهنم","گناه","شرم","پشیمون",
  "پشیمان","خالی","جیغ","سم","ویرانی","نابود","عزا","انتقام",
  "زندان","زنجیر","دود","سوختن","خفه","پوچ","دروغی",
  // Persian — death / killing (all the conjugations that come up)
  "مرگ","مردن","مردم","مردی","مرد","مردیم","مردید","مردند",
  "می‌میرم","می‌میری","می‌میره","می‌میریم","می‌میرید","می‌میرند",
  "میمیرم","میمیری","میمیره","میمیریم","میمیرید","میمیرند",
  "نمی‌میرم","نمی‌میری","نمی‌میره","نمی‌میریم","نمی‌میرید","نمی‌میرند",
  "نمیمیرم","نمیمیری","نمیمیره","نمیمیریم","نمیمیرید","نمیمیرند",
  "بمیرم","بمیری","بمیره","بمیریم","بمیرید","بمیرند","بمیر",
  "مرده","مردگان","کشتن","کشتم","کشتی","کشت","کشتیم","کشتید",
  "کشتند","کشتمت","کشتمش","کشتنش","می‌کشمت","میکشمت",
  "می‌کشم","می‌کشی","می‌کشه","می‌کشیم","می‌کشید","می‌کشند",
  "میکشم","میکشی","میکشه","میکشیم","میکشید","میکشند",
  "بکشم","بکشی","بکشه","بکشیم","بکشید","بکشند","بکش","بکشمت",
  "کشته","قتل","قاتل","کشتار","خودکشی","جسد","تابوت","گورستان",
  "قتل‌عام","اعدام",
  // Persian — drugs / pills
  "قرص","قرصا","قرص‌ها","مواد","موادمخدر","هروئین","تریاک",
  "کوکائین","حشیش","شیشه","ماری‌جوانا","علف","دوپ","اوردوز",
  "معتاد","اعتیاد","سرنگ","تزریق","نئشه","مسکن","مخدر",
  // Persian — common profanity
  "کیری","کص","کس‌کش","کسکش","جنده","عوضی","لعنتی","کثافت",
  "آشغال","حروم‌زاده","حرومی","گوه","کونی","مادرجنده","ننه‌جنده",
  "هرزه",
]);

const LYRICS_POSITIVE_WORDS = new Set([
  // English
  "love","loved","loving","hope","hopeful","light","joy","joyful",
  "happy","happiness","smile","shine","shining","free","freedom",
  "peace","heal","healing","healed","dream","dreams","beautiful",
  "blessed","bless","grace","faith","trust","warm","warmth","home",
  "family","friend","friends","together","forever","rise","rising",
  "alive","life","soul","star","stars","sun","sunshine","bright",
  "glow","glory","victory","win","winning","strong","strength",
  "heaven","angel","sweet","kind","kindness","gentle","safe","calm",
  "proud","grateful","gratitude","beauty","magic","success",
  "successful","blossom","bloom","laugh","laughter","rescue",
  "rescued","saved","salvation","truth","honest","loyalty","fly",
  "flying","wings","rainbow","miracle",
  // Persian
  "عشق","امید","نور","شادی","خوشحال","لبخند","درخشیدن","آزاد",
  "آزادی","آرامش","شفا","رویا","زیبا","برکت","ایمان","اعتماد","گرم",
  "خانواده","دوست","باهم","همیشه","زندگی","روح","ستاره","خورشید",
  "روشن","درخشش","افتخار","پیروزی","قوی","بهشت","فرشته","مهربون",
  "مهربان","امن","آروم","آرامش‌بخش","غرور","سپاس","زیبایی",
  "خوشبختی","موفقیت","رهایی","نجات","بهار","گل","خنده","محبت",
  "وفا","صداقت","تولد",
]);

// Exact color names → the CSS color they should render as. Checked
// before the negative/positive lists in renderLyricsLine(), so a
// color word always wins and shows its own color rather than a vibe
// tint. "black"/"مشکی"/"سیاه" and "خاکستری"/"gray" map to a lighter
// gray instead of true black/dark gray since that'd be invisible
// against this player's near-black background.
const LYRICS_COLOR_WORDS = {
  red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308",
  orange: "#f97316", purple: "#a855f7", pink: "#ec4899",
  black: "#9ca3af", white: "#ffffff", gray: "#9ca3af", grey: "#9ca3af",
  gold: "#fbbf24", golden: "#fbbf24", silver: "#cbd5e1",
  brown: "#b45309", violet: "#8b5cf6", indigo: "#6366f1",
  cyan: "#22d3ee", teal: "#14b8a6", maroon: "#f87171", navy: "#60a5fa",
  crimson: "#dc2626", scarlet: "#dc2626", turquoise: "#2dd4bf",
  lavender: "#c4b5fd", beige: "#d6c7a1", ivory: "#f5f0e6",
  emerald: "#10b981", ruby: "#e11d48", amber: "#f59e0b",
  coral: "#fb7185", magenta: "#d946ef", lime: "#84cc16",
  olive: "#a3b325", bronze: "#b08d57", platinum: "#cbd5e1",
  // Persian
  "قرمز": "#ef4444", "آبی": "#3b82f6", "سبز": "#22c55e",
  "زرد": "#eab308", "نارنجی": "#f97316", "بنفش": "#a855f7",
  "صورتی": "#ec4899", "مشکی": "#9ca3af", "سیاه": "#9ca3af",
  "سفید": "#ffffff", "خاکستری": "#9ca3af", "طلایی": "#fbbf24",
  "طلائی": "#fbbf24", "نقره‌ای": "#cbd5e1", "قهوه‌ای": "#b45309",
  "فیروزه‌ای": "#2dd4bf", "یاسی": "#c4b5fd", "کرم": "#d6c7a1",
  "عاجی": "#f5f0e6", "زمرد": "#10b981", "زمردی": "#10b981",
  "یاقوتی": "#e11d48", "کهربایی": "#f59e0b", "مرجانی": "#fb7185",
  "سرخابی": "#d946ef", "لیمویی": "#84cc16", "زیتونی": "#a3b325",
  "برنزی": "#b08d57", "سرمه‌ای": "#60a5fa",
};

// Strips punctuation/case for matching against the lists above, but
// the original word (with its punctuation) is still what gets shown —
// this only decides which color a word gets, never rewrites it.
function normalizeLyricWord(rawWord) {
  return rawWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function classifyWordVibe(cleanWord) {
  if (!cleanWord) return null;
  if (LYRICS_NEGATIVE_WORDS.has(cleanWord)) return "negative";
  if (LYRICS_POSITIVE_WORDS.has(cleanWord)) return "positive";
  return null;
}

function buildLyricsList(result) {
  // New song, new set of lines — any cached font sizes were measured
  // against the previous song's line markup and are meaningless here.
  lyricsFontSizeCache.clear();

  const track = document.getElementById("playerLyricsTrack");
  if (!track) return;

  if (!result || result.unavailable || !result.lines.length) {
    currentLyricsLines = [];
    track.dir = "ltr";
    track.innerHTML = `
      <div class="player-lyrics-status">
        ${
          result && result.instrumental
            ? "This track is instrumental."
            : "Lyrics unavailable for this track."
        }
      </div>
    `;
    return;
  }

  currentLyricsLines = result.lines;
  renderLyricsLine(activeLyricsLineIndex);

  // Warm the font-size cache for every remaining line right away, in
  // the background, instead of leaving each one to be measured for
  // the first time whenever playback happens to reach it — see
  // prewarmLyricsFontSizes()'s comment for why that's what was
  // actually causing the felt lag.
  prewarmLyricsFontSizes(currentLyricsLines);
}

// Builds the word-span markup for one lyrics line's already-split
// word list. Pulled out on its own so both renderLyricsLine() (the
// line actually on screen) and prewarmLyricsFontSizes() (every other
// line, measured ahead of time in the background) build the exact
// same markup — that's what lets the background measurement's cache
// entry actually get reused later instead of missing on some subtle
// difference.
function buildLyricsWordsHtml(words) {
  return words
    .map((word, i) => {
      const clean = normalizeLyricWord(word);
      const colorHex = LYRICS_COLOR_WORDS[clean];
      if (colorHex) {
        return `<span class="player-lyrics-word" style="--word-i:${i};color:${colorHex}">${escapeHTML(word)}</span>`;
      }
      const vibe = classifyWordVibe(clean);
      const vibeClass = vibe ? ` player-lyrics-word--${vibe}` : "";
      return `<span class="player-lyrics-word${vibeClass}" style="--word-i:${i}">${escapeHTML(word)}</span>`;
    })
    .join(" ");
}

// Renders the line at `index` as individual word spans — they flow
// left-to-right and wrap top-to-bottom exactly like normal text,
// filling as many lines as the sentence needs instead of being
// forced onto one. fitLyricsText() then grows/shrinks the font so
// this always fills the .player-lyrics box without overflowing it.
function renderLyricsLine(index) {
  const track = document.getElementById("playerLyricsTrack");
  const container = document.getElementById("playerLyrics");
  if (!track) return;

  const line = index >= 0 ? currentLyricsLines[index] : null;
  const text = line ? (line.text || "").trim() : "";

  if (!text) {
    track.innerHTML = "";
    return;
  }

  // Persian/Arabic lines get dir="rtl" so the words flow right-to-left
  // (matching normal reading order) instead of always left-to-right —
  // the words themselves are still split/joined in the same logical
  // order either way, only the visual direction changes.
  const dir = RTL_TEXT_RE.test(text) ? "rtl" : "ltr";
  track.dir = dir;

  const words = text.split(/\s+/).filter(Boolean);
  const wordsHtml = buildLyricsWordsHtml(words);

  // Work out this line's font size against an offscreen probe BEFORE
  // the animated word spans ever touch the live track — see
  // measureLyricsFontSize()'s comment for why that ordering is the
  // part that actually matters for smoothness. In the common case
  // prewarmLyricsFontSizes() has already measured this exact line in
  // the background, so this is just a cache read, not a fresh layout
  // pass — see that function's comment for why that's the part that
  // actually stopped the lag.
  if (container && container.clientHeight > 0) {
    track.style.fontSize = measureLyricsFontSize(container, dir, wordsHtml) + "px";
  }

  track.innerHTML = wordsHtml;
}

// Precomputes and caches the font size for every lyrics line up
// front, a few lines per idle slot, instead of only ever measuring a
// line the first time playback reaches it.
//
// Without this, reaching a brand-new (uncached) line inside
// updateLyricsSync() — which runs on every "timeupdate" tick — does
// measureLyricsFontSize()'s full 6-step measure/layout pass right
// there in the playback callback. That's real, synchronous layout
// thrashing (style write + scrollHeight read, six times over) landing
// directly in the middle of normal playback handling, and on lyrics
// with a lot of short/fast-changing lines that's exactly what was
// showing up as felt lag / a busy phone, especially on weaker
// devices — not the word-entrance animation itself.
//
// Warming the cache here means that by the time playback actually
// reaches each line, measureLyricsFontSize() is almost always a plain
// cache hit (same container width + identical markup, via
// buildLyricsWordsHtml()) — no forced layout, no jank, right in the
// path that used to pay for it.
//
// Safe to call anytime: it no-ops while the lyrics box is hidden
// (clientWidth/clientHeight 0, e.g. the full player is closed — see
// openFullPlayer(), which re-triggers this once the box is actually
// laid out), and a fresh call always supersedes any still-running
// one via lyricsPrewarmToken, so switching songs mid-warm-up can't
// leave a stale background loop measuring the wrong lyrics.
let lyricsPrewarmToken = 0;

function prewarmLyricsFontSizes(lines) {
  const token = ++lyricsPrewarmToken;

  if (!lines || !lines.length) return;

  const container = document.getElementById("playerLyrics");
  if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

  const schedule =
    (typeof requestIdleCallback === "function" && requestIdleCallback) ||
    (cb => setTimeout(() => cb({ timeRemaining: () => 8 }), 0));

  let i = 0;

  function step() {
    if (token !== lyricsPrewarmToken) return; // superseded by a newer song's lines

    const liveContainer = document.getElementById("playerLyrics");
    if (!liveContainer || liveContainer.clientWidth === 0 || liveContainer.clientHeight === 0) {
      return; // box got hidden again meanwhile — stop, openFullPlayer() will resume this
    }

    let processed = 0;

    // A handful of lines per slot keeps each individual chunk cheap
    // (this is still real layout work, just moved off the playback
    // path and spread out instead of done all at once).
    while (i < lines.length && processed < 4) {
      const text = (lines[i].text || "").trim();

      if (text) {
        const dir = RTL_TEXT_RE.test(text) ? "rtl" : "ltr";
        const words = text.split(/\s+/).filter(Boolean);
        const html = buildLyricsWordsHtml(words);
        measureLyricsFontSize(liveContainer, dir, html);
      }

      i++;
      processed++;
    }

    if (i < lines.length) schedule(step);
  }

  schedule(step);
}

// Binary-searches a font-size (between LYRICS_FONT_MIN/MAX) so `html`
// (the same word-span markup renderLyricsLine() is about to show)
// fills .player-lyrics vertically without overflowing — short lines
// render larger, long lines wrap across more lines at a smaller size.
//
// This runs against a detached, invisible clone rather than the live
// track. A binary search needs several style-write/scrollHeight-read
// round trips, and each one forces a synchronous layout — doing that
// directly on the live spans (the old approach) meant those forced
// reflows landed *after* the new line's words were already inserted
// and their CSS entrance animation had already started counting down
// its 380ms. On a slower phone that measuring work could easily eat
// 20-50ms of the animation's own timeline before the first frame was
// ever painted, so the fade-in visibly started partway through
// instead of at opacity 0 — the stutter/lag this fixes. Measuring on
// a throwaway clone keeps all of that thrashing off the real,
// animating elements; the live track is only ever touched once, and
// already at the right size.
// Caches a measured font size per (container width + line markup) so
// repeated lines — choruses are the common case, but a listener
// seeking backward hits this too — skip the reflow-heavy binary
// search entirely on repeat. This is the main cost on weak phones:
// each binary-search step below is a synchronous layout (style write
// then scrollHeight read), and re-running that full search on every
// single line change was the actual source of the lag/stutter,
// independent of the lyrics feature's normal per-line cost. Reset
// whenever the container width changes (fitLyricsText's resize path)
// or a new song's lines are loaded (buildLyricsList), since a cached
// size is only valid for the width it was measured against.
let lyricsFontSizeCache = new Map();
let lyricsFontSizeCacheWidth = 0;

function measureLyricsFontSize(container, dir, html) {
  const width = container.clientWidth;
  if (width !== lyricsFontSizeCacheWidth) {
    lyricsFontSizeCache.clear();
    lyricsFontSizeCacheWidth = width;
  }

  const cacheKey = dir + "|" + html;
  const cached = lyricsFontSizeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const probe = document.createElement("div");
  probe.className = "player-lyrics-track";
  probe.dir = dir;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.left = "-9999px";
  probe.style.top = "0";
  probe.style.width = width + "px";
  probe.style.maxHeight = "none";
  probe.innerHTML = html;

  // No need for the entrance animation to even exist on a probe
  // that's never seen.
  probe.querySelectorAll(".player-lyrics-word").forEach(word => {
    word.style.animation = "none";
  });

  container.appendChild(probe);

  let lo = LYRICS_FONT_MIN;
  let hi = LYRICS_FONT_MAX;
  let best = LYRICS_FONT_MIN;

  // 6 steps (was 8) — halves neither precision nor smoothness
  // noticeably (worst case ~0.3px off) but cuts two synchronous
  // layout passes off every line change, which is where weak phones
  // were losing the most time.
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    probe.style.fontSize = mid + "px";
    if (probe.scrollHeight <= container.clientHeight + 0.5) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  container.removeChild(probe);
  lyricsFontSizeCache.set(cacheKey, best);
  return best;
}

// Re-measures the *current* line in place — used when the box itself
// resizes (orientation change, mobile chrome showing/hiding) rather
// than when the line changes, so there's no fresh markup to measure
// ahead of time here; this reads directly off what's already shown.
function fitLyricsText() {
  const container = document.getElementById("playerLyrics");
  const track = document.getElementById("playerLyricsTrack");
  if (!container || !track || !track.textContent.trim()) return;
  if (container.clientHeight === 0) return; // player closed/hidden — refit happens on open instead

  track.style.fontSize =
    measureLyricsFontSize(container, track.dir, track.innerHTML) + "px";
}

// Refits the current line whenever the viewport (and so the
// .player-lyrics box) changes size — e.g. orientation change or a
// mobile browser's chrome showing/hiding.
function setupLyricsResize() {
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitLyricsText, 120);
  });
}

// Called from updateProgress() (the existing "timeupdate" handler) —
// this does not add a new listener. No-ops immediately whenever
// there's no current song or this song has no synced lyrics loaded,
// so it costs nothing on the common path.
function updateLyricsSync() {
  if (!state.currentSong) return;
  if (!currentLyricsLines.length) return;

  const t = audio.currentTime;
  const lines = currentLyricsLines;

  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) {
      index = i;
    } else {
      break;
    }
  }

  if (index !== activeLyricsLineIndex) {
    activeLyricsLineIndex = index;
    renderLyricsLine(index);
  }
}

/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {
  const button =
    document.getElementById("searchButton");

  const section =
    document.getElementById("searchSection");

  const input =
    document.getElementById("searchInput");

  button.addEventListener("click", () => {
    section.classList.toggle("hidden");

    if (!section.classList.contains("hidden")) {
      input.focus();
    }
  });

  let timer;

  input.addEventListener("input", () => {
    clearTimeout(timer);

    timer = setTimeout(
      () => search(input.value),
      350
    );
  });
}

async function search(query) {
  const q = query.trim();

  if (!q) {
    showPage("homePage");
    return;
  }

  try {
    const data =
      await api(`/search?q=${encodeURIComponent(q)}`);

    const results = data.songs || [];

    const container =
      document.getElementById("searchResults");

    if (!results.length) {
      container.innerHTML =
        `<div class="empty">No results found.</div>`;
    } else {
      container.innerHTML =
        results.map(songHTML).join("");

      bindSongButtons(container, results);
    }

    showPage("searchPage");
  } catch (error) {
    console.error("Search:", error);
  }
}

/* =========================================================
   HELPERS
   ========================================================= */

function showError(elementId, message) {
  const element =
    document.getElementById(elementId);

  if (!element) return;

  element.innerHTML =
    `<div class="empty">${escapeHTML(message)}</div>`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   COVER ART
   ========================================================= */

// Renders either the real Telegram cover (with a smooth
// fade/scale-in once loaded) or the existing placeholder glyph,
// unchanged, when no cover_url is available.
function coverInnerHTML(coverUrl, altText) {
  if (!coverUrl) {
    return `<span class="music-unicode" aria-hidden="true">𝄞</span>`;
  }

  const safeAlt = escapeHTML(altText || "Album cover");
  const safeSrc = escapeHTML(coverUrl);

  return `
    <img
      class="cover-art"
      src="${safeSrc}"
      alt="${safeAlt}"
      decoding="async"
      onload="this.classList.add('cover-art-loaded')"
      onerror="handleCoverError(this)"
    />
  `;
}

// If a cover image fails to load (network hiccup, revoked file,
// etc.), fall back to the existing placeholder glyph instead of
// showing a broken image.
function handleCoverError(img) {
  const span = document.createElement("span");
  span.className = "music-unicode";
  span.setAttribute("aria-hidden", "true");
  span.textContent = "𝄞";
  img.replaceWith(span);
}

// Tracks the latest setCoverArt() request per container, so a
// slow/failing image from an earlier song can never clobber a newer
// cover that already loaded into the same container (see
// handleCoverErrorForContainer() below).
const coverArtTokens = new Map();

function resolveCoverUrl(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch (_) {
    return url;
  }
}

// Sets the mini player / full player cover container to either the
// real cover art (with fallback restoration on error) or the exact
// original placeholder markup, unchanged.
//
// This preloads the new artwork off-DOM and only touches the
// container once it has actually finished loading. The previous
// version swapped `container.innerHTML` immediately (destroying
// whatever was currently shown) and then waited for the new <img> to
// load before it faded in — so on every single song change there was
// a real gap, confirmed on screen recording, where the container sat
// completely empty (no cover, no placeholder) until the new image
// arrived. Waiting for the load first means the old cover simply
// stays put, unchanged, right up until the new one is ready to
// appear — there's never a moment with nothing in the container.
function setCoverArt(containerId, coverUrl, altText, placeholderHTML) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const token = (coverArtTokens.get(containerId) || 0) + 1;
  coverArtTokens.set(containerId, token);

  if (!coverUrl) {
    container.innerHTML = placeholderHTML;
    return;
  }

  const resolvedUrl = resolveCoverUrl(coverUrl);

  // If this exact artwork is already showing in this container
  // (resuming the same song, or back-to-back tracks off the same
  // album/single), leave the current <img> in place instead of
  // tearing it down and rebuilding it from scratch. Recreating an
  // already-loaded image restarts its fade/scale-in animation, which
  // is also part of what made the cover visibly "jump" even when the
  // artwork itself hadn't changed.
  const existingImg = container.querySelector("img.cover-art");
  if (existingImg && existingImg.src === resolvedUrl) {
    return;
  }

  const safeAlt = escapeHTML(altText || "Album cover");

  const preload = new Image();
  preload.decoding = "async";

  preload.onload = () => {
    if (coverArtTokens.get(containerId) !== token) return; // superseded meanwhile

    if (existingImg && existingImg.isConnected) {
      // Reuse the <img> that's already on screen and just repoint it
      // at the now-preloaded (already cached) URL — the browser can
      // paint it right away instead of clearing to blank while it
      // loads a second time.
      existingImg.src = resolvedUrl;
      existingImg.alt = safeAlt;
      existingImg.classList.add("cover-art-loaded");
      return;
    }

    // First real cover shown in this container (it was a placeholder
    // before) — build the element fresh and let its normal fade/
    // scale-in transition run, one frame after insertion so the
    // opacity:0 starting state actually gets painted first.
    container.innerHTML = `
      <img
        class="cover-art"
        src="${escapeHTML(resolvedUrl)}"
        alt="${safeAlt}"
        decoding="async"
      />
    `;
    requestAnimationFrame(() => {
      const img = container.querySelector("img.cover-art");
      if (img) img.classList.add("cover-art-loaded");
    });
  };

  preload.onerror = () => handleCoverErrorForContainer(containerId, token);
  preload.src = resolvedUrl;
}

function handleCoverErrorForContainer(containerId, token, img) {
  // A newer cover has already been requested (or loaded) for this
  // container since this image started loading — ignore this stale
  // failure instead of wiping out the current, valid artwork.
  if (coverArtTokens.get(containerId) !== token) return;

  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML =
    containerId === "miniCover"
      ? "𝄞"
      : `<div class="player-cover-symbol" aria-hidden="true">𝄞</div>`;
}


