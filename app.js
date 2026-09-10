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
      openArtist(Number(button.dataset.artistId));
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

  const songs = state.songs
    .filter(song =>
      Number(song.artist_id) === Number(topArtist.id) &&
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
        data-artist-id="${artist.id}"
      >
        <div class="library-icon">
          ${ICONS.artist}
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
      openArtist(Number(button.dataset.artistId));
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
      <div class="detail-header">
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
      openAlbum(Number(button.dataset.albumId));
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
    });

  audio.addEventListener("play", () => {
    state.isPlaying = true;
    updatePlayButtons();
  });

  audio.addEventListener("pause", () => {
    state.isPlaying = false;
    updatePlayButtons();
  });

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateDuration);
  audio.addEventListener("ended", handleSongEnded);

  // New, additive setup for the waveform + lyrics UI. Fully
  // independent of everything above.
  setupWaveformInteraction();
  setupLyricsToggle();
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

function updatePlayerUI() {
  if (!state.currentSong) return;

  const song = state.currentSong;

  const title = song.title || "Unknown";
  const artist = song.artist || "Unknown Artist";

  document.getElementById("miniTitle").textContent = title;
  document.getElementById("miniArtist").textContent = artist;
  document.getElementById("playerTitle").textContent = title;
  document.getElementById("playerArtist").textContent = artist;

  setCoverArt(
    "miniCover",
    song.cover_url,
    title,
    "𝄞",
    "restoreMiniCoverPlaceholder"
  );

  setCoverArt(
    "playerCover",
    song.cover_url,
    title,
    `<div class="player-cover-symbol" aria-hidden="true">𝄞</div>`,
    "restorePlayerCoverPlaceholder"
  );

  miniPlayer.classList.remove("hidden");

  updatePlayerLike();
  updatePlayButtons();
  highlightPlayingRow();

  // New, additive features — each is fully independent and safely
  // no-ops/falls back on its own if it fails (see each function).
  generateWaveform(song);
  applyCoverColor(song);
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

  // Canvas needs real layout dimensions to draw crisply; the wrap is
  // 0-width while the overlay is hidden, so (re)size once it's visible.
  resizeWaveformCanvas();
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

  // Additive hooks for the new features below — both are no-ops
  // until a waveform/lyrics set has actually loaded for this song.
  drawWaveformProgress(audio.currentTime / audio.duration);
  syncLyrics(audio.currentTime);
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

// Sets the mini player / full player cover container to either the
// real cover art (with fallback restoration on error) or the exact
// original placeholder markup, unchanged.
function setCoverArt(containerId, coverUrl, altText, placeholderHTML, errorHandlerName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!coverUrl) {
    container.innerHTML = placeholderHTML;
    return;
  }

  const safeAlt = escapeHTML(altText || "Album cover");
  const safeSrc = escapeHTML(coverUrl);

  container.innerHTML = `
    <img
      class="cover-art"
      src="${safeSrc}"
      alt="${safeAlt}"
      decoding="async"
      onload="this.classList.add('cover-art-loaded')"
      onerror="${errorHandlerName}(this)"
    />
  `;
}

function restoreMiniCoverPlaceholder() {
  const container = document.getElementById("miniCover");
  if (container) {
    container.innerHTML = "𝄞";
  }
}

function restorePlayerCoverPlaceholder() {
  const container = document.getElementById("playerCover");
  if (container) {
    container.innerHTML =
      `<div class="player-cover-symbol" aria-hidden="true">𝄞</div>`;
  }
}

/* =========================================================
   REAL AUDIO WAVEFORM
   ---------------------------------------------------------
   Decodes the actual song file in-browser (Web Audio API) into a
   small set of peak values and draws them on a canvas that sits on
   top of the existing #progress range input. #progress itself is
   completely untouched functionally — dragging it still fires its
   original "input" listener — it just becomes visually transparent
   once real peaks are available. If decoding ever fails (unsupported
   browser, network error, CORS hiccup) the canvas simply never gets
   the "has-waveform" class and the original gradient bar is what the
   user sees, exactly as before this feature existed.
   ========================================================= */

const WAVEFORM_BAR_COUNT = 110;

const waveform = {
  peaks: null,
  ready: false,
  songId: null,
  token: 0
};

let waveformAudioCtx = null;
let waveformCanvasSize = { width: 0, height: 0, dpr: 1 };

function getAudioContextClass() {
  return window.AudioContext || window.webkitAudioContext || null;
}

function decodeAudioBuffer(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    // decodeAudioData supports both the modern Promise-based form and
    // the legacy callback form (older Safari); this covers both.
    const maybePromise =
      ctx.decodeAudioData(arrayBuffer, resolve, reject);

    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(resolve, reject);
    }
  });
}

function computePeaks(audioBuffer, bucketCount) {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize =
    Math.max(1, Math.floor(channelData.length / bucketCount));

  const peaks = new Float32Array(bucketCount);

  for (let i = 0; i < bucketCount; i++) {
    const start = i * blockSize;
    const end = Math.min(channelData.length, start + blockSize);

    let max = 0;
    for (let j = start; j < end; j++) {
      const value = Math.abs(channelData[j]);
      if (value > max) max = value;
    }

    peaks[i] = max;
  }

  let maxPeak = 0;
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > maxPeak) maxPeak = peaks[i];
  }

  if (maxPeak > 0) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] = peaks[i] / maxPeak;
    }
  }

  return peaks;
}

async function generateWaveform(song) {
  const token = ++waveform.token;

  waveform.ready = false;
  waveform.peaks = null;
  waveform.songId = song.id;

  const wrap = document.getElementById("waveformWrap");
  if (wrap) wrap.classList.remove("has-waveform");

  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return; // Unsupported browser: silent fallback.

  try {
    const src =
      `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;

    const response = await fetch(src);
    if (!response.ok) throw new Error("Audio fetch failed for waveform");

    const arrayBuffer = await response.arrayBuffer();
    if (token !== waveform.token) return; // Superseded by a newer song.

    if (!waveformAudioCtx) {
      waveformAudioCtx = new AudioContextClass();
    }

    const audioBuffer =
      await decodeAudioBuffer(waveformAudioCtx, arrayBuffer);

    if (token !== waveform.token) return; // Superseded while decoding.

    waveform.peaks = computePeaks(audioBuffer, WAVEFORM_BAR_COUNT);
    waveform.ready = true;

    resizeWaveformCanvas();

    if (wrap) wrap.classList.add("has-waveform");

    const ratio =
      audio.duration ? audio.currentTime / audio.duration : 0;

    drawWaveformBars(ratio);
  } catch (error) {
    console.error("Waveform generation:", error);
    waveform.peaks = null;
    waveform.ready = false;
    // wrap keeps "has-waveform" removed above, so #progress's
    // original gradient bar remains visible — safe fallback.
  }
}

function resizeWaveformCanvas() {
  const canvas = document.getElementById("waveformCanvas");
  const wrap = document.getElementById("waveformWrap");
  if (!canvas || !wrap) return;

  const rect = wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  waveformCanvasSize = { width: rect.width, height: rect.height, dpr };

  const ratio =
    audio.duration ? audio.currentTime / audio.duration : 0;

  drawWaveformBars(ratio);
}

function roundedBarPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawWaveformBars(progressRatio) {
  if (!waveform.ready || !waveform.peaks) return;

  const canvas = document.getElementById("waveformCanvas");
  if (!canvas) return;

  const { width, height, dpr } = waveformCanvasSize;
  if (!width || !height) return;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const peaks = waveform.peaks;
  const barCount = peaks.length;
  const gap = 2;
  const barWidth =
    Math.max(1.5, (width - gap * (barCount - 1)) / barCount);

  const ratio =
    Number.isFinite(progressRatio) ? progressRatio : 0;

  const activeIndex = Math.floor(ratio * barCount);
  const mutedColor = "rgba(255, 255, 255, .22)";

  for (let i = 0; i < barCount; i++) {
    const barHeight = Math.max(2, peaks[i] * (height - 4));
    const x = i * (barWidth + gap);
    const y = (height - barHeight) / 2;

    ctx.fillStyle = i <= activeIndex ? currentAccentCSS : mutedColor;
    roundedBarPath(ctx, x, y, barWidth, barHeight, barWidth / 2);
    ctx.fill();
  }
}

// Cheap per-frame call from updateProgress()'s existing timeupdate
// hook — just repaints with the new progress ratio using the peaks
// already computed above; does nothing until a waveform is ready.
function drawWaveformProgress(ratio) {
  if (!waveform.ready) return;
  drawWaveformBars(ratio);
}

function seekWaveformFromClientX(clientX) {
  const wrap = document.getElementById("waveformWrap");
  if (!wrap || !audio.duration) return;

  const rect = wrap.getBoundingClientRect();
  const ratio =
    Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

  audio.currentTime = ratio * audio.duration;

  const percent = ratio * 100;
  const progressInput = document.getElementById("progress");
  if (progressInput) progressInput.value = percent;

  setProgressFill(percent);
  drawWaveformBars(ratio);
}

function setupWaveformInteraction() {
  const wrap = document.getElementById("waveformWrap");
  if (!wrap) return;

  wrap.addEventListener("click", event => {
    seekWaveformFromClientX(event.clientX);
  });

  wrap.addEventListener("touchstart", event => {
    const touch = event.touches[0];
    if (touch) seekWaveformFromClientX(touch.clientX);
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!playerOverlay.classList.contains("hidden")) {
      resizeWaveformCanvas();
    }
  });
}

/* =========================================================
   DYNAMIC COVER COLOR
   ---------------------------------------------------------
   Samples the current song's cover art on an offscreen canvas to
   find a representative color, then smoothly animates a small set of
   CSS custom properties (--np-accent / --np-glow / --np-glow-soft)
   scoped to the .player element only — the rest of the app's dark
   theme is entirely untouched. If extraction fails or there's no
   cover, it animates back to a neutral tone that matches the
   existing design's original lavender-white glow.
   ========================================================= */

const DEFAULT_NP_COLOR = { r: 178, g: 160, b: 219 };

let currentNpColor = { ...DEFAULT_NP_COLOR };
let currentAccentCSS = "#ffffff";
let coverColorToken = 0;
let coverColorAnimationFrame = null;

function extractDominantColor(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);

        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 200) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lightness = (max + min) / 2;

          // Skip near-black / near-white pixels: they dominate most
          // album art (borders, backgrounds) but make poor accents.
          if (lightness < 18 || lightness > 235) continue;

          const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
          const saturation = max === 0 ? 0 : (max - min) / max;
          const weight = 1 + saturation * 2;

          const bucket =
            buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0 };

          bucket.r += r * weight;
          bucket.g += g * weight;
          bucket.b += b * weight;
          bucket.weight += weight;

          buckets.set(key, bucket);
        }

        let best = null;
        for (const bucket of buckets.values()) {
          if (!best || bucket.weight > best.weight) best = bucket;
        }

        if (!best) {
          resolve(null);
          return;
        }

        resolve({
          r: Math.round(best.r / best.weight),
          g: Math.round(best.g / best.weight),
          b: Math.round(best.b / best.weight)
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error("Cover image failed to load"));
    img.src = url;
  });
}

// Pushes a sampled color toward a punchier "accent" version rather
// than using the raw (often muddy/dark) average pixel color.
function boostColor(color) {
  const max = Math.max(color.r, color.g, color.b) || 1;
  const scale = Math.min(255 / max, 1.6);

  return {
    r: Math.min(255, Math.round(color.r * scale)),
    g: Math.min(255, Math.round(color.g * scale)),
    b: Math.min(255, Math.round(color.b * scale))
  };
}

function setNpColorVars(player, color) {
  const accent = `rgb(${color.r}, ${color.g}, ${color.b})`;
  const glow = `rgba(${color.r}, ${color.g}, ${color.b}, .55)`;
  const glowSoft = `rgba(${color.r}, ${color.g}, ${color.b}, .18)`;

  player.style.setProperty("--np-accent", accent);
  player.style.setProperty("--np-glow", glow);
  player.style.setProperty("--np-glow-soft", glowSoft);

  currentAccentCSS = accent;

  if (waveform.ready) {
    const ratio =
      audio.duration ? audio.currentTime / audio.duration : 0;
    drawWaveformBars(ratio);
  }
}

function animateNpColors(player, rawColor) {
  const target = rawColor ? boostColor(rawColor) : { ...DEFAULT_NP_COLOR };
  const from = { ...currentNpColor };
  const duration = 500;
  const start = performance.now();

  if (coverColorAnimationFrame) {
    cancelAnimationFrame(coverColorAnimationFrame);
  }

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = t * (2 - t); // ease-out, no extra deps needed

    const current = {
      r: Math.round(from.r + (target.r - from.r) * eased),
      g: Math.round(from.g + (target.g - from.g) * eased),
      b: Math.round(from.b + (target.b - from.b) * eased)
    };

    setNpColorVars(player, current);
    currentNpColor = current;

    if (t < 1) {
      coverColorAnimationFrame = requestAnimationFrame(step);
    } else {
      coverColorAnimationFrame = null;
    }
  }

  coverColorAnimationFrame = requestAnimationFrame(step);
}

async function applyCoverColor(song) {
  const token = ++coverColorToken;
  const player = document.querySelector(".player");
  if (!player) return;

  if (!song.cover_url) {
    animateNpColors(player, null);
    return;
  }

  try {
    const color = await extractDominantColor(song.cover_url);
    if (token !== coverColorToken) return; // Song changed meanwhile.
    animateNpColors(player, color);
  } catch (error) {
    console.error("Cover color extraction:", error);
    if (token === coverColorToken) animateNpColors(player, null);
  }
}

/* =========================================================
   SYNCHRONIZED LYRICS
   ---------------------------------------------------------
   Clean, self-contained data model so real timestamped lyrics can be
   wired up from the existing API the moment a song/lyrics endpoint
   returns them (either song.lyrics_lrc / song.lyrics on the song
   object itself, or a dedicated GET /songs/:id/lyrics response). If
   neither is present, a graceful "Lyrics unavailable" state is shown
   — ordinary, non-timestamped lyrics are never faked as synced.

   Lyrics data shape once loaded:
     {
       songId: <id>,
       available: true,
       lines: [
         {
           time: <seconds, Number>,
           text: <string>,
           words: [{ time: <seconds>, text: <string> }] | null
         },
         ...
       ]
     }
   ========================================================= */

const lyricsState = {
  songId: null,
  available: false,
  lines: [],
  activeLineIndex: -1,
  visible: false
};

let lyricsToken = 0;

// Parses standard LRC ("[mm:ss.xx] text") and, when present, inline
// word-level timestamps in enhanced-LRC form ("<mm:ss.xx>word").
// Unknown/metadata tags (e.g. [ar:], [ti:]) are ignored rather than
// treated as lyric lines.
function parseLRC(lrcText) {
  if (typeof lrcText !== "string" || !lrcText.trim()) return [];

  const lineTimeTag = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g;
  const wordTimeTag = /<(\d{1,3}):(\d{2}(?:\.\d{1,3})?)>/g;

  const rawLines = lrcText.split(/\r?\n/);
  const lines = [];

  for (const rawLine of rawLines) {
    const timeTags = [...rawLine.matchAll(lineTimeTag)];
    if (!timeTags.length) continue; // Metadata tag or blank/plain line.

    const textPart = rawLine.replace(lineTimeTag, "").trim();
    if (!textPart) continue;

    // Parse optional word-level tags embedded in the remaining text.
    const wordMatches = [...textPart.matchAll(wordTimeTag)];
    let words = null;

    if (wordMatches.length) {
      words = [];
      const segments = textPart.split(wordTimeTag);
      // split() on a global regex with capture groups interleaves
      // captured groups (min, sec) into the array; walk it back into
      // { time, text } pairs.
      for (let i = 0; i < wordMatches.length; i++) {
        const minutes = Number(wordMatches[i][1]);
        const seconds = Number(wordMatches[i][2]);
        const wordText =
          (segments[(i + 1) * 3] || "").trim();

        if (wordText) {
          words.push({
            time: minutes * 60 + seconds,
            text: wordText
          });
        }
      }

      if (!words.length) words = null;
    }

    const cleanText =
      textPart.replace(wordTimeTag, "").trim();

    if (!cleanText) continue;

    // A single LRC line can carry multiple timestamps (repeated
    // chorus lines reusing the same text) — emit one entry per tag.
    for (const tag of timeTags) {
      const minutes = Number(tag[1]);
      const seconds = Number(tag[2]);

      lines.push({
        time: minutes * 60 + seconds,
        text: cleanText,
        words
      });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

// Looks for lyrics in the shape the existing API is most likely to
// eventually provide them in, without assuming a route that doesn't
// exist yet. Tries, in order: an LRC string already on the song
// object, a pre-parsed lines array already on the song object, then
// a dedicated read-only endpoint. Any failure here is caught by the
// caller and treated as "no lyrics available" — never a hard error.
async function fetchLyricsForSong(song) {
  if (Array.isArray(song.lyrics_lines) && song.lyrics_lines.length) {
    return song.lyrics_lines;
  }

  if (typeof song.lyrics_lrc === "string" && song.lyrics_lrc.trim()) {
    return parseLRC(song.lyrics_lrc);
  }

  if (typeof song.lyrics === "string" && song.lyrics.trim()) {
    return parseLRC(song.lyrics);
  }

  // Not present on the song object — ask the API directly. This
  // endpoint doesn't exist on the backend yet; once it does (e.g.
  // returning { success, lrc } or { success, lines }), this starts
  // working with no further frontend changes.
  const data = await api(`/songs/${song.id}/lyrics`);

  if (Array.isArray(data.lines) && data.lines.length) {
    return data.lines;
  }

  if (typeof data.lrc === "string" && data.lrc.trim()) {
    return parseLRC(data.lrc);
  }

  return [];
}

async function loadLyrics(song) {
  const token = ++lyricsToken;

  lyricsState.songId = song.id;
  lyricsState.available = false;
  lyricsState.lines = [];
  lyricsState.activeLineIndex = -1;

  try {
    const lines = await fetchLyricsForSong(song);

    if (token !== lyricsToken) return; // Superseded by a newer song.

    if (Array.isArray(lines) && lines.length) {
      lyricsState.lines = lines;
      lyricsState.available = true;
    }
  } catch (error) {
    // Expected until a real lyrics endpoint exists — not logged as
    // an error, just treated as "unavailable" for this song.
    lyricsState.available = false;
  }

  renderLyrics();
  updateLyricsToggleState();
}

function renderLyrics() {
  const scroll = document.getElementById("lyricsScroll");
  if (!scroll) return;

  if (!lyricsState.available || !lyricsState.lines.length) {
    scroll.innerHTML =
      `<div class="lyrics-empty" id="lyricsEmpty">Lyrics unavailable</div>`;
    return;
  }

  scroll.innerHTML = lyricsState.lines.map((line, index) => {
    const inner =
      Array.isArray(line.words) && line.words.length
        ? line.words.map(word =>
            `<span class="lyrics-word" data-time="${word.time}">${escapeHTML(word.text)}</span>`
          ).join(" ")
        : escapeHTML(line.text);

    return `
      <div class="lyrics-line" data-index="${index}" data-time="${line.time}">
        ${inner}
      </div>
    `;
  }).join("");

  scroll.querySelectorAll(".lyrics-line").forEach(el => {
    el.addEventListener("click", () => {
      const time = Number(el.dataset.time);
      if (Number.isFinite(time)) {
        audio.currentTime = time;
        if (audio.paused) audio.play().catch(console.error);
      }
    });
  });
}

// Called from updateProgress()'s existing timeupdate hook. Finds the
// last line whose timestamp has passed, highlights it, auto-scrolls
// it into view, and (when word-level timestamps exist) progressively
// highlights individual words within the active line.
function syncLyrics(currentTime) {
  if (!lyricsState.available || !lyricsState.lines.length) return;

  const lines = lyricsState.lines;
  let activeIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      activeIndex = i;
    } else {
      break;
    }
  }

  if (activeIndex !== lyricsState.activeLineIndex) {
    const scroll = document.getElementById("lyricsScroll");

    if (scroll) {
      const previous =
        scroll.querySelector(".lyrics-line.active");
      if (previous) previous.classList.remove("active");

      if (activeIndex >= 0) {
        const activeEl =
          scroll.querySelector(`.lyrics-line[data-index="${activeIndex}"]`);

        if (activeEl) {
          activeEl.classList.add("active");
          activeEl.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }
    }

    lyricsState.activeLineIndex = activeIndex;
  }

  if (activeIndex >= 0) {
    const activeLine = lines[activeIndex];

    if (Array.isArray(activeLine.words) && activeLine.words.length) {
      const scroll = document.getElementById("lyricsScroll");
      const activeEl =
        scroll && scroll.querySelector(`.lyrics-line[data-index="${activeIndex}"]`);

      if (activeEl) {
        activeEl.querySelectorAll(".lyrics-word").forEach(wordEl => {
          const wordTime = Number(wordEl.dataset.time);
          wordEl.classList.toggle(
            "sung",
            Number.isFinite(wordTime) && wordTime <= currentTime
          );
        });
      }
    }
  }
}

function updateLyricsToggleState() {
  const toggle = document.getElementById("lyricsToggle");
  if (!toggle) return;

  // Always tappable (so the "Lyrics unavailable" state is reachable),
  // but dimmed when this song has nothing synced to show.
  toggle.classList.toggle("no-lyrics", !lyricsState.available);
}

function toggleLyricsView() {
  lyricsState.visible = !lyricsState.visible;

  const cover = document.getElementById("playerCover");
  const panel = document.getElementById("lyricsPanel");
  const toggle = document.getElementById("lyricsToggle");

  if (cover) cover.classList.toggle("hidden", lyricsState.visible);
  if (panel) panel.classList.toggle("hidden", !lyricsState.visible);

  if (toggle) {
    toggle.classList.toggle("active", lyricsState.visible);
    toggle.setAttribute("aria-pressed", String(lyricsState.visible));
    toggle.setAttribute(
      "aria-label",
      lyricsState.visible ? "Show cover art" : "Show lyrics"
    );
  }
}

function setupLyricsToggle() {
  const toggle = document.getElementById("lyricsToggle");
  if (!toggle) return;

  toggle.addEventListener("click", toggleLyricsView);
}

