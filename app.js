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
  `,

  checkCircle: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="8 12.5 11 15.5 16.5 9"></polyline>
    </svg>
  `,

  close: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18"></line>
      <line x1="18" y1="6" x2="6" y2="18"></line>
    </svg>
  `,

  dragHandle: `
    <svg viewBox="0 0 24 24" aria-hidden="true" style="fill: currentColor; stroke: none;">
      <circle cx="9" cy="6" r="1.5"></circle>
      <circle cx="15" cy="6" r="1.5"></circle>
      <circle cx="9" cy="12" r="1.5"></circle>
      <circle cx="15" cy="12" r="1.5"></circle>
      <circle cx="9" cy="18" r="1.5"></circle>
      <circle cx="15" cy="18" r="1.5"></circle>
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

  // Bare fetch() has no timeout of its own — on a weak/dropped
  // connection (common inside Telegram's in-app browser) a request
  // can just hang forever, which reads as the whole app being frozen
  // (a "Loading..." skeleton that never resolves) rather than a
  // failed request the caller could retry. Capping it means a stuck
  // request surfaces as a normal, catchable error instead.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 20000);

  let response;

  try {
    response =
      await fetch(`${API}${endpoint}`, {
        ...options,
        headers,
        signal: options.signal || timeoutController.signal
      });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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
  setupSongsSelectMode();
  setupQueueDragging();
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

  if (card.classList.contains("is-loading")) return;

  card.classList.add("is-loading");
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
    card.classList.remove("is-loading");
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
  updateContinueCardPlayState();
}

/* Keeps the Continue Listening button's icon in sync with real
   playback: shows pause only while its own song is the one actually
   playing, play otherwise (including when it's the current song but
   paused). Safe to call any time — no-ops if the card isn't rendered. */
function updateContinueCardPlayState() {
  const card = document.querySelector("#continueListeningCard .continue-card");
  if (!card) return;

  const playSpan = card.querySelector(".continue-play");
  if (!playSpan) return;

  const isThisSong =
    !!state.currentSong &&
    Number(state.currentSong.id) === Number(card.dataset.id);

  const showPause = isThisSong && state.isPlaying;

  playSpan.innerHTML = showPause ? ICONS.pause : ICONS.play;
  playSpan.classList.toggle("is-pause", showPause);
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

// Purely a display order for the Songs page — the backend's own
// order (created_at DESC, i.e. "recent") is left untouched in
// state.songs itself, so every other screen (Home, search, queue
// context elsewhere) is unaffected by whatever sort is picked here.
let songsSortMode = "recent";

function getSortedSongs() {
  const list = state.songs.slice();

  if (songsSortMode === "title") {
    list.sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
    );
  } else if (songsSortMode === "artist") {
    list.sort((a, b) =>
      (a.artist || "").localeCompare(b.artist || "", undefined, { sensitivity: "base" })
    );
  }

  return list;
}

function renderSongs() {
  const container = document.getElementById("allSongs");

  if (!state.songs.length) {
    container.innerHTML = `<div class="empty">No songs yet.</div>`;
    return;
  }

  const sorted = getSortedSongs();

  container.innerHTML = sorted.map(songHTML).join("");
  bindSongButtons(container, sorted);

  // A fresh render replaces every row, so re-apply the select-mode
  // container class and any still-selected rows (selection itself,
  // selectedSongIds, is left untouched — only the markup was rebuilt).
  container.classList.toggle("select-mode", songsSelectMode);
  if (songsSelectMode) {
    container.querySelectorAll(".song-item").forEach(item => {
      const id = Number(item.dataset.songId);
      item.classList.toggle("selected", selectedSongIds.has(id));
    });
  }
}

/* =========================================================
   SONGS — SELECT MODE (bulk delete / bulk add to playlist)
   ========================================================= */

let songsSelectMode = false;
let selectedSongIds = new Set();

function setSongsSelectMode(active) {
  songsSelectMode = active;
  selectedSongIds = new Set();

  const container = document.getElementById("allSongs");
  container?.classList.toggle("select-mode", active);
  container?.querySelectorAll(".song-item.selected").forEach(item => {
    item.classList.remove("selected");
  });

  document
    .getElementById("selectSongsButton")
    ?.classList.toggle("active", active);

  updateSongsSelectBar();
}

function toggleSongSelection(id, itemEl) {
  if (selectedSongIds.has(id)) {
    selectedSongIds.delete(id);
  } else {
    selectedSongIds.add(id);
  }

  itemEl.classList.toggle("selected", selectedSongIds.has(id));
  updateSongsSelectBar();
}

function updateSongsSelectBar() {
  const bar = document.getElementById("songsSelectBar");
  const countEl = document.getElementById("songsSelectCount");
  if (!bar || !countEl) return;

  const n = selectedSongIds.size;
  countEl.textContent = `${n} selected`;
  bar.classList.toggle("hidden", !songsSelectMode);
}

// Runs in the capture phase so it intercepts the click before it
// reaches the row's own play/menu button listeners (added in
// bindSongButtons) — letting select mode reuse songHTML/bindSongButtons
// unchanged instead of forking the Songs list into a second renderer.
function setupSongsSelectMode() {
  const container = document.getElementById("allSongs");
  if (!container) return;

  container.addEventListener("click", event => {
    if (!songsSelectMode) return;
    if (event.target.closest(".song-menu-btn")) return;

    const item = event.target.closest(".song-item");
    if (!item) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    toggleSongSelection(Number(item.dataset.songId), item);
  }, true);

  document
    .getElementById("selectSongsButton")
    ?.addEventListener("click", () => {
      setSongsSelectMode(!songsSelectMode);
    });

  document
    .getElementById("songsSelectCancel")
    ?.addEventListener("click", () => setSongsSelectMode(false));

  document
    .getElementById("songsSelectDelete")
    ?.addEventListener("click", () => {
      if (!selectedSongIds.size) return;

      const ids = [...selectedSongIds];

      showConfirmationModal(
        "Delete Songs",
        `Delete ${ids.length} song${ids.length === 1 ? "" : "s"}? This removes them from your library, playlists and favorites.`,
        () => bulkDeleteSongs(ids)
      );
    });

  document
    .getElementById("songsSelectAddPlaylist")
    ?.addEventListener("click", () => {
      if (!selectedSongIds.size) return;
      openAddToPlaylist([...selectedSongIds]);
    });

  document
    .getElementById("songsSortSelect")
    ?.addEventListener("change", event => {
      songsSortMode = event.target.value;
      renderSongs();
    });
}

async function bulkDeleteSongs(ids) {
  try {
    await Promise.allSettled(
      ids.map(id => api(`/songs/${id}`, { method: "DELETE" }))
    );

    if (
      state.currentSong &&
      ids.includes(Number(state.currentSong.id))
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

    setSongsSelectMode(false);

    await Promise.allSettled([
      loadSongs(),
      loadFavorites(),
      loadArtists(),
      loadAlbums(),
      loadPlaylists(),
      loadHomeInsights()
    ]);

    renderHomeDashboard();

    alert(`Deleted ${ids.length} song${ids.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error("Bulk delete songs:", error);
    alert(error.message || "Couldn't delete songs.");
  }
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

      <div class="song-select-indicator" aria-hidden="true">
        ${ICONS.checkCircle}
      </div>

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

  updateLyricVideoMenuVisibility(song);

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
      closeFullPlayer();
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
    closeFullPlayer();

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

  document
    .getElementById("songActionLyricVideo")
    ?.addEventListener("click", () => {
      closeSongActionsMenu();
      openLyricVideoModal();
    });

  document
    .getElementById("closeLyricVideoModal")
    ?.addEventListener("click", closeLyricVideoModal);

  document
    .getElementById("lyricVideoSendButton")
    ?.addEventListener("click", startLyricVideoRecording);

  document
    .getElementById("lyricVideoModeToggle")
    ?.addEventListener("click", event => {
      const btn = event.target.closest(".lyric-video-mode-btn");
      if (btn) setLyricVideoMode(btn.dataset.mode);
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

let selectedSongIdsForPlaylist = [];

// Accepts either a single song object (⋯ menu -> Add to Playlist) or
// an array of song ids (Songs page select mode -> Add to Playlist).
// Both paths share the same modal/list and just POST once per id.
async function openAddToPlaylist(songOrIds) {
  selectedSongIdsForPlaylist =
    Array.isArray(songOrIds)
      ? songOrIds.map(Number)
      : [Number(songOrIds.id)];

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
        await Promise.allSettled(
          selectedSongIdsForPlaylist.map(songId =>
            api(`/playlists/${playlistId}/songs`, {
              method: "POST",
              body: JSON.stringify({ song_id: songId })
            })
          )
        );

        modal.classList.add("hidden");
        await loadPlaylists();

        if (selectedSongIdsForPlaylist.length > 1) {
          setSongsSelectMode(false);
          alert(`Added ${selectedSongIdsForPlaylist.length} songs to playlist.`);
        }
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

/* =========================================================
   PLAYER
   ========================================================= */

/* =========================================================
   PLAYBACK RESILIENCE
   ----------------------------------------------------------------
   Reloads the current song from where it left off and resumes
   playback, capped at AUDIO_RETRY_LIMIT attempts with a short
   backoff, instead of letting a transient network blip or a silent
   stall kill playback outright. See the "error"/"waiting" listeners
   in setupPlayer() for where this gets triggered.
   ========================================================= */

const AUDIO_RETRY_LIMIT = 3;
const AUDIO_STALL_TIMEOUT_MS = 8000;

let audioRetryCount = 0;
let audioRetrySongId = null;
let audioStallTimer = null;

function clearAudioStallTimer() {
  if (audioStallTimer) {
    clearTimeout(audioStallTimer);
    audioStallTimer = null;
  }
}

function retryPlaybackFromError() {
  const song = state.currentSong;
  if (!song) return;

  if (audioRetrySongId !== song.id) {
    audioRetrySongId = song.id;
    audioRetryCount = 0;
  }

  if (audioRetryCount >= AUDIO_RETRY_LIMIT) {
    // Repeated failures on this same song — stop hammering the same
    // dead connection and move on rather than getting stuck here
    // indefinitely.
    console.error("Playback: giving up after repeated errors, skipping");
    audioRetryCount = 0;
    nextSong();
    return;
  }

  audioRetryCount++;

  const resumeAt = audio.currentTime || 0;
  const delay = Math.min(1000 * audioRetryCount, 4000);

  setTimeout(() => {
    // The user may have already moved on to a different song while
    // this backoff was pending — don't stomp on their new selection.
    if (!state.currentSong || state.currentSong.id !== song.id) return;

    audio.src =
      `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;
    audio.currentTime = resumeAt;
    audio.play().catch(err => console.error("Playback retry:", err));
  }, delay);
}

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
    .getElementById("playerQueueButton")
    ?.addEventListener("click", openQueueModal);

  document
    .getElementById("closeQueueModal")
    ?.addEventListener("click", closeQueueModal);

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

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  });

  audio.addEventListener("pause", () => {
    state.isPlaying = false;
    updatePlayButtons();
    stopWaveformAnim();

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  });

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateDuration);
  audio.addEventListener("ended", handleSongEnded);

  // Guarded on its own: must never be able to abort the rest of
  // setupPlayer() (the error/waiting/resize listeners right below
  // are load-bearing for playback reliability).
  try {
    setupMediaSessionHandlers();
  } catch (err) {
    console.error("MediaSession setup:", err);
  }

  // Mobile connections (especially inside Telegram's in-app browser)
  // routinely drop or stall mid-stream. Without this, the <audio>
  // element's "error" event just left playback dead with no recovery
  // and no feedback, and a long "waiting" stall was indistinguishable
  // from the app being frozen — both are what "playback cuts out"
  // reports were actually caused by, not the buffering itself.
  audio.addEventListener("error", () => {
    console.error("Playback: audio element error", audio.error);
    clearAudioStallTimer();
    retryPlaybackFromError();
  });

  audio.addEventListener("waiting", () => {
    clearAudioStallTimer();
    audioStallTimer = setTimeout(() => {
      // Still stuck after AUDIO_STALL_TIMEOUT_MS with no recovery —
      // the connection to the Worker likely died silently (no
      // "error" event fires for that). Treat it the same as a hard
      // error instead of leaving playback buffering forever.
      if (!state.currentSong || audio.paused) return;
      console.error("Playback: stalled, retrying");
      retryPlaybackFromError();
    }, AUDIO_STALL_TIMEOUT_MS);
  });

  audio.addEventListener("playing", () => {
    clearAudioStallTimer();
    audioRetryCount = 0;
  });

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

  // A manual song change (next/previous/tap) supersedes any retry
  // that might still be pending for whatever was playing before —
  // without this, a stale retry could fire mid-backoff and stomp on
  // the song the user just picked.
  clearAudioStallTimer();
  audioRetryCount = 0;
  audioRetrySongId = song.id;

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

// --- Media Session (lock screen / Control Center / Telegram in-app
// browser now-playing controls) ---------------------------------
//
// Without this, iOS/Android show only a generic "now playing" card
// with no title/artist/artwork and the transport buttons don't
// actually reach this player. Everything below is additive: it
// mirrors state that already exists (state.currentSong, audio.*)
// into the browser's mediaSession API and never changes playback
// logic itself.

// Bumped on every call so an in-flight artwork resize for a song the
// user already skipped away from can recognize it's stale and back
// off instead of overwriting the metadata of whatever's playing now.
let mediaSessionArtworkToken = 0;

// Sizes to generate for the lock screen. 128 is required for the
// compact player to show anything at all (see note below); 512 is
// included alongside it so the full-screen/expanded player — which
// can display it — gets a sharp image instead of an upscaled,
// blurry 128px one.
const MEDIA_SESSION_ARTWORK_SIZES = [128, 512];

// Sets title/artist immediately, then artwork once it's ready.
// Called on every updatePlayerUI().
function updateMediaSessionMetadata(song) {
  if (!("mediaSession" in navigator)) return;

  const title = song.title || "Unknown";
  const artist = song.artist || "Unknown Artist";

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: "White Playlist",
      artwork: []
    });
  } catch (err) {
    console.error("MediaSession metadata:", err);
    return;
  }

  if (!song.cover_url) return;

  const token = ++mediaSessionArtworkToken;

  resizeCoverForMediaSession(
    resolveCoverUrl(song.cover_url),
    MEDIA_SESSION_ARTWORK_SIZES
  )
    .then(artwork => {
      // Superseded by a newer song while the resize was in flight —
      // the newer call owns the metadata now.
      if (token !== mediaSessionArtworkToken) return;
      if (!state.currentSong || state.currentSong.id !== song.id) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: "White Playlist",
        artwork
      });
    })
    .catch(err => console.error("MediaSession artwork:", err));
}

// iOS's compact lock-screen player only reliably shows artwork when
// handed a genuinely small image — a full-size photo merely labeled
// with a small "sizes" value still renders as a blank grey box. So
// this generates several real resized copies (one canvas draw per
// size, from a single image load) instead of relabeling one image
// multiple times: a small one the compact player can actually use,
// and a larger one for wherever the OS can afford to show it sharp.
//
// Reuses the same crossOrigin="anonymous" image-loading approach
// updatePlayerDynamicColor() already uses successfully with this
// same cover URL elsewhere in this file.
function resizeCoverForMediaSession(coverUrl, sizes) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const artwork = sizes.map(size => {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, size, size);

          return {
            src: canvas.toDataURL("image/jpeg", 0.9),
            sizes: `${size}x${size}`,
            type: "image/jpeg"
          };
        });

        resolve(artwork);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error("Cover image failed to load"));
    img.src = coverUrl;
  });
}

// Keeps the lock-screen scrub bar and elapsed/remaining time in
// sync with the actual <audio> position. Safe to call frequently —
// setPositionState() just overwrites the previous snapshot.
function updateMediaSessionPositionState() {
  if (
    !("mediaSession" in navigator) ||
    !("setPositionState" in navigator.mediaSession)
  ) {
    return;
  }

  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime, audio.duration)
    });
  } catch (err) {
    // Can throw transiently while a new track's duration hasn't
    // settled yet (e.g. right after audio.src changes) — the next
    // timeupdate/loadedmetadata tick will just retry.
  }
}

// Wires the lock screen / Control Center transport buttons to the
// same functions the in-app controls already use. Called once from
// setupPlayer(); the handlers stay valid across song changes since
// they read state.currentSong/audio at call time, not at setup time.
//
// Each handler is registered independently (its own try/catch): some
// WebViews (notably iOS's) throw on action names they don't support,
// and a single unsupported action must never prevent the others from
// registering or, worse, abort the rest of setupPlayer() if this
// function were called without any guard at all.
function setupMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;

  const safelySetHandler = (action, handler) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      console.warn(`MediaSession: "${action}" not supported`, err);
    }
  };

  safelySetHandler("play", () => {
    audio.play().catch(console.error);
  });

  safelySetHandler("pause", () => {
    audio.pause();
  });

  safelySetHandler("previoustrack", previousSong);
  safelySetHandler("nexttrack", nextSong);

  safelySetHandler("seekto", details => {
    if (details.fastSeek && "fastSeek" in audio) {
      audio.fastSeek(details.seekTime);
    } else {
      audio.currentTime = details.seekTime;
    }
    updateMediaSessionPositionState();
  });
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

/* =========================================================
   UP NEXT (queue modal)
   Reuses the existing state.queue/state.queueIndex that already
   drives Next/Previous/Shuffle — this just gives it a screen, plus
   drag-to-reorder and remove-from-queue.

   Reordering moves the existing DOM node (insertBefore/appendChild)
   instead of rebuilding innerHTML, and only touches data-index/
   disabled/playing on the rows — it never regenerates a row's cover
   markup, so cover art never re-fetches/flickers when the order
   changes. Only removeFromQueue() and a fresh openQueueModal() call
   renderQueueModal() (a full rebuild); dragging never does.
   ========================================================= */

function openQueueModal() {
  renderQueueModal();
  document.getElementById("queueModal")?.classList.remove("hidden");
}

function closeQueueModal() {
  document.getElementById("queueModal")?.classList.add("hidden");
}

function renderQueueModal() {
  const container = document.getElementById("queueList");
  if (!container) return;

  if (!state.queue.length) {
    container.innerHTML = `<div class="empty">Queue is empty.</div>`;
    return;
  }

  container.innerHTML = state.queue.map((song, index) => {
    const isCurrent = index === state.queueIndex;
    const artist = song.artist || "Unknown Artist";

    return `
      <div class="song-item${isCurrent ? " playing" : ""}" data-song-id="${song.id}">

        <button
          class="song-cover"
          data-queue-action="play"
          data-index="${index}"
          aria-label="Play ${escapeHTML(song.title || "song")}"
        >
          ${coverInnerHTML(song.cover_url, song.title)}
        </button>

        <button
          class="song-info"
          data-queue-action="play"
          data-index="${index}"
          style="text-align:left"
        >
          <div class="song-title">${escapeHTML(song.title || "Unknown")}</div>
          <div class="song-meta">${escapeHTML(artist)}</div>
        </button>

        <div class="queue-item-actions">
          <button
            class="queue-drag-handle"
            data-index="${index}"
            aria-label="Drag to reorder"
          >${ICONS.dragHandle}</button>

          <button
            data-queue-action="remove"
            data-index="${index}"
            aria-label="Remove from queue"
            ${isCurrent ? "disabled" : ""}
          >${ICONS.close}</button>
        </div>

      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-queue-action]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.queueAction;
      const index = Number(button.dataset.index);

      if (action === "play") jumpToQueueIndex(index);
      if (action === "remove") removeFromQueue(index);
    });
  });
}

function jumpToQueueIndex(index) {
  const song = state.queue[index];
  if (!song) return;

  state.queueIndex = index;
  startPlayback(song);
  closeQueueModal();
}

function removeFromQueue(index) {
  if (index === state.queueIndex) return;

  state.queue.splice(index, 1);

  if (index < state.queueIndex) {
    state.queueIndex -= 1;
  }

  renderQueueModal();
}

/* ---------------------------------------------------------
   Drag-to-reorder — pointer events so it works the same for
   touch (Telegram in-app browser) and mouse. Bound once on the
   container via delegation (setupQueueDragging(), called from
   init()) so it keeps working across every renderQueueModal()
   rebuild without needing to be re-attached.

   Two things that used to break this, both fixed here:

   1. Telegram's own in-app "swipe down to close/minimize" gesture
      lives outside the page (native shell, not the DOM), so it can
      steal a downward drag out from under us even with
      preventDefault()/touch-action:none on our handle — that's why
      only top-to-bottom drags used to also move the whole sheet.
      We now explicitly disable it for the duration of a drag via
      Telegram.WebApp.disableVerticalSwipes()/enableVerticalSwipes()
      (feature-detected — older clients just no-op).

   2. When the OS/Telegram did steal the pointer mid-drag, this
      item's own pointerup/pointercancel listeners never fired
      (the item lost the pointer without being told), so queueDrag
      never got cleared, the row was left stuck mid-transform, and
      every later drag on that row kept piling on another set of
      listeners that could never be removed either — eventually the
      list stopped responding until the page was reloaded. The
      pointermove/up/cancel listeners are now bound once, on
      window, for the lifetime of the app (guarded by the queueDrag
      state instead of being added/removed per drag), plus a
      lostpointercapture listener as a hard safety net for exactly
      the "pointer got taken away from us" case.
   --------------------------------------------------------- */

let queueDrag = null;

function setQueueDragModeActive(active) {
  document.getElementById("queueList")?.classList.toggle("is-dragging", active);

  // Telegram Bot API 7.7+. Wrapped so older clients (or running
  // outside Telegram entirely) just silently skip this.
  if (!tg) return;
  try {
    if (active) tg.disableVerticalSwipes?.();
    else tg.enableVerticalSwipes?.();
  } catch (_) {}
}

function setupQueueDragging() {
  const container = document.getElementById("queueList");
  if (!container) return;

  container.addEventListener("pointerdown", event => {
    const handle = event.target.closest(".queue-drag-handle");
    if (!handle) return;

    const item = handle.closest(".song-item");
    if (!item) return;

    const items = [...container.querySelectorAll(".song-item")];
    const startIndex = items.indexOf(item);
    if (startIndex === -1) return;

    event.preventDefault();

    // If a previous drag never got a clean end (pointer stolen,
    // tab backgrounded, etc.), clear it out before starting a new
    // one instead of leaving it to leak.
    if (queueDrag) endQueueDrag({ pointerId: queueDrag.pointerId });

    queueDrag = {
      item,
      items,
      startIndex,
      currentIndex: startIndex,
      itemHeight: item.offsetHeight,
      startY: event.clientY,
      pointerId: event.pointerId
    };

    item.classList.add("dragging");
    item.setPointerCapture(event.pointerId);
    setQueueDragModeActive(true);
  });

  // Bound once, ever — not per-drag — so there's nothing to leak
  // and nothing that can be left half-attached if a drag ends in an
  // unusual way.
  window.addEventListener("pointermove", onQueueDragMove);
  window.addEventListener("pointerup", endQueueDrag);
  window.addEventListener("pointercancel", endQueueDrag);
  window.addEventListener("lostpointercapture", event => {
    if (queueDrag && event.pointerId === queueDrag.pointerId) endQueueDrag(event);
  });
  // Belt-and-suspenders: if the app gets backgrounded mid-drag
  // (e.g. the user got pulled into a system gesture/overlay),
  // don't leave the row stuck for when they come back.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && queueDrag) endQueueDrag({ pointerId: queueDrag.pointerId });
  });
}

function onQueueDragMove(event) {
  if (!queueDrag || event.pointerId !== queueDrag.pointerId) return;

  const { item, items, startIndex, itemHeight, startY } = queueDrag;
  const deltaY = event.clientY - startY;

  item.style.transform = `translateY(${deltaY}px)`;

  const rawTarget = startIndex + Math.round(deltaY / itemHeight);
  const targetIndex = Math.max(0, Math.min(items.length - 1, rawTarget));

  if (targetIndex === queueDrag.currentIndex) return;

  // Slide every row between the drag's start and its current target
  // out of the way by one slot — the dragged row itself is skipped
  // (it already follows the pointer via the transform set above).
  items.forEach((row, idx) => {
    if (row === item) return;

    let shift = 0;
    if (targetIndex > startIndex && idx > startIndex && idx <= targetIndex) {
      shift = -itemHeight;
    } else if (targetIndex < startIndex && idx >= targetIndex && idx < startIndex) {
      shift = itemHeight;
    }

    row.style.transform = shift ? `translateY(${shift}px)` : "";
  });

  queueDrag.currentIndex = targetIndex;
}

function endQueueDrag(event) {
  if (!queueDrag || event.pointerId !== queueDrag.pointerId) return;

  const { item, items, startIndex, currentIndex } = queueDrag;

  item.classList.remove("dragging");
  item.style.transform = "";
  items.forEach(row => { if (row !== item) row.style.transform = ""; });

  queueDrag = null;
  setQueueDragModeActive(false);

  if (currentIndex !== startIndex) {
    reorderQueue(startIndex, currentIndex);
  }
}

// Updates state.queue/state.queueIndex, then physically moves the
// already-existing row (insertBefore/appendChild) to match — never
// touches any row's inner markup, so no cover art reloads.
function reorderQueue(fromIndex, toIndex) {
  const queue = state.queue;
  const [moved] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, moved);

  if (state.queueIndex === fromIndex) {
    state.queueIndex = toIndex;
  } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
    state.queueIndex -= 1;
  } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
    state.queueIndex += 1;
  }

  const container = document.getElementById("queueList");
  if (!container) return;

  const rows = [...container.querySelectorAll(".song-item")];
  const movedEl = rows[fromIndex];
  if (!movedEl) return;

  if (toIndex >= rows.length - 1) {
    container.appendChild(movedEl);
  } else {
    const referenceEl = rows[toIndex + (toIndex > fromIndex ? 1 : 0)];
    container.insertBefore(movedEl, referenceEl);
  }

  [...container.querySelectorAll(".song-item")].forEach((row, index) => {
    row.querySelectorAll("[data-queue-action], .queue-drag-handle").forEach(el => {
      el.dataset.index = String(index);
    });

    const removeBtn = row.querySelector('[data-queue-action="remove"]');
    const isCurrent = index === state.queueIndex;
    if (removeBtn) removeBtn.disabled = isCurrent;
    row.classList.toggle("playing", isCurrent);
  });
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
    ICONS.music
  );

  setCoverArt(
    "playerCover",
    song.cover_url,
    title,
    ICONS.music
  );

  updateMediaSessionMetadata(song);

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
    mini.classList.toggle("is-pause", state.isPlaying);
  }

  if (main) {
    main.innerHTML =
      state.isPlaying ? ICONS.pause : ICONS.play;
  }

  // Visual-only hook (CSS reads this class for the subtle cover
  // animation + mini player state). Does not affect audio/state logic.
  document.body.classList.toggle("is-playing", state.isPlaying);

  updateContinueCardPlayState();
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
  updateMediaSessionPositionState();
}

function updateDuration() {
  document.getElementById("duration").textContent =
    formatTime(audio.duration);

  updateMediaSessionPositionState();
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

// On low-end devices, loadWaveform() only fetches/decodes this many
// bytes from the start of the file instead of the whole song — about
// 45-60s of typical ~128kbps audio, which is enough for a real (if
// approximate) waveform shape while keeping the decode cost small
// and constant regardless of the track's actual length.
const WAVEFORM_LITE_BYTE_CAP = 900 * 1024;

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

// Holds the AbortController for whatever waveform download is
// currently in flight, so it can be cancelled the instant the real
// song stalls (see ensureWaveformStallHandling()) or a new song
// starts loading before the previous waveform fetch finished.
let waveformAbortController = null;

function waveformStorageKey(songId) {
  return `wp_wave_${songId}`;
}

function loadWaveformFromStorage(songId) {
  try {
    const raw = localStorage.getItem(waveformStorageKey(songId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Legacy cache from before the multi-band chart redesign — a
    // flat array is still perfectly usable as the main line, it
    // just won't have bass/mid/treble layers until this song is
    // decoded again (which re-saves it in the new shape).
    if (Array.isArray(parsed)) {
      return { main: parsed.map(v => v / 100), bass: [], mid: [], treble: [] };
    }

    if (parsed && Array.isArray(parsed.main)) {
      return {
        main: parsed.main.map(v => v / 100),
        bass: (parsed.bass || []).map(v => v / 100),
        mid: (parsed.mid || []).map(v => v / 100),
        treble: (parsed.treble || []).map(v => v / 100)
      };
    }

    return null;
  } catch (_) {
    return null;
  }
}

// Stores each band compactly (0-100 ints) and keeps a small LRU
// index so this never grows unbounded across many different songs.
function saveWaveformToStorage(songId, data) {
  try {
    const compact = {
      main: data.main.map(v => Math.round(v * 100)),
      bass: data.bass.map(v => Math.round(v * 100)),
      mid: data.mid.map(v => Math.round(v * 100)),
      treble: data.treble.map(v => Math.round(v * 100))
    };
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

  // Never fetch a full extra copy of the song on a data-saver/slow
  // connection just to draw a waveform — that download used to run
  // at the exact same moment the <audio> element was buffering the
  // real stream, and on a weak connection the two competed for the
  // same limited bandwidth, which is what actually caused playback
  // to stutter/cut out right as a song started.
  const connection =
    navigator.connection ||
    navigator.webkitConnection ||
    navigator.mozConnection;

  if (
    connection &&
    (connection.saveData ||
      /2g/.test(connection.effectiveType || ""))
  ) {
    setWaveformState("unavailable");
    return;
  }

  // decodeAudioData() below has to decode the *entire* fetched buffer
  // into raw PCM before computeWaveformBands() can even start — for a
  // multi-minute file that's real, unavoidable CPU work with no
  // progress callback, and it runs right at song-open time. On a
  // low-memory/low-core device that's long enough to be felt as the
  // whole app hanging exactly when a new song starts. Rather than
  // dropping the waveform there entirely, this only fetches/decodes a
  // capped-size slice of the file on such devices (see
  // WAVEFORM_LITE_BYTE_CAP below) — the resulting peaks only reflect
  // that opening slice, stretched across the full bar width, but the
  // download and decode cost drops from "whole song" to a fixed,
  // small amount regardless of track length.
  const lowEndDevice =
    (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2) ||
    (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2);

  setWaveformState("loading");
  drawWaveform(null); // clear any previous song's bars immediately

  ensureWaveformStallHandling();

  let started = false;

  const beginFetch = () => {
    if (started || token !== waveformRequestToken) return;
    started = true;

    if (waveformAbortController) {
      waveformAbortController.abort();
    }
    waveformAbortController = new AbortController();

    const audioUrl =
      `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;

    // fetchPriority "low" (where supported) so this never competes
    // with the <audio> element's own request for bandwidth on the
    // song that's actually about to play. It's also aborted outright
    // the moment the audio element stalls (see
    // ensureWaveformStallHandling()) so it can never keep starving
    // playback once a rebuffer has already started.
    fetch(audioUrl, {
      priority: "low",
      signal: waveformAbortController.signal,
      // On low-end devices, cap how many bytes we even ask for — the
      // worker already supports Range (used elsewhere for scrubbing/
      // metadata), so this is a normal partial request, not a hack.
      // Starting at byte 0 keeps the format's header in the slice so
      // decodeAudioData has what it needs for both MP3 and FLAC.
      headers: lowEndDevice
        ? { Range: `bytes=0-${WAVEFORM_LITE_BYTE_CAP - 1}` }
        : undefined
    })
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

        const data = computeWaveformBands(audioBuffer, WAVEFORM_BAR_COUNT);

        waveformCache.set(song.id, data);
        saveWaveformToStorage(song.id, data);

        if (token === waveformRequestToken) {
          drawWaveform(data);
          setWaveformState("ready");
        }
      })
      .catch(error => {
        console.error("Waveform:", error);
        if (token === waveformRequestToken) {
          setWaveformState("unavailable");
        }
      });
  };

  // Give the <audio> element's own initial buffering a head start
  // instead of racing it from byte zero. Once the browser reports it
  // can play through without immediately stalling, it's safe to
  // start the second (waveform-only) download. A short timeout is
  // kept as a fallback so the waveform doesn't just never appear on
  // a connection that never reaches that ready state.
  if (audio.readyState >= 3 /* HAVE_FUTURE_DATA */) {
    beginFetch();
  } else {
    audio.addEventListener("canplay", beginFetch, { once: true });
    setTimeout(beginFetch, 4000);
  }
}

// Aborts any in-flight waveform download the instant the actual
// song stalls/rebuffers, handing all available bandwidth back to
// playback. Attached once, lazily, the first time a waveform is
// ever requested.
let waveformStallHandlingAttached = false;

function ensureWaveformStallHandling() {
  if (waveformStallHandlingAttached) return;
  waveformStallHandlingAttached = true;

  audio.addEventListener("waiting", () => {
    if (waveformAbortController) {
      waveformAbortController.abort();
      waveformAbortController = null;
    }
  });
}

// Downsamples a channel (any Float32Array-like of samples) into
// `barCount` peak values (0..1) using the max sample magnitude per
// bucket — this is what gives the chart its real, jagged-under-the-
// smoothing shape, unlike an averaged/flattened curve. Shared by
// every band in computeWaveformBands() below, each normalized to
// its own loudest point so a quieter band (bass on a treble-heavy
// track, say) still reads as a visible shape rather than flatlining.
function extractPeaksFromChannel(channel, barCount) {
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

// Simple one-pole IIR filters — cheap, single-pass, no FFT needed.
// Good enough to visually separate "boomy" vs "bright" content in a
// waveform chart; not meant to be a precise crossover.
function onePoleLowPass(channel, sampleRate, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(channel.length);
  let prev = 0;
  for (let i = 0; i < channel.length; i++) {
    prev += alpha * (channel[i] - prev);
    out[i] = prev;
  }
  return out;
}

function onePoleHighPass(channel, sampleRate, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  const out = new Float32Array(channel.length);
  let prevIn = channel[0] || 0;
  let prevOut = 0;
  for (let i = 0; i < channel.length; i++) {
    const x = channel[i];
    prevOut = alpha * (prevOut + x - prevIn);
    out[i] = prevOut;
    prevIn = x;
  }
  return out;
}

// Splits the decoded audio into an overall envelope ("main") plus
// three real frequency bands pulled from that same audio — bass
// (<~200Hz), treble (>~4kHz), and mid (the band between them). This
// is what actually moves with the song, not a decorative animation:
// quiet/bass-heavy sections genuinely show a taller bass layer,
// vocal/bright sections show more in mid/treble.
function computeWaveformBands(audioBuffer, barCount) {
  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const bass = onePoleLowPass(channel, sampleRate, 200);
  const treble = onePoleHighPass(channel, sampleRate, 4000);
  const mid = onePoleHighPass(onePoleLowPass(channel, sampleRate, 4000), sampleRate, 200);

  return {
    main: extractPeaksFromChannel(channel, barCount),
    bass: extractPeaksFromChannel(bass, barCount),
    mid: extractPeaksFromChannel(mid, barCount),
    treble: extractPeaksFromChannel(treble, barCount)
  };
}

// Paints the bars. Cheap enough to call on every timeupdate tick —
// it never recomputes peaks, only repaints already-known numbers.
function drawWaveform(data) {
  lastWaveformPeaks = data;

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

  const main = data && data.main;
  if (!main || !main.length) return;

  // Faint frequency layers first (drawn — and so, visually, sitting
  // — underneath the main line): real bass/mid/treble content from
  // this song, each a translucent area anchored to the baseline,
  // stacked shortest-and-dimmest (bass) to tallest-and-clearest
  // (treble) so the main line still reads as the foreground.
  const bandLayers = [
    { points: data.bass, heightScale: 0.42, alpha: 0.10 },
    { points: data.mid, heightScale: 0.56, alpha: 0.14 },
    { points: data.treble, heightScale: 0.70, alpha: 0.20 }
  ];

  for (const layer of bandLayers) {
    if (layer.points && layer.points.length) {
      const path = buildWaveAreaPath(layer.points, canvas.width, canvas.height, layer.heightScale);
      ctx.fillStyle = waveformBandColor(layer.alpha);
      ctx.fill(path);
    }
  }

  drawWaveMainLine(ctx, main, canvas.width, canvas.height, dpr);
}

// Builds a smooth (quadratic-curve-through-points) filled area path
// from `baseline` up to each point's height, used for both the
// decorative band layers and the main line below.
function buildWaveAreaPath(points, width, height, heightScale) {
  const n = points.length;
  const stepX = width / (n - 1 || 1);
  const baseline = height;

  const xAt = i => i * stepX;
  const yAt = i => baseline - Math.max(0.03, points[i]) * height * heightScale;

  const path = new Path2D();
  path.moveTo(xAt(0), baseline);
  path.lineTo(xAt(0), yAt(0));

  for (let i = 1; i < n; i++) {
    const midX = (xAt(i - 1) + xAt(i)) / 2;
    const midY = (yAt(i - 1) + yAt(i)) / 2;
    path.quadraticCurveTo(xAt(i - 1), yAt(i - 1), midX, midY);
  }
  path.lineTo(xAt(n - 1), yAt(n - 1));
  path.lineTo(xAt(n - 1), baseline);
  path.closePath();

  return path;
}

// The prominent top layer — the actual progress indicator. Split at
// the current playhead position into the song's dominant cover
// color (played, brightness-boosted for legibility — see
// ensureWaveformLegibility()) and a neutral gray (not yet played),
// same role the old bars served, just rendered as one continuous
// chart line.
const WAVE_MAIN_HEIGHT_SCALE = 0.88;

function drawWaveMainLine(ctx, points, width, height, dpr) {
  const path = buildWaveAreaPath(points, width, height, WAVE_MAIN_HEIGHT_SCALE);
  const lineWidth = Math.max(1.5 * dpr, height * 0.012);

  const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  const activeX = Math.max(0, Math.min(width, (percent / 100) * width));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, activeX, height);
  ctx.clip();
  ctx.fillStyle = waveformBandColor(0.28);
  ctx.fill(path);
  ctx.strokeStyle = waveformActiveColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.stroke(path);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(activeX, 0, width - activeX, height);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.fill(path);
  ctx.stroke(path);
  ctx.restore();
}

// rgba string at an arbitrary alpha, built from the same
// legibility-boosted cover color the main line's stroke uses — lets
// the decorative band layers and the main line's own fill share one
// consistent per-song tint.
function waveformBandColor(alpha) {
  const [r, g, b] = waveformActiveColorRGB;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

// Raw [r, g, b] twin of the above, kept in sync so the faint band
// layers can be filled at their own (lower) alphas without
// re-parsing the rgba string.
let waveformActiveColorRGB = [255, 255, 255];

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

  const [wr, wg, wb] = ensureWaveformLegibility(r, g, b);

  return {
    glow: `rgba(${r}, ${g}, ${b}, .55)`,
    glowSoft: `rgba(${r}, ${g}, ${b}, .18)`,
    wave: `rgba(${wr}, ${wg}, ${wb}, .95)`,
    waveRGB: [wr, wg, wb]
  };
}

// The waveform's played bars sit on the player's near-black
// background, so a color straight off a dark/muddy cover (deep
// navy album art, black-on-black artwork, etc.) can end up nearly
// invisible against it. This nudges only that copy of the color —
// lifting lightness and, if needed, saturation — just enough to
// stay legible, while keeping the same hue so it still visibly
// belongs to that cover. Bright covers pass through untouched.
const WAVEFORM_MIN_LIGHTNESS = 0.42;
const WAVEFORM_MIN_SATURATION = 0.35;

function ensureWaveformLegibility(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);

  if (l >= WAVEFORM_MIN_LIGHTNESS && s >= WAVEFORM_MIN_SATURATION) {
    return [r, g, b];
  }

  const boostedL = Math.max(l, WAVEFORM_MIN_LIGHTNESS);
  const boostedS = Math.max(s, WAVEFORM_MIN_SATURATION);
  return hslToRgb(h, boostedS, boostedL);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  ];
}

function applyPlayerGlow(colorPair) {
  document.documentElement.style.setProperty("--player-glow", colorPair.glow);
  document.documentElement.style.setProperty("--player-glow-soft", colorPair.glowSoft);
  waveformActiveColor = colorPair.wave || "rgba(255,255,255,.92)";
  waveformActiveColorRGB = colorPair.waveRGB || [255, 255, 255];
  redrawWaveformProgress();
}

function resetPlayerGlow() {
  document.documentElement.style.removeProperty("--player-glow");
  document.documentElement.style.removeProperty("--player-glow-soft");
  waveformActiveColor = "rgba(255,255,255,.92)";
  waveformActiveColorRGB = [255, 255, 255];
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
// overflowing or horizontally scrolling. LYRICS_FONT_ABSOLUTE_MIN is
// a second, lower floor measureLyricsFontSize() falls back to only
// for the rare very-long line that still wouldn't fit the box even
// at LYRICS_FONT_MIN — without it, that line would overflow and get
// clipped against the row above instead of just rendering smaller.
const LYRICS_FONT_MIN = 17;
const LYRICS_FONT_MAX = 34;
const LYRICS_FONT_ABSOLUTE_MIN = 11;

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

// Strips the kind of noise that shows up in scraped/tagged titles but
// never in LRCLIB's own records — "(Official Video)", "[Lyrics]",
// "feat. X", "- Remastered 2011", trailing "HD"/"HQ", etc. Used only
// for the fallback attempts below; the very first /get try always
// uses the untouched title/artist in case they're already clean.
function cleanLyricsQueryText(text) {
  return text
    .replace(/[([]\s*(official\s*)?(music\s*)?(video|audio|lyrics?|visualizer|hd|hq|remaster(ed)?(\s*\d{4})?)\s*[)\]]/gi, " ")
    .replace(/\b(feat\.?|ft\.?|featuring)\s+[^-([]+/gi, " ")
    .replace(/[-–—]\s*(official\s*)?(video|audio|lyrics?|remaster(ed)?(\s*\d{4})?)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Picks the best candidate from a /search results array: prefers
// synced-lyrics entries, then the one closest to the known duration
// (when we have one).
function pickBestLyricsCandidate(results, duration) {
  if (!Array.isArray(results) || !results.length) return null;

  const withSync = results.filter(r => r.syncedLyrics);
  const candidates = withSync.length ? withSync : results;

  let best = candidates[0];
  if (duration) {
    let bestDiff = Infinity;
    for (const candidate of candidates) {
      const diff = Math.abs((candidate.duration || 0) - duration);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate;
      }
    }
  }
  return best;
}

// Runs one /api/search call and returns the parsed best match, or
// null if the request failed / came back empty. Shared by every
// search-based tier in fetchLyricsFromLRCLIB() below.
async function searchLRCLIBOnce(params, duration) {
  try {
    const res = await fetch(`${LYRICS_API}/search?${params.toString()}`);
    if (!res.ok) return null;

    const results = await res.json();
    const best = pickBestLyricsCandidate(results, duration);
    return best ? parseLyricsResponse(best) : null;
  } catch (_) {
    return null;
  }
}

// Queries LRCLIB by artist + track title (and duration, when known,
// to disambiguate covers/remixes). Never fabricates a result — any
// failure resolves to { lines: [], unavailable: true }. Tries,
// in order:
//   1. /get with the raw title/artist (+duration) — exact match,
//      fastest and most accurate when the tags are already clean.
//   2. /search with the raw title/artist, field-specific.
//   3. /search with cleaned title/artist (strips "(Official Video)",
//      "feat. X", "- Remastered 2011", etc.), field-specific.
//   4. /search with the cleaned text as a single "q" query — the
//      same fuzzy, combined-field search the lrclib.net site itself
//      uses, so anything findable there is findable here too.
async function fetchLyricsFromLRCLIB(song) {
  const title = (song.title || "").trim();
  const artist = (song.artist || "").trim();

  if (!title || !artist) {
    return { lines: [], unavailable: true };
  }

  const duration = song.duration ? Math.round(song.duration) : null;

  // Tier 1: exact-match /get.
  const getParams = new URLSearchParams({
    track_name: title,
    artist_name: artist
  });
  if (duration) getParams.set("duration", String(duration));

  try {
    const res = await fetch(`${LYRICS_API}/get?${getParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseLyricsResponse(data);
      if (parsed) return parsed;
    }
  } catch (_) {
    // fall through to search tiers
  }

  // Tier 2: field-specific /search on the raw title/artist.
  const rawResult = await searchLRCLIBOnce(
    new URLSearchParams({ track_name: title, artist_name: artist }),
    duration
  );
  if (rawResult) return rawResult;

  // Tier 3 & 4: only worth trying if cleaning actually changed
  // something — otherwise they'd just repeat tier 2's query.
  const cleanTitle = cleanLyricsQueryText(title);
  const cleanArtist = cleanLyricsQueryText(artist);

  if (cleanTitle && cleanTitle !== title) {
    const cleanedFieldResult = await searchLRCLIBOnce(
      new URLSearchParams({
        track_name: cleanTitle,
        artist_name: cleanArtist || artist
      }),
      duration
    );
    if (cleanedFieldResult) return cleanedFieldResult;
  }

  const qText = `${cleanArtist || artist} ${cleanTitle || title}`.trim();
  const qResult = await searchLRCLIBOnce(
    new URLSearchParams({ q: qText }),
    duration
  );
  if (qResult) return qResult;

  return { lines: [], unavailable: true };
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

// Splits a raw lyric token into its leading punctuation, its actual
// letters/digits, and its trailing punctuation — e.g. "hell," →
// ("", "hell", ","), "(my" → ("(", "my", ""). Only the middle piece
// is ever colored (see buildLyricsWordsHtml below); the punctuation
// on either side is rendered as plain text so a comma, parenthesis,
// quote mark etc. sitting right next to a colored word never itself
// picks up that color. Anything in the middle (like the apostrophe in
// "don't" or the hyphen in "well-known") stays part of the word, same
// as before.
function splitWordEdges(word) {
  const match = word.match(/^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u);
  if (!match) return { lead: "", core: word, trail: "" };
  return { lead: match[1], core: match[2], trail: match[3] };
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
      const { lead, core, trail } = splitWordEdges(word);

      if (!core) {
        // Punctuation-only token (e.g. "...", "!?") — nothing to color.
        return `<span class="player-lyrics-word">${escapeHTML(word)}</span>`;
      }

      const clean = normalizeLyricWord(core);
      const colorHex = LYRICS_COLOR_WORDS[clean];
      const leadHtml = escapeHTML(lead);
      const trailHtml = escapeHTML(trail);
      const coreHtml = escapeHTML(core);

      if (colorHex) {
        return `<span class="player-lyrics-word">${leadHtml}<span style="color:${colorHex}">${coreHtml}</span>${trailHtml}</span>`;
      }

      const vibe = classifyWordVibe(clean);
      const coreHtmlWrapped = vibe
        ? `<span class="player-lyrics-word--${vibe}">${coreHtml}</span>`
        : coreHtml;
      return `<span class="player-lyrics-word">${leadHtml}${coreHtmlWrapped}${trailHtml}</span>`;
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

  // Restart the whole-line entrance animation: remove the class,
  // force a reflow (without this the browser just sees the class is
  // already there and never replays the animation), then re-add it.
  // One class toggle per line change — much cheaper than the old
  // per-word stagger, which set up to a few dozen independent
  // animations per line.
  track.classList.remove("player-lyrics-line-in");
  void track.offsetWidth;
  track.classList.add("player-lyrics-line-in");

  // Safety net for environments where the *visible, on-screen* line
  // renders text larger than the offscreen probe measured it — see
  // verifyLyricsFit()'s comment for why that mismatch happens and why
  // it can't be fixed by CSS alone. No-op (one scrollHeight read) on
  // any device where the probe's number was already right.
  verifyLyricsFit(container, track, dir, wordsHtml, container ? container.clientWidth : 0);
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

  // Fallback for environments without requestIdleCallback (notably
  // Telegram's iOS in-app browser on older iOS/WKWebView versions):
  // a plain setTimeout has no real notion of idle time, so it's
  // handed a small fixed budget instead of a fake unlimited one.
  const hasIdleCallback = typeof requestIdleCallback === "function";
  const schedule = hasIdleCallback
    ? requestIdleCallback
    : (cb => setTimeout(() => cb({ timeRemaining: () => 6, didTimeout: false }), 0));

  let i = 0;

  // Previously this ignored the `deadline` requestIdleCallback hands
  // to its callback and always forced through exactly 4 lines per
  // slot, no matter how little idle time was actually available.
  // Each line can cost up to ~7 synchronous layout passes
  // (measureLyricsFontSize's binary search), so on a busy/weak
  // device that was real, uncapped main-thread work landing in
  // back-to-back callbacks — felt as the phone hanging/slowing down
  // right as a song's lyrics loaded. Now every line checks the
  // remaining idle time first and yields (reschedules) the moment
  // it runs out, so this can never outrun the time the browser
  // actually said was free.
  function step(deadline) {
    if (token !== lyricsPrewarmToken) return; // superseded by a newer song's lines

    const liveContainer = document.getElementById("playerLyrics");
    if (!liveContainer || liveContainer.clientWidth === 0 || liveContainer.clientHeight === 0) {
      return; // box got hidden again meanwhile — stop, openFullPlayer() will resume this
    }

    const hasTime = () =>
      deadline && typeof deadline.timeRemaining === "function"
        ? deadline.timeRemaining() > 0
        : true;

    // Hard cap per slot on top of the deadline check, so a
    // browser that reports a generous/unreliable timeRemaining()
    // still can't process an entire long lyrics file in one go.
    let processed = 0;

    while (i < lines.length && processed < 4 && hasTime()) {
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

  container.appendChild(probe);

  let lo = LYRICS_FONT_MIN;
  let hi = LYRICS_FONT_MAX;
  let best = LYRICS_FONT_MIN;

  // A handful of lines (long lines with several parenthetical asides,
  // e.g. rap ad-libs) don't fit even at LYRICS_FONT_MIN — that's what
  // was overflowing .player-lyrics and clipping into the title/artist
  // row above it. Detect that case up front and search a lower range
  // instead, so those lines always shrink to actually fit the box
  // rather than ever overflowing it.
  probe.style.fontSize = LYRICS_FONT_MIN + "px";
  if (probe.scrollHeight > container.clientHeight + 0.5) {
    lo = LYRICS_FONT_ABSOLUTE_MIN;
    hi = LYRICS_FONT_MIN;
    best = LYRICS_FONT_ABSOLUTE_MIN;
  }

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

// measureLyricsFontSize() sizes text against a detached, offscreen
// probe (position:absolute; left:-9999px) so the binary search's
// several style/scrollHeight round trips never thrash the live,
// animating track — see that function's comment for why that
// separation is what keeps line changes smooth.
//
// The trade-off: on most devices an offscreen probe and the real
// on-screen track render identically at the same font-size, so the
// probe's number is exactly right. But some WKWebView configurations
// (seen with iOS's system "Larger Text" accessibility setting on)
// apply their own text-legibility boost only to text that's actually
// going to be shown on screen — an invisible, offscreen probe doesn't
// get it, the live track does, once it's actually painted. CSS's
// text-size-adjust can't be used to opt out of that particular
// behavior since it isn't the same mechanism the property controls.
// The result: a size that fit perfectly in the probe still overflows
// once the real line is on screen, clipping the top/bottom of the
// text against .player-lyrics's overflow:hidden.
//
// This is the fix for that case specifically: after the line is
// actually painted (requestAnimationFrame, not immediately — the
// boost applies post-layout), check the *live* track's real
// scrollHeight against the container, and if it still overflows,
// shrink the live track directly, in place, until it fits. On a
// device without the quirk this is one scrollHeight read that
// confirms nothing needs to change — no extra layout thrashing on
// the common path. When it does correct something, the corrected
// size is written back into the cache under the same key so the next
// time this exact line comes up (a repeated chorus, or scrolling
// back) skips straight to the right size instead of re-discovering it.
function verifyLyricsFit(container, track, dir, html, width) {
  if (!container || !track) return;

  requestAnimationFrame(() => {
    // The line may have changed again (or the player closed) by the
    // time this frame runs — bail rather than correct stale content.
    if (!track.isConnected || track.innerHTML !== html) return;
    if (container.clientHeight === 0) return;

    let guard = 0;
    let changed = false;

    while (track.scrollHeight > container.clientHeight + 0.5 && guard < 12) {
      const current = parseFloat(track.style.fontSize) || LYRICS_FONT_MIN;
      const next = Math.max(current - 1, LYRICS_FONT_ABSOLUTE_MIN);
      if (next === current) break;
      track.style.fontSize = next + "px";
      changed = true;
      guard++;
    }

    if (changed && width === lyricsFontSizeCacheWidth) {
      lyricsFontSizeCache.set(dir + "|" + html, parseFloat(track.style.fontSize));
    }
  });
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

  verifyLyricsFit(container, track, track.dir, track.innerHTML, container.clientWidth);
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
   LYRIC VIDEO (Stage 1: range picker + static story-frame
   preview only — no animation, audio capture, or sending yet).
   ----------------------------------------------------------------
   Reuses currentLyricsLines (from parseLRC() via buildLyricsList())
   for the selectable lines, and RTL_TEXT_RE for text direction, so
   this stays in sync with whatever lyrics are actually loaded for
   the current song instead of keeping its own copy.
   ========================================================= */

// { start, end } line indices into currentLyricsLines, both null
// until the user has tapped at least one line. start/end are always
// kept in low/high order regardless of tap order — see
// handleLyricVideoLineTap().
let lyricVideoSelection = { start: null, end: null };

// Which marker the next line tap moves — toggled by the
// Set Start / Set End segmented control (#lyricVideoModeToggle).
let lyricVideoMode = "start";

// Cover image for the song the modal was opened for, reloaded (once)
// whenever the modal opens so the preview never draws a stale cover
// from a previously previewed song.
let lyricVideoCoverImg = null;
let lyricVideoCoverSongId = null;

function lyricVideoHasUsableLyrics() {
  return currentLyricsLines.length > 0;
}

// Toggles the ⋯ menu's "Make Lyric Video" entry — only ever shown
// when the song the menu was opened for is both the song currently
// loaded in the player (lyrics are only tracked for that one song)
// and has synced lyrics available.
function updateLyricVideoMenuVisibility(song) {
  const btn = document.getElementById("songActionLyricVideo");
  if (!btn) return;

  const isCurrentSong =
    song &&
    state.currentSong &&
    Number(song.id) === Number(state.currentSong.id);

  btn.classList.toggle(
    "hidden",
    !(isCurrentSong && lyricVideoHasUsableLyrics())
  );
}

// Snapshot of the main player's playback (position + whether it was
// playing) taken the instant the lyric-video modal opens, so it can
// be handed back exactly as the user left it once the modal closes.
// Combined with the audio.pause() below, this is what keeps the
// modal completely silent for its whole time on screen — nothing
// should be audible until the user closes it, regardless of whether
// they're just browsing lines or actually recording a clip.
let lyricVideoModalResumeState = null;

function openLyricVideoModal() {
  if (!state.currentSong || !lyricVideoHasUsableLyrics()) return;

  lyricVideoSelection = { start: null, end: null };
  lyricVideoMode = "start";

  updateLyricVideoModeUI();
  renderLyricVideoLinesList();
  clearLyricVideoPreview();
  loadLyricVideoCoverImage(state.currentSong);
  setLyricVideoSendStatus("idle");

  lyricVideoModalResumeState = {
    time: audio.currentTime,
    wasPlaying: !audio.paused
  };
  audio.pause();

  document
    .getElementById("lyricVideoModal")
    ?.classList.remove("hidden");

  // No live preview runs while picking lines anymore — see the notes
  // on drawLyricVideoPreview() staying hidden behind the placeholder
  // and startLyricVideoRecording() being the only place that now
  // starts the audio graph + animation loop. Setting any of that up
  // here just to sit idle in the background was the actual cause of
  // both the audio glitching and the line taps not registering: a
  // 60fps canvas+Web Audio loop competing with the UI for the main
  // thread the whole time the modal was simply open. Now nothing
  // heavy runs until the user actually taps Send.
}

function closeLyricVideoModal() {
  if (lyricVideoSendStatus === "recording") {
    cancelLyricVideoRecording();
  }

  stopLyricVideoAnimation();

  // Undo the mute from openLyricVideoModal() — restore the monitor
  // gain (see ensureLyricVideoAudioGraph()) so normal playback is
  // audible again everywhere else in the app, then hand the main
  // player back exactly where/how the user left it.
  if (lyricVideoMonitorGain) {
    lyricVideoMonitorGain.gain.value = 1;
  }

  if (lyricVideoModalResumeState) {
    audio.currentTime = lyricVideoModalResumeState.time;
    if (lyricVideoModalResumeState.wasPlaying) {
      audio.play().catch(() => {});
    }
    lyricVideoModalResumeState = null;
  }

  document
    .getElementById("lyricVideoModal")
    ?.classList.add("hidden");
}

function setLyricVideoMode(mode) {
  if (lyricVideoSendStatus === "recording" || lyricVideoSendStatus === "uploading") return;
  lyricVideoMode = mode;
  updateLyricVideoModeUI();
}

function updateLyricVideoModeUI() {
  document
    .getElementById("lyricVideoModeStart")
    ?.classList.toggle("active", lyricVideoMode === "start");

  document
    .getElementById("lyricVideoModeEnd")
    ?.classList.toggle("active", lyricVideoMode === "end");
}

function renderLyricVideoLinesList() {
  const list = document.getElementById("lyricVideoLinesList");
  if (!list) return;

  if (!currentLyricsLines.length) {
    list.innerHTML = `<div class="empty">No synced lyrics for this song.</div>`;
    return;
  }

  list.innerHTML = currentLyricsLines
    .map((line, index) => {
      const text = (line.text || "").trim() || "…";
      const dir = RTL_TEXT_RE.test(text) ? "rtl" : "ltr";

      return `
        <button
          type="button"
          class="lyric-video-line"
          dir="${dir}"
          data-index="${index}"
        >
          <span>${escapeHTML(text)}</span>
        </button>
      `;
    })
    .join("");

  list.querySelectorAll(".lyric-video-line").forEach(el => {
    el.addEventListener("click", () => {
      handleLyricVideoLineTap(Number(el.dataset.index));
    });
  });

  updateLyricVideoLinesUI();
}

function handleLyricVideoLineTap(index) {
  if (lyricVideoSendStatus === "recording" || lyricVideoSendStatus === "uploading") return;

  if (lyricVideoMode === "start") {
    const end =
      lyricVideoSelection.end === null
        ? index
        : Math.max(index, lyricVideoSelection.end);

    lyricVideoSelection = { start: Math.min(index, end), end };

    // Once a start is placed on a fresh (single-line) selection, the
    // natural next tap is the end line, so auto-advance the mode —
    // but only for that first tap. Re-tapping Start later to adjust
    // an already two-line range shouldn't keep bouncing back to End.
    if (lyricVideoSelection.start === lyricVideoSelection.end) {
      setLyricVideoMode("end");
    }
  } else {
    const start =
      lyricVideoSelection.start === null
        ? index
        : Math.min(index, lyricVideoSelection.start);

    lyricVideoSelection = { start, end: Math.max(index, start) };
  }

  updateLyricVideoLinesUI();
  updateLyricVideoSendButtonEnabled();
}

function updateLyricVideoLinesUI() {
  const { start, end } = lyricVideoSelection;

  document
    .querySelectorAll("#lyricVideoLinesList .lyric-video-line")
    .forEach(el => {
      const index = Number(el.dataset.index);

      const inRange =
        start !== null && end !== null && index >= start && index <= end;

      const isEdge = index === start || index === end;

      el.classList.toggle("in-range", inRange);
      el.classList.toggle("is-edge", start !== null && isEdge);

      const existingMarker = el.querySelector(".lyric-video-line-marker");
      if (existingMarker) existingMarker.remove();

      if (start !== null && index === start) {
        el.insertAdjacentHTML(
          "beforeend",
          `<span class="lyric-video-line-marker">START</span>`
        );
      } else if (end !== null && index === end && end !== start) {
        el.insertAdjacentHTML(
          "beforeend",
          `<span class="lyric-video-line-marker">END</span>`
        );
      }
    });
}

function loadLyricVideoCoverImage(song) {
  const coverUrl = song.cover_url ? resolveCoverUrl(song.cover_url) : null;

  if (!coverUrl) {
    lyricVideoCoverImg = null;
    lyricVideoCoverSongId = song.id;
    drawLyricVideoPreview();
    return;
  }

  if (lyricVideoCoverSongId === song.id && lyricVideoCoverImg) {
    drawLyricVideoPreview();
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    // Modal may have been reopened for a different song while this
    // was loading — a stale image would draw the wrong cover.
    if (!state.currentSong || state.currentSong.id !== song.id) return;

    lyricVideoCoverImg = img;
    lyricVideoCoverSongId = song.id;
    drawLyricVideoPreview();
  };

  img.onerror = () => {
    lyricVideoCoverImg = null;
    lyricVideoCoverSongId = song.id;
    drawLyricVideoPreview();
  };

  img.src = coverUrl;
}

function clearLyricVideoPreview() {
  const canvas = document.getElementById("lyricVideoCanvas");
  const empty = document.getElementById("lyricVideoPreviewEmpty");

  if (canvas) {
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  empty?.classList.remove("hidden");
}

// Same Poppins/Vazirmatn split the live lyrics ticker uses (see
// .player-lyrics-track / .player-lyrics-track[dir="rtl"] in
// style.css) — kept in sync here so the exported frame reads exactly
// like the in-app lyrics.
function lyricVideoFontFamily(dir) {
  return dir === "rtl"
    ? `"Vazirmatn", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`
    : `"Poppins", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`;
}

// How long the very last word/line of the selection stays lit after
// its own timestamp, since (unlike every earlier word) it has no
// "next word" to mark where its highlight should end.
const LYRIC_VIDEO_TAIL_SECONDS = 2.2;

// Nothing capped how far apart the picked start/end lines could be —
// pick lines from opposite ends of a song and the "clip" was really
// the whole track, so recording (and the eventual upload) took that
// long with zero feedback in the UI, which just looked frozen on
// "Recording…" for however long that turned out to be. This is a
// hard ceiling on the recorded clip itself, applied in
// startLyricVideoRecording() regardless of the selected lines' own
// timestamps. 60s was picked as generous headroom for a real
// multi-line selection while still landing well under both Telegram's
// ~50MB bot upload limit and LYRIC_VIDEO_MAX_BYTES in worker.js — at
// this canvas's 2.5Mbps video + ~128kbps audio, a full 60s clip is
// roughly (2.5 + .128) * 60 / 8 ≈ 20MB, nowhere near either limit. A
// shorter 20s cap once lived here but cut a genuinely longer
// selection off before its own picked end line, instead of just
// guarding against an unbounded one.
const LYRIC_VIDEO_MAX_DURATION_SECONDS = 60;

// Builds the karaoke tokens for one lyric line. When enhanced LRC
// gave this line per-word timing (line.words), each word is its own
// token so it lights up individually. Otherwise every plain word in
// the line becomes a token sharing the *same* [line.time, nextTime)
// window, so wrapping still works but the whole line highlights as
// one unit — the line-level fallback promised for non-enhanced LRC.
function buildLyricVideoLineTokens(line, nextTime) {
  if (line.words && line.words.length) {
    return line.words.map((word, i) => ({
      text: word.text,
      start: word.time,
      end: line.words[i + 1] ? line.words[i + 1].time : nextTime
    }));
  }

  return (line.text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(text => ({ text, start: line.time, end: nextTime }));
}

// Greedy-wraps already-built tokens (see buildLyricVideoLineTokens)
// to `maxWidth` at whatever font is currently set on `ctx`, same
// idea as a plain text word-wrap but keeping each token's own
// start/end so per-token coloring survives the wrap.
function wrapLyricVideoTokens(ctx, tokens, maxWidth) {
  const rows = [];
  let current = [];
  let currentWidth = 0;

  for (const token of tokens) {
    const width = ctx.measureText(`${token.text} `).width;

    if (current.length && currentWidth + width > maxWidth) {
      rows.push({ tokens: current, width: currentWidth });
      current = [];
      currentWidth = 0;
    }

    current.push({ ...token, width });
    currentWidth += width;
  }

  if (current.length) rows.push({ tokens: current, width: currentWidth });
  return rows;
}

// Lays out the whole selected range at `fontSize`: one or more
// wrapped rows per original lyric line (lines are never merged into
// each other's wrap, so a short second line never runs on to the
// end of a long first line). Each row also carries its own text
// direction, since a mixed-language selection is possible.
function buildLyricVideoLayout(ctx, fontSize, maxWidth) {
  const { start, end } = lyricVideoSelection;
  if (start === null || end === null) return [];

  const rows = [];

  for (let i = start; i <= end; i++) {
    const line = currentLyricsLines[i];
    const nextTime =
      i < end
        ? currentLyricsLines[i + 1].time
        : line.time + LYRIC_VIDEO_TAIL_SECONDS;

    const dir = RTL_TEXT_RE.test(line.text || "") ? "rtl" : "ltr";
    ctx.font = `800 ${fontSize}px ${lyricVideoFontFamily(dir)}`;

    const tokens = buildLyricVideoLineTokens(line, nextTime);
    wrapLyricVideoTokens(ctx, tokens, maxWidth).forEach(row => {
      rows.push({ ...row, dir });
    });
  }

  return rows;
}

// Largest font size (within [min, max]) whose buildLyricVideoLayout()
// row count still fits maxHeight, using canvas's own measureText
// rather than DOM layout — this canvas is never mounted in the page,
// so the DOM-based measureLyricsFontSize() the live ticker uses
// doesn't apply here.
function fitLyricVideoFontSize(ctx, maxWidth, maxHeight, min, max) {
  let best = min;

  for (let size = max; size >= min; size -= 2) {
    const rows = buildLyricVideoLayout(ctx, size, maxWidth);
    const totalHeight = rows.length * (size * 1.32);

    if (totalHeight <= maxHeight) {
      best = size;
      break;
    }
  }

  return best;
}

function drawLyricVideoLyricRows(ctx, rows, fontSize, centerX, startY) {
  const lineHeight = fontSize * 1.32;
  const t = audio.currentTime;

  rows.forEach((row, rowIndex) => {
    const y = startY + rowIndex * lineHeight;
    ctx.font = `800 ${fontSize}px ${lyricVideoFontFamily(row.dir)}`;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 18;

    if (row.dir === "rtl") {
      ctx.textAlign = "right";
      let cursor = centerX + row.width / 2;

      row.tokens.forEach(token => {
        ctx.fillStyle = lyricVideoTokenColor(token, t);
        ctx.fillText(`${token.text} `, cursor, y);
        cursor -= token.width;
      });
    } else {
      ctx.textAlign = "left";
      let cursor = centerX - row.width / 2;

      row.tokens.forEach(token => {
        ctx.fillStyle = lyricVideoTokenColor(token, t);
        ctx.fillText(`${token.text} `, cursor, y);
        cursor += token.width;
      });
    }
  });

  ctx.shadowBlur = 0;
}

// Sung → full white, currently-active word → the app's lavender
// accent (--accent-glow: rgba(178,160,219,.55) in style.css, used at
// full strength here), upcoming → dimmed white. Same three-state
// progression as Spotify/Apple Music-style karaoke captions.
function lyricVideoTokenColor(token, currentTime) {
  if (currentTime >= token.end) return "rgba(255,255,255,1)";
  if (currentTime >= token.start) return "rgb(178,160,219)";
  return "rgba(255,255,255,.42)";
}

// --- Perf caches for drawLyricVideoPreview() ---
// Everything in this modal used to be rebuilt from scratch on every
// single requestAnimationFrame (60x/sec): a 28px canvas blur over the
// full 720x1280 background, plus fitLyricVideoFontSize() re-running
// buildLyricVideoLayout() — itself doing a fresh ctx.measureText() per
// word — up to 18 times just to pick a font size. None of that
// actually depends on time; only the karaoke word colors do. Doing it all every frame pegs the main thread,
// which is what was making lyric line taps stop registering and (by
// starving the audio pipeline of a responsive main thread) was also
// the source of the audio glitching. Now the background + layout are
// computed once and reused until something that actually changes them
// (cover image, selection, canvas size) changes.
let lyricVideoBgCanvas = null;
let lyricVideoBgKey = null;

let lyricVideoLayoutCache = { key: null, fontSize: 26, rows: [] };

function getLyricVideoBackground(w, h) {
  const song = state.currentSong;
  const key = [
    lyricVideoCoverImg ? lyricVideoCoverSongId : "none",
    w,
    h,
    song?.title || "",
    song?.artist || ""
  ].join("|");

  if (lyricVideoBgCanvas && lyricVideoBgKey === key) {
    return lyricVideoBgCanvas;
  }

  const bg =
    lyricVideoBgCanvas && lyricVideoBgCanvas.width === w && lyricVideoBgCanvas.height === h
      ? lyricVideoBgCanvas
      : (typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(w, h)
          : Object.assign(document.createElement("canvas"), { width: w, height: h }));

  bg.width = w;
  bg.height = h;

  const ctx = bg.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  // Background: blurred, cover-fit cropped cover art, or a plain
  // dark gradient fallback when no cover is available/loaded yet.
  // The blur filter is expensive, so (unlike before) it now only
  // runs when this cached layer is rebuilt, not on every frame.
  if (lyricVideoCoverImg) {
    ctx.save();
    ctx.filter = "blur(28px) brightness(.55)";

    const scale = Math.max(
      w / lyricVideoCoverImg.width,
      h / lyricVideoCoverImg.height
    ) * 1.15; // slight overscan so the blur never shows a hard edge

    const dw = lyricVideoCoverImg.width * scale;
    const dh = lyricVideoCoverImg.height * scale;

    ctx.drawImage(
      lyricVideoCoverImg,
      (w - dw) / 2,
      (h - dh) / 2,
      dw,
      dh
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "#141118";
    ctx.fillRect(0, 0, w, h);
  }

  // Top/bottom gradient so the visualizer, lyric text, and footer
  // all stay legible over any cover.
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(0,0,0,.45)");
  gradient.addColorStop(.3, "rgba(0,0,0,.15)");
  gradient.addColorStop(.75, "rgba(0,0,0,.55)");
  gradient.addColorStop(1, "rgba(0,0,0,.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Footer branding: song title + artist. Static per song, so it's
  // baked into the cached layer too instead of being redrawn per frame.
  if (song) {
    const titleDir = RTL_TEXT_RE.test(song.title || "") ? "rtl" : "ltr";
    const artistDir = RTL_TEXT_RE.test(song.artist || "") ? "rtl" : "ltr";

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowBlur = 0;

    ctx.direction = titleDir;
    ctx.font = `800 26px ${lyricVideoFontFamily(titleDir)}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(song.title || "", w / 2, h - 96);

    ctx.direction = artistDir;
    ctx.font = `600 20px ${lyricVideoFontFamily(artistDir)}`;
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fillText(song.artist || "", w / 2, h - 60);
  }

  lyricVideoBgCanvas = bg;
  lyricVideoBgKey = key;
  return bg;
}

function getLyricVideoLayout(ctx, maxWidth, maxHeight) {
  const { start, end } = lyricVideoSelection;
  const key = `${start}|${end}|${maxWidth}|${maxHeight}`;

  if (lyricVideoLayoutCache.key === key) {
    return lyricVideoLayoutCache;
  }

  const fontSize = fitLyricVideoFontSize(ctx, maxWidth, maxHeight, 26, 60);
  const rows = buildLyricVideoLayout(ctx, fontSize, maxWidth);

  lyricVideoLayoutCache = { key, fontSize, rows };
  return lyricVideoLayoutCache;
}

function drawLyricVideoPreview() {
  const canvas = document.getElementById("lyricVideoCanvas");
  if (!canvas) return;

  const { start, end } = lyricVideoSelection;

  if (start === null || end === null) {
    clearLyricVideoPreview();
    return;
  }

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(getLyricVideoBackground(w, h), 0, 0);

  // Lyric text — karaoke-highlighted, wrapped per original line.
  // Layout (font size, wrapping) is cached; only word colors change
  // per frame, driven by audio.currentTime.
  const padding = w * .1;
  const maxWidth = w - padding * 2;
  const maxHeight = h * .4;

  const { fontSize, rows } = getLyricVideoLayout(ctx, maxWidth, maxHeight);
  const lineHeight = fontSize * 1.32;
  const blockHeight = rows.length * lineHeight;
  const startY = h / 2 - blockHeight / 2 + lineHeight / 2;

  drawLyricVideoLyricRows(ctx, rows, fontSize, w / 2, startY);
  drawLyricVideoWatermark(ctx, w, h);
  // Note: the "empty" placeholder over the canvas is intentionally
  // left as-is here (see the status line + placeholder handling in
  // startLyricVideoRecording()/setLyricVideoSendStatus()) — this
  // function only ever runs now while a clip is actively being
  // captured for recording, and the raw live frames it draws aren't
  // meant to be shown to the user; they only see the status text
  // ("Recording…" → "Sending…" → "Sent ✓") until the result is ready.
}

// Small brand mark near the bottom of every recorded clip, so a
// forwarded/re-shared video is still recognizable as having come from
// the bot — same all-caps treatment as the in-app header (see
// .brand in index.html), just dimmed enough not to compete with the
// lyric text above it.
function drawLyricVideoWatermark(ctx, w, h) {
  ctx.save();
  ctx.font = `700 ${Math.round(w * .032)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillText("WHITE PLAYLIST", w / 2, h - h * .035);
  ctx.restore();
}

/* --- Live audio graph + animation loop ---
   The waveform feature above decodes a *separate* fetched copy of
   each song, deliberately never touching the actual <audio> element
   — because a media element can only ever be handed to
   createMediaElementSource() ONCE in its whole lifetime (a hard
   platform restriction, not a bug), and doing so permanently reroutes
   its output through the Web Audio graph. This graph exists purely so
   a recording can tap a MediaStreamDestination off the real playing
   audio (see ensureLyricVideoStreamDestination()); the source node is
   wired straight through to the speakers so normal playback stays
   audible everywhere in the app, not just here. */

let lyricVideoAudioCtx = null;
let lyricVideoAudioGraphReady = false;
let lyricVideoSourceNode = null;

// A GainNode that sits only in the path to the speakers. The
// recording tap in ensureLyricVideoStreamDestination() connects
// straight off lyricVideoSourceNode instead, bypassing this node
// entirely — so muting it (see startLyricVideoRecording() and
// closeLyricVideoModal()) silences what the user hears without
// touching the audio actually captured into the clip.
let lyricVideoMonitorGain = null;

function ensureLyricVideoAudioGraph() {
  if (lyricVideoAudioGraphReady) return true;

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;

    // latencyHint: "playback" tells the browser to favor a stable,
    // glitch-free buffer over low latency — this graph only ever
    // feeds the recording, never anything the user needs to react to
    // in real time, so there's no reason to ask for the small,
    // easy-to-underrun buffers "interactive" (the default) would use.
    // Smaller buffers were part of what made playback crackle once
    // this graph was live.
    lyricVideoAudioCtx = new Ctx({ latencyHint: "playback" });

    lyricVideoSourceNode = lyricVideoAudioCtx.createMediaElementSource(audio);

    lyricVideoMonitorGain = lyricVideoAudioCtx.createGain();
    // Starts muted: the only playback this graph ever drives is the
    // silent-to-the-user capture pass inside startLyricVideoRecording()
    // — closeLyricVideoModal() is what turns it back up once the modal
    // is done, for normal listening afterward.
    lyricVideoMonitorGain.gain.value = 0;
    lyricVideoSourceNode.connect(lyricVideoMonitorGain);
    lyricVideoMonitorGain.connect(lyricVideoAudioCtx.destination);

    lyricVideoAudioGraphReady = true;
    return true;
  } catch (err) {
    console.error("Lyric video audio graph:", err);
    return false;
  }
}

let lyricVideoAnimationFrame = null;

// Now that drawLyricVideoPreview() reuses cached background/layout
// (see getLyricVideoBackground()/getLyricVideoLayout() above), a full
// 60fps loop is no longer needed — the karaoke coloring reads fine at
// ~30fps, and capping it here leaves more main thread headroom for
// taps on the lyric line list and for audio.
const LYRIC_VIDEO_FRAME_INTERVAL_MS = 1000 / 30;

function startLyricVideoAnimation() {
  stopLyricVideoAnimation();

  let lastT = 0;

  const loop = t => {
    if (t - lastT >= LYRIC_VIDEO_FRAME_INTERVAL_MS) {
      lastT = t;
      drawLyricVideoPreview();
    }
    lyricVideoAnimationFrame = requestAnimationFrame(loop);
  };

  lyricVideoAnimationFrame = requestAnimationFrame(loop);
}

function stopLyricVideoAnimation() {
  if (lyricVideoAnimationFrame) {
    cancelAnimationFrame(lyricVideoAnimationFrame);
    lyricVideoAnimationFrame = null;
  }
}

/* --- Recording (MediaRecorder) + sending to the chat ---
   Captures exactly what's already being drawn/played — the same
   canvas frames the live preview above draws, and the same <audio>
   element's real playback — for the selected line range, then hands
   the finished file to the Worker's /lyric-video endpoint, which
   relays it to Telegram's sendVideo (see sendLyricVideo() in
   worker.js). Nothing is re-rendered server-side; the clip Telegram
   ends up sending is byte-for-byte what MediaRecorder produced here. */

// A second, parallel tap off the same MediaElementAudioSourceNode
// used for the analyser (lyricVideoSourceNode) — one node can feed
// multiple destinations, so this doesn't disturb normal playback.
// Created lazily, once, the first time a recording actually starts.
let lyricVideoStreamDest = null;

let lyricVideoRecorder = null;
let lyricVideoRecordChunks = [];
let lyricVideoRecordStopTimer = null;
let lyricVideoRecordProgressTimer = null;
let lyricVideoRecordMimeType = null;

// { time, wasPlaying } snapshot of playback taken right before a
// recording scrubs the audio to the clip's start, so it can be put
// back exactly where the user left it once the recording is done —
// recording a clip shouldn't leave their actual listening position
// disturbed.
let lyricVideoResumeState = null;

// idle | recording | uploading | sent | error — drives both the
// send button's label/disabled state and the status line under the
// preview (see setLyricVideoSendStatus()).
let lyricVideoSendStatus = "idle";

function ensureLyricVideoStreamDestination() {
  if (lyricVideoStreamDest) return lyricVideoStreamDest;
  if (!lyricVideoAudioGraphReady || !lyricVideoSourceNode) return null;

  lyricVideoStreamDest = lyricVideoAudioCtx.createMediaStreamDestination();
  lyricVideoSourceNode.connect(lyricVideoStreamDest);
  return lyricVideoStreamDest;
}

function pickLyricVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return null;

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    // Safari/WebKit (iOS and macOS) never supports video/webm in
    // MediaRecorder — isTypeSupported() returns false for every
    // candidate above, every time. Without an mp4 fallback here,
    // pickLyricVideoMimeType() returned null on every iPhone, which
    // startLyricVideoRecording() treats as a hard failure before a
    // single frame is ever captured — that's what was surfacing as
    // "Something went wrong sending the video." on iOS.
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4"
  ];

  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || null;
}

// The filename/extension sent along with the recorded blob has to
// match what MediaRecorder actually produced (see pickLyricVideoMimeType()
// above) — Telegram uses the extension to decide how to process the
// upload, so labeling an mp4 file "lyric-video.webm" (or vice versa)
// can make sendVideo choke even though the bytes themselves are fine.
function lyricVideoFileName(mimeType) {
  const ext = mimeType && mimeType.includes("mp4") ? "mp4" : "webm";
  return `lyric-video.${ext}`;
}

function updateLyricVideoSendButtonEnabled() {
  const btn = document.getElementById("lyricVideoSendButton");
  if (!btn) return;

  const hasSelection =
    lyricVideoSelection.start !== null && lyricVideoSelection.end !== null;

  btn.disabled = !hasSelection || lyricVideoSendStatus === "recording" || lyricVideoSendStatus === "uploading";
}

function setLyricVideoSendStatus(nextStatus, detail) {
  lyricVideoSendStatus = nextStatus;

  const btn = document.getElementById("lyricVideoSendButton");
  const statusEl = document.getElementById("lyricVideoStatus");

  const labels = {
    idle: "Send to Chat",
    recording: "Recording…",
    uploading: "Sending…",
    sent: "Sent ✓",
    error: "Couldn't Send — Try Again"
  };

  const statusText = {
    idle: "",
    recording: "Recording the clip — leave this open…",
    uploading: "Sending to your chat…",
    sent: "Sent! Check your chat with the bot.",
    // A specific reason (passed in from uploadLyricVideo()'s catch,
    // forwarded from the server/Telegram) takes over here when we
    // have one — falls back to this generic line only when we don't.
    error: detail || "Something went wrong sending the video."
  };

  if (btn) btn.textContent = labels[nextStatus] || labels.idle;

  if (statusEl) {
    statusEl.textContent = statusText[nextStatus] || "";
    statusEl.classList.toggle("is-error", nextStatus === "error");
    statusEl.classList.toggle("is-sent", nextStatus === "sent");
  }

  updateLyricVideoSendButtonEnabled();
}

function startLyricVideoRecording() {
  if (lyricVideoSendStatus === "recording" || lyricVideoSendStatus === "uploading") return;

  const { start, end } = lyricVideoSelection;
  if (start === null || end === null) return;

  if (!ensureLyricVideoAudioGraph()) {
    setLyricVideoSendStatus("error");
    return;
  }

  // Also needs the cover art in place before the first captured
  // frame — normally loaded when the modal opened, but do it here
  // too in case it's still pending (a slow network, say) since the
  // preview canvas was never drawn until now.
  loadLyricVideoCoverImage(state.currentSong);

  const streamDest = ensureLyricVideoStreamDestination();
  const mimeType = pickLyricVideoMimeType();
  const canvas = document.getElementById("lyricVideoCanvas");

  if (!streamDest || !mimeType || !canvas || typeof canvas.captureStream !== "function") {
    setLyricVideoSendStatus("error");
    return;
  }

  const firstLine = currentLyricsLines[start];
  const lastLine = currentLyricsLines[end];
  const recordStart = Math.max(0, firstLine.time - .2);
  const recordEnd = Math.min(
    lastLine.time + LYRIC_VIDEO_TAIL_SECONDS,
    recordStart + LYRIC_VIDEO_MAX_DURATION_SECONDS
  );
  const durationMs = Math.max(500, (recordEnd - recordStart) * 1000);

  lyricVideoResumeState = {
    time: audio.currentTime,
    wasPlaying: !audio.paused
  };

  const videoStream = canvas.captureStream(30);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...streamDest.stream.getAudioTracks()
  ]);

  lyricVideoRecordChunks = [];
  lyricVideoRecordMimeType = mimeType;

  let recorder;
  try {
    recorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: 2_500_000
    });
  } catch (err) {
    console.error("Lyric video recorder:", err);
    setLyricVideoSendStatus("error");
    return;
  }

  lyricVideoRecorder = recorder;

  recorder.ondataavailable = event => {
    if (event.data && event.data.size) lyricVideoRecordChunks.push(event.data);
  };

  recorder.onstop = () => {
    clearTimeout(lyricVideoRecordStopTimer);
    lyricVideoRecordStopTimer = null;
    stopLyricVideoRecordProgress();

    stopLyricVideoAnimation();
    restoreLyricVideoPlaybackState();

    const chunks = lyricVideoRecordChunks;
    lyricVideoRecordChunks = [];

    if (!chunks.length) {
      setLyricVideoSendStatus("error");
      return;
    }

    const blob = new Blob(chunks, { type: lyricVideoRecordMimeType });
    uploadLyricVideo(blob);
  };

  recorder.onerror = event => {
    console.error("Lyric video recorder error:", event.error);
    stopLyricVideoRecordProgress();
    stopLyricVideoAnimation();
    restoreLyricVideoPlaybackState();
    setLyricVideoSendStatus("error");
  };

  setLyricVideoSendStatus("recording");
  audio.pause();

  let seekHandled = false;

  const beginCaptureAndPlay = async () => {
    if (seekHandled) return;
    seekHandled = true;
    audio.removeEventListener("seeked", beginCaptureAndPlay);

    if (lyricVideoSendStatus !== "recording") return; // cancelled meanwhile

    // A freshly created AudioContext very often starts "suspended" on
    // iOS Safari — nothing enforced this ever getting resumed. Without
    // it, audio.play() can end up capturing into a silent/suspended
    // graph for some initial stretch, then catch up once the browser
    // gets around to resuming it on its own — which is exactly the
    // kind of gap that shows up in the finished clip as a cut-off
    // start, audio that comes in sped-up/pitched-up, and lyric timing
    // that no longer lines up with it. Resolving this *before*
    // recorder.start()/audio.play() run means the graph is actually
    // flowing from the very first captured frame.
    if (lyricVideoAudioCtx && lyricVideoAudioCtx.state === "suspended") {
      try {
        await lyricVideoAudioCtx.resume();
      } catch (err) {
        console.error("Lyric video audio context resume:", err);
      }
    }

    if (lyricVideoSendStatus !== "recording") return; // cancelled while resuming

    recorder.start();
    audio.play().catch(err => console.error("Lyric video playback:", err));

    // The animation loop (see startLyricVideoAnimation()) only runs
    // for this bounded capture window now, not for as long as the
    // modal happens to be open — it's what keeps drawLyricVideoPreview()
    // actually redrawing the canvas each frame so captureStream(30)
    // has moving frames (the karaoke highlight) to record instead of
    // one frozen frame repeated for the whole clip.
    startLyricVideoAnimation();

    // A ticking "Recording… Xs / Ys" readout — without this, a
    // legitimately multi-second clip and a genuinely stuck recording
    // looked identical to the user: the same static "Recording the
    // clip — leave this open…" line the entire time either way.
    startLyricVideoRecordProgress(durationMs);

    lyricVideoRecordStopTimer = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, durationMs);
  };

  audio.addEventListener("seeked", beginCaptureAndPlay);
  audio.currentTime = recordStart;

  // Some browsers don't fire "seeked" for a very small time delta —
  // a short fallback timer guarantees recording still starts either
  // way, instead of silently hanging on "Recording…" forever.
  setTimeout(beginCaptureAndPlay, 400);
}

// Ticks the status line under the Send button while a clip is being
// captured, so the modal never looks frozen even during a
// legitimately long (up to LYRIC_VIDEO_MAX_DURATION_SECONDS) clip.
function startLyricVideoRecordProgress(durationMs) {
  const statusEl = document.getElementById("lyricVideoStatus");
  if (!statusEl) return;

  const startedAt = performance.now();
  const totalSeconds = Math.ceil(durationMs / 1000);

  const tick = () => {
    const elapsedSeconds = Math.min(
      totalSeconds,
      Math.floor((performance.now() - startedAt) / 1000)
    );
    statusEl.textContent = `Recording… ${elapsedSeconds}s / ${totalSeconds}s`;
  };

  tick();
  lyricVideoRecordProgressTimer = setInterval(tick, 250);
}

function stopLyricVideoRecordProgress() {
  if (lyricVideoRecordProgressTimer) {
    clearInterval(lyricVideoRecordProgressTimer);
    lyricVideoRecordProgressTimer = null;
  }
}

function restoreLyricVideoPlaybackState() {
  if (!lyricVideoResumeState) return;

  audio.pause();
  audio.currentTime = lyricVideoResumeState.time;
  if (lyricVideoResumeState.wasPlaying) {
    audio.play().catch(() => {});
  }

  lyricVideoResumeState = null;
}

// Stops an in-progress recording without sending anything — used
// when the modal is closed mid-recording (see closeLyricVideoModal()).
function cancelLyricVideoRecording() {
  if (lyricVideoRecordStopTimer) {
    clearTimeout(lyricVideoRecordStopTimer);
    lyricVideoRecordStopTimer = null;
  }
  stopLyricVideoRecordProgress();

  if (lyricVideoRecorder && lyricVideoRecorder.state !== "inactive") {
    lyricVideoRecorder.onstop = null;
    lyricVideoRecorder.onerror = null;
    lyricVideoRecorder.stop();
  }

  lyricVideoRecordChunks = [];
  stopLyricVideoAnimation();
  restoreLyricVideoPlaybackState();
  setLyricVideoSendStatus("idle");
}

async function uploadLyricVideo(blob) {
  setLyricVideoSendStatus("uploading");

  try {
    const formData = new FormData();
    formData.append("video", blob, lyricVideoFileName(lyricVideoRecordMimeType));
    if (state.currentSong?.id != null) {
      formData.append("song_id", state.currentSong.id);
    }

    const headers = {};
    if (state.userId) headers["X-Telegram-User-Id"] = state.userId;

    // A raw fetch (not the api() helper) — api() always sets
    // Content-Type: application/json for any request with a body,
    // which would break this multipart upload's boundary.
    const response = await fetch(`${API}/lyric-video`, {
      method: "POST",
      headers,
      body: formData
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !data.success) {
      throw new Error((data && data.error) || `Upload failed (${response.status})`);
    }

    setLyricVideoSendStatus("sent");
  } catch (err) {
    console.error("Lyric video upload:", err);
    // Show the actual reason (surfaced from the server/Telegram by
    // sendLyricVideo() in worker.js) instead of a fixed generic
    // string every time — a repeated failure needs a repeated
    // "couldn't send" state either way, but a real message makes the
    // next one diagnosable instead of another guess.
    setLyricVideoSendStatus("error", err?.message);
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
    return ICONS.music;
  }

  const safeAlt = escapeHTML(altText || "Album cover");
  const safeSrc = escapeHTML(coverUrl);

  return `
    <img
      class="cover-art"
      src="${safeSrc}"
      alt="${safeAlt}"
      loading="lazy"
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
  const wrapper = document.createElement("div");
  wrapper.innerHTML = ICONS.music.trim();
  const svg = wrapper.firstElementChild;
  if (svg) svg.setAttribute("aria-hidden", "true");
  img.replaceWith(svg || wrapper);
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

  container.innerHTML = ICONS.music;
}


