const API =
  "https://white-playlist-api-new.mahantem2.workers.dev/api/v1";

const AUDIO_API =
  "https://white-playlist-api-new.mahantem2.workers.dev/api/v1/audio";

/* =========================================================
   TELEGRAM
   ========================================================= */

const tg = window.Telegram?.WebApp || null;

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

  searchQuery: "",
  selectedSongForPlaylist: null
};

/* =========================================================
   DOM
   ========================================================= */

const audio = document.getElementById("audio");
const miniPlayer = document.getElementById("miniPlayer");
const playerOverlay = document.getElementById("playerOverlay");

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
      <line x1="4" y1="6" x2="15" y2="6"></line>
      <line x1="4" y1="11" x2="15" y2="11"></line>
      <line x1="4" y1="16" x2="11" y2="16"></line>
      <path d="M18 13v7"></path>
      <path d="M15.5 17.5h5"></path>
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

  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API}${endpoint}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error("Network error. Please check your connection.");
  }

  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed (${response.status})`
    );
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
  setupGlobalKeyboard();

  await Promise.allSettled([
    loadSongs(),
    loadFavorites(),
    loadArtists(),
    loadAlbums(),
    loadPlaylists()
  ]);

  renderAllSongViews();
  updatePlayerUI();
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

  const seeAllSongs = document.getElementById("seeAllSongs");

  if (seeAllSongs) {
    seeAllSongs.addEventListener("click", () => {
      showPage("songsPage");
    });
  }

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

  if (!page) return;

  page.classList.add("active");

  /*
   * Detail pages don't have bottom-nav items.
   * Keep the last logical library section highlighted.
   */
  const navPageMap = {
    artistDetailPage: "artistsPage",
    albumDetailPage: "albumsPage",
    playlistDetailPage: "playlistsPage"
  };

  const activeNavPage =
    navPageMap[pageId] || pageId;

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === activeNavPage
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   SONGS
   ========================================================= */

async function loadSongs() {
  try {
    const data = await api("/songs?limit=500");

    state.songs = Array.isArray(data.songs)
      ? data.songs
      : [];

    renderSongs();
    renderRecentSongs();
  } catch (error) {
    console.error("Songs:", error);

    showError(
      "allSongs",
      "Couldn't load songs."
    );

    showError(
      "recentSongs",
      "Couldn't load songs."
    );
  }
}

function renderAllSongViews() {
  renderSongs();
  renderRecentSongs();
  renderFavoriteSongs();
}

function renderSongs() {
  const container =
    document.getElementById("allSongs");

  if (!container) return;

  if (!state.songs.length) {
    container.innerHTML =
      `<div class="empty">No songs yet.</div>`;
    return;
  }

  container.innerHTML =
    state.songs.map(songHTML).join("");

  bindSongButtons(container);
}

function renderRecentSongs() {
  const container =
    document.getElementById("recentSongs");

  if (!container) return;

  const songs =
    state.songs.slice(0, 10);

  if (!songs.length) {
    container.innerHTML =
      `<div class="empty">
        Send a song to White Playlist to get started.
      </div>`;
    return;
  }

  container.innerHTML =
    songs.map(songHTML).join("");

  bindSongButtons(container);
}

function songHTML(song) {
  const liked = isFavorite(song);

  const id = Number(song.id);

  const title =
    song.title ||
    song.name ||
    "Unknown";

  const artist =
    song.artist ||
    song.artist_name ||
    "Unknown Artist";

  const album =
    song.album ||
    song.album_title ||
    "Unknown Album";

  return `
    <div
      class="song-item"
      data-song-id="${id}"
    >

      <button
        class="song-cover"
        data-action="play"
        data-id="${id}"
        aria-label="Play ${escapeHTML(title)}"
      >
        ${ICONS.music}
      </button>

      <button
        class="song-info"
        data-action="play"
        data-id="${id}"
        style="text-align:left"
      >
        <div class="song-title">
          ${escapeHTML(title)}
        </div>

        <div class="song-meta">
          ${escapeHTML(artist)}
          •
          ${escapeHTML(album)}
        </div>
      </button>

      <div class="song-actions">

        <button
          class="${liked ? "liked" : ""}"
          data-action="favorite"
          data-id="${id}"
          aria-label="${liked ? "Remove favorite" : "Add favorite"}"
          aria-pressed="${liked}"
        >
          ${liked ? ICONS.heartFilled : ICONS.heart}
        </button>

        <button
          data-action="playlist"
          data-id="${id}"
          aria-label="Add to playlist"
        >
          ${ICONS.plus}
        </button>

      </div>

    </div>
  `;
}

function bindSongButtons(container) {
  if (!container) return;

  container
    .querySelectorAll("[data-action]")
    .forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const action =
          button.dataset.action;

        const id =
          Number(button.dataset.id);

        const song =
          findSong(id);

        if (!song) return;

        if (action === "play") {
          playSong(song);
        }

        if (action === "favorite") {
          toggleFavorite(song);
        }

        if (action === "playlist") {
          openAddToPlaylist(song);
        }
      });
    });
}

function findSong(id) {
  return state.songs.find(
    song =>
      Number(song.id) === Number(id)
  );
}

/* =========================================================
   FAVORITES
   ========================================================= */

async function loadFavorites() {
  try {
    const data =
      await api("/favorites");

    state.favorites =
      Array.isArray(data.favorites)
        ? data.favorites
        : [];

    renderFavoriteSongs();
    updatePlayerLike();
  } catch (error) {
    console.error("Favorites:", error);
  }
}

function isFavorite(song) {
  if (!song) return false;

  const songId =
    Number(song.id);

  return state.favorites.some(item => {
    const favoriteId =
      item.song_id ??
      item.songId ??
      item.id;

    return Number(favoriteId) === songId;
  });
}

function renderFavoriteSongs() {
  const container =
    document.getElementById("favoriteSongs");

  if (!container) return;

  if (!state.favorites.length) {
    container.innerHTML =
      `<div class="empty">
        No favorite songs yet.
      </div>`;
    return;
  }

  /*
   * Normalize favorite response.
   *
   * If API returns complete song objects,
   * use them directly.
   *
   * If it only returns song_id, resolve them
   * against the main songs list.
   */
  const favoriteSongs =
    state.favorites
      .map(item => {
        if (
          item.title ||
          item.artist ||
          item.album
        ) {
          return item;
        }

        const id =
          item.song_id ??
          item.songId ??
          item.id;

        return findSong(Number(id));
      })
      .filter(Boolean);

  if (!favoriteSongs.length) {
    container.innerHTML =
      `<div class="empty">
        No favorite songs yet.
      </div>`;
    return;
  }

  container.innerHTML =
    favoriteSongs.map(songHTML).join("");

  bindSongButtons(container);
}

async function toggleFavorite(song) {
  if (!song?.id) return;

  const liked =
    isFavorite(song);

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
    renderFavoriteSongs();

    updatePlayerLike();

  } catch (error) {
    console.error("Favorite:", error);

    showToast(
      error.message ||
      "Couldn't update favorite."
    );
  }
}

/* =========================================================
   ARTISTS
   ========================================================= */

async function loadArtists() {
  try {
    const data =
      await api("/artists?limit=500");

    state.artists =
      Array.isArray(data.artists)
        ? data.artists
        : [];

    renderArtists();
  } catch (error) {
    console.error("Artists:", error);

    showError(
      "artistsList",
      "Couldn't load artists."
    );
  }
}

function renderArtists() {
  const container =
    document.getElementById("artistsList");

  if (!container) return;

  if (!state.artists.length) {
    container.innerHTML =
      `<div class="empty">
        No artists yet.
      </div>`;
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
            ${escapeHTML(
              artist.name ||
              "Unknown Artist"
            )}
          </div>

          <div class="library-meta">
            ${Number(artist.song_count || 0)} songs
          </div>

        </div>

        <div class="library-arrow">
          ${ICONS.chevron}
        </div>

      </button>
    `).join("");

  container
    .querySelectorAll("[data-artist-id]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openArtist(
          Number(button.dataset.artistId)
        );
      });
    });
}

async function openArtist(id) {
  try {
    const data =
      await api(`/artists/${id}`);

    const artist =
      data.artist || {};

    const songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    const container =
      document.getElementById("artistDetail");

    container.innerHTML = `
      <div class="detail-header">

        <h1 class="detail-title">
          ${escapeHTML(
            artist.name ||
            "Unknown Artist"
          )}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>

      </div>

      <div class="song-list">
        ${
          songs.length
            ? songs.map(songHTML).join("")
            : `<div class="empty">No songs found.</div>`
        }
      </div>
    `;

    bindSongButtons(container);

    showPage("artistDetailPage");

  } catch (error) {
    console.error("Artist detail:", error);

    showToast(
      error.message ||
      "Couldn't load artist."
    );
  }
}

/* =========================================================
   ALBUMS
   ========================================================= */

async function loadAlbums() {
  try {
    const data =
      await api("/albums");

    state.albums =
      Array.isArray(data.albums)
        ? data.albums
        : [];

    renderAlbums();
  } catch (error) {
    console.error("Albums:", error);

    showError(
      "albumsList",
      "Couldn't load albums."
    );
  }
}

function renderAlbums() {
  const container =
    document.getElementById("albumsList");

  if (!container) return;

  if (!state.albums.length) {
    container.innerHTML =
      `<div class="empty">
        No albums yet.
      </div>`;
    return;
  }

  container.innerHTML =
    state.albums.map(album => `
      <button
        class="library-item"
        data-album-id="${album.id}"
      >

        <div class="library-icon">
          ${ICONS.album}
        </div>

        <div class="library-info">

          <div class="library-name">
            ${escapeHTML(
              album.title ||
              album.name ||
              "Unknown Album"
            )}
          </div>

          <div class="library-meta">
            ${escapeHTML(
              album.artist ||
              "Unknown Artist"
            )}
            •
            ${Number(album.song_count || 0)} songs
          </div>

        </div>

        <div class="library-arrow">
          ${ICONS.chevron}
        </div>

      </button>
    `).join("");

  container
    .querySelectorAll("[data-album-id]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openAlbum(
          Number(button.dataset.albumId)
        );
      });
    });
}

async function openAlbum(id) {
  try {
    const data =
      await api(`/albums/${id}`);

    const album =
      data.album || {};

    const songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    const container =
      document.getElementById("albumDetail");

    container.innerHTML = `
      <div class="detail-header">

        <h1 class="detail-title">
          ${escapeHTML(
            album.title ||
            album.name ||
            "Unknown Album"
          )}
        </h1>

        <div class="detail-subtitle">
          ${escapeHTML(
            album.artist ||
            "Unknown Artist"
          )}
          •
          ${songs.length} songs
        </div>

      </div>

      <div class="song-list">
        ${
          songs.length
            ? songs.map(songHTML).join("")
            : `<div class="empty">No songs found.</div>`
        }
      </div>
    `;

    bindSongButtons(container);

    showPage("albumDetailPage");

  } catch (error) {
    console.error("Album detail:", error);

    showToast(
      error.message ||
      "Couldn't load album."
    );
  }
}

/* =========================================================
   PLAYLISTS
   ========================================================= */

async function loadPlaylists() {
  try {
    const data =
      await api("/playlists");

    state.playlists =
      Array.isArray(data.playlists)
        ? data.playlists
        : [];

    renderPlaylists();

  } catch (error) {
    console.error("Playlists:", error);

    showError(
      "playlistsList",
      "Couldn't load playlists."
    );
  }
}

function renderPlaylists() {
  const container =
    document.getElementById("playlistsList");

  if (!container) return;

  if (!state.playlists.length) {
    container.innerHTML =
      `<div class="empty">
        Create your first playlist.
      </div>`;
    return;
  }

  container.innerHTML =
    state.playlists.map(playlist => `
      <button
        class="library-item"
        data-playlist-id="${playlist.id}"
      >

        <div class="library-icon">
          ${ICONS.playlist}
        </div>

        <div class="library-info">

          <div class="library-name">
            ${escapeHTML(
              playlist.name ||
              "Untitled Playlist"
            )}
          </div>

          <div class="library-meta">
            ${Number(
              playlist.song_count || 0
            )} songs
          </div>

        </div>

        <div class="library-arrow">
          ${ICONS.chevron}
        </div>

      </button>
    `).join("");

  container
    .querySelectorAll("[data-playlist-id]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openPlaylist(
          Number(button.dataset.playlistId)
        );
      });
    });
}

async function openPlaylist(id) {
  try {
    const data =
      await api(`/playlists/${id}/songs`);

    const playlist =
      data.playlist || {};

    const songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    const container =
      document.getElementById("playlistDetail");

    container.innerHTML = `
      <div class="detail-header">

        <h1 class="detail-title">
          ${escapeHTML(
            playlist.name ||
            "Untitled Playlist"
          )}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>

      </div>

      <div class="song-list">
        ${
          songs.length
            ? songs.map(songHTML).join("")
            : `<div class="empty">This playlist is empty.</div>`
        }
      </div>
    `;

    bindSongButtons(container);

    showPage("playlistDetailPage");

  } catch (error) {
    console.error("Playlist:", error);

    showToast(
      error.message ||
      "Couldn't load playlist."
    );
  }
}

/* =========================================================
   PLAYLIST MODALS
   ========================================================= */

function setupModals() {
  const createButton =
    document.getElementById(
      "createPlaylistButton"
    );

  const cancelButton =
    document.getElementById(
      "cancelPlaylist"
    );

  const saveButton =
    document.getElementById(
      "savePlaylist"
    );

  const closeAddButton =
    document.getElementById(
      "closeAddPlaylist"
    );

  if (createButton) {
    createButton.addEventListener(
      "click",
      openCreatePlaylistModal
    );
  }

  if (cancelButton) {
    cancelButton.addEventListener(
      "click",
      closePlaylistModal
    );
  }

  if (saveButton) {
    saveButton.addEventListener(
      "click",
      createPlaylist
    );
  }

  if (closeAddButton) {
    closeAddButton.addEventListener(
      "click",
      closeAddPlaylistModal
    );
  }

  document
    .getElementById("playlistModal")
    ?.addEventListener(
      "click",
      event => {
        if (
          event.target.id ===
          "playlistModal"
        ) {
          closePlaylistModal();
        }
      }
    );

  document
    .getElementById("addToPlaylistModal")
    ?.addEventListener(
      "click",
      event => {
        if (
          event.target.id ===
          "addToPlaylistModal"
        ) {
          closeAddPlaylistModal();
        }
      }
    );

  document
    .getElementById("playlistName")
    ?.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          event.preventDefault();
          createPlaylist();
        }
      }
    );
}

function openCreatePlaylistModal() {
  const input =
    document.getElementById(
      "playlistName"
    );

  if (input) {
    input.value = "";
  }

  document
    .getElementById("playlistModal")
    ?.classList.remove("hidden");

  setTimeout(() => {
    input?.focus();
  }, 50);
}

function closePlaylistModal() {
  document
    .getElementById("playlistModal")
    ?.classList.add("hidden");
}

function closeAddPlaylistModal() {
  document
    .getElementById("addToPlaylistModal")
    ?.classList.add("hidden");

  state.selectedSongForPlaylist = null;
}

async function createPlaylist() {
  const input =
    document.getElementById(
      "playlistName"
    );

  if (!input) return;

  const name =
    input.value.trim();

  if (!name) {
    showToast(
      "Please enter a playlist name."
    );
    input.focus();
    return;
  }

  try {
    await api("/playlists", {
      method: "POST",
      body: JSON.stringify({
        name
      })
    });

    closePlaylistModal();

    await loadPlaylists();

    showToast(
      "Playlist created."
    );

  } catch (error) {
    console.error(
      "Create playlist:",
      error
    );

    showToast(
      error.message ||
      "Couldn't create playlist."
    );
  }
}

/* =========================================================
   ADD TO PLAYLIST
   ========================================================= */

async function openAddToPlaylist(song) {
  if (!song) return;

  state.selectedSongForPlaylist =
    song;

  const modal =
    document.getElementById(
      "addToPlaylistModal"
    );

  const list =
    document.getElementById(
      "addPlaylistList"
    );

  if (!modal || !list) return;

  list.innerHTML =
    `<div class="loading">
      Loading playlists...
    </div>`;

  modal.classList.remove("hidden");

  try {
    await loadPlaylists();

    if (!state.playlists.length) {
      list.innerHTML =
        `<div class="empty">
          Create a playlist first.
        </div>`;
      return;
    }

    list.innerHTML =
      state.playlists
        .map(playlist => `
          <button
            class="library-item"
            data-add-playlist-id="${playlist.id}"
          >

            <div class="library-icon">
              ${ICONS.plus}
            </div>

            <div class="library-info">

              <div class="library-name">
                ${escapeHTML(
                  playlist.name
                )}
              </div>

              <div class="library-meta">
                ${Number(
                  playlist.song_count || 0
                )} songs
              </div>

            </div>

          </button>
        `)
        .join("");

    list
      .querySelectorAll(
        "[data-add-playlist-id]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () =>
            addSongToPlaylist(
              Number(
                button.dataset
                  .addPlaylistId
              )
            )
        );
      });

  } catch (error) {
    console.error(
      "Load playlists:",
      error
    );

    list.innerHTML =
      `<div class="empty">
        Couldn't load playlists.
      </div>`;
  }
}

async function addSongToPlaylist(
  playlistId
) {
  const song =
    state.selectedSongForPlaylist;

  if (!song) return;

  try {
    await api(
      `/playlists/${playlistId}/songs`,
      {
        method: "POST",
        body: JSON.stringify({
          song_id: song.id
        })
      }
    );

    closeAddPlaylistModal();

    await loadPlaylists();

    showToast(
      "Added to playlist."
    );

  } catch (error) {
    console.error(
      "Add to playlist:",
      error
    );

    showToast(
      error.message ||
      "Couldn't add song."
    );
  }
}

/* =========================================================
   PLAYER
   ========================================================= */

function setupPlayer() {
  const mini =
    document.getElementById(
      "miniPlayer"
    );

  const miniPlay =
    document.getElementById(
      "miniPlay"
    );

  const miniLike =
    document.getElementById(
      "miniLike"
    );

  const playerClose =
    document.getElementById(
      "playerClose"
    );

  const mainPlay =
    document.getElementById(
      "mainPlay"
    );

  const playerLike =
    document.getElementById(
      "playerLike"
    );

  const previous =
    document.getElementById(
      "previousButton"
    );

  const next =
    document.getElementById(
      "nextButton"
    );

  const shuffle =
    document.getElementById(
      "shuffleButton"
    );

  const progress =
    document.getElementById(
      "progress"
    );

  mini?.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          "#miniPlay"
        ) ||
        event.target.closest(
          "#miniLike"
        )
      ) {
        return;
      }

      openFullPlayer();
    }
  );

  miniPlay?.addEventListener(
    "click",
    event => {
      event.stopPropagation();
      togglePlay();
    }
  );

  miniLike?.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      if (state.currentSong) {
        toggleFavorite(
          state.currentSong
        );
      }
    }
  );

  playerClose?.addEventListener(
    "click",
    closeFullPlayer
  );

  mainPlay?.addEventListener(
    "click",
    togglePlay
  );

  playerLike?.addEventListener(
    "click",
    () => {
      if (state.currentSong) {
        toggleFavorite(
          state.currentSong
        );
      }
    }
  );

  previous?.addEventListener(
    "click",
    previousSong
  );

  next?.addEventListener(
    "click",
    nextSong
  );

  shuffle?.addEventListener(
    "click",
    toggleShuffle
  );

  progress?.addEventListener(
    "input",
    event => {
      if (
        !Number.isFinite(
          audio.duration
        ) ||
        audio.duration <= 0
      ) {
        return;
      }

      const percentage =
        Number(event.target.value) /
        100;

      audio.currentTime =
        percentage *
        audio.duration;
    }
  );

  audio.addEventListener(
    "play",
    () => {
      state.isPlaying = true;
      updatePlayButtons();
    }
  );

  audio.addEventListener(
    "pause",
    () => {
      state.isPlaying = false;
      updatePlayButtons();
    }
  );

  audio.addEventListener(
    "timeupdate",
    updateProgress
  );

  audio.addEventListener(
    "loadedmetadata",
    updateDuration
  );

  audio.addEventListener(
    "ended",
    handleSongEnded
  );

  audio.addEventListener(
    "error",
    handleAudioError
  );

  audio.addEventListener(
    "waiting",
    () => {
      miniPlayer?.classList.add(
        "buffering"
      );
    }
  );

  audio.addEventListener(
    "playing",
    () => {
      miniPlayer?.classList.remove(
        "buffering"
      );
    }
  );

  playerOverlay?.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        playerOverlay
      ) {
        closeFullPlayer();
      }
    }
  );

  updateShuffleButton();
}

function playSong(song, options = {}) {
  if (!song?.id) return;

  const preserveQueue =
    options.preserveQueue === true;

  const existingIndex =
    state.queue.findIndex(
      item =>
        Number(item.id) ===
        Number(song.id)
    );

  /*
   * Start a fresh queue only when the
   * user explicitly selects a song.
   */
  if (
    !preserveQueue ||
    !state.queue.length
  ) {
    buildQueue(song);
  } else if (
    existingIndex !== -1
  ) {
    state.queueIndex =
      existingIndex;
  }

  state.currentSong = song;

  const audioUrl =
    buildAudioUrl(song.id);

  audio.pause();
  audio.src = audioUrl;
  audio.load();

  updatePlayerUI();

  audio.play()
    .then(() => {
      state.isPlaying = true;
      updatePlayButtons();
    })
    .catch(error => {
      console.error(
        "Playback:",
        error
      );

      state.isPlaying = false;
      updatePlayButtons();

      showToast(
        "Couldn't play this song."
      );
    });

  /*
   * Don't let recently-played failure
   * break playback.
   */
  api("/recently-played", {
    method: "POST",
    body: JSON.stringify({
      song_id: song.id
    })
  }).catch(error => {
    console.warn(
      "Recently played:",
      error
    );
  });
}

function buildAudioUrl(songId) {
  const url =
    `${AUDIO_API}/${encodeURIComponent(songId)}`;

  if (!state.userId) {
    return url;
  }

  return (
    `${url}?user_id=` +
    encodeURIComponent(state.userId)
  );
}

function buildQueue(startSong) {
  const songs =
    Array.isArray(state.songs)
      ? state.songs.slice()
      : [];

  if (!songs.length) {
    state.queue = [];
    state.queueIndex = -1;
    return;
  }

  /*
   * Normal queue.
   */
  if (!state.shuffle) {
    state.queue = songs;

    state.queueIndex =
      state.queue.findIndex(
        song =>
          Number(song.id) ===
          Number(startSong.id)
      );

    if (state.queueIndex < 0) {
      state.queue.unshift(
        startSong
      );

      state.queueIndex = 0;
    }

    return;
  }

  /*
   * Shuffle queue:
   * current song first, then shuffled
   * remaining songs.
   */
  const remaining =
    songs.filter(
      song =>
        Number(song.id) !==
        Number(startSong.id)
    );

  shuffleArray(remaining);

  state.queue = [
    startSong,
    ...remaining
  ];

  state.queueIndex = 0;
}

function togglePlay() {
  if (!state.currentSong) {
    if (state.songs.length) {
      playSong(
        state.songs[0]
      );
    }

    return;
  }

  if (audio.paused) {
    audio.play()
      .catch(error => {
        console.error(
          "Resume playback:",
          error
        );

        showToast(
          "Couldn't resume playback."
        );
      });
  } else {
    audio.pause();
  }
}

function nextSong() {
  if (!state.queue.length) {
    if (state.songs.length) {
      playSong(
        state.songs[0]
      );
    }

    return;
  }

  let nextIndex;

  if (state.shuffle) {
    /*
     * Don't immediately replay the current
     * song if there is more than one song.
     */
    if (state.queue.length <= 1) {
      nextIndex = 0;
    } else {
      do {
        nextIndex =
          Math.floor(
            Math.random() *
            state.queue.length
          );
      } while (
        nextIndex ===
        state.queueIndex
      );
    }
  } else {
    nextIndex =
      state.queueIndex + 1;

    if (
      nextIndex >=
      state.queue.length
    ) {
      nextIndex = 0;
    }
  }

  state.queueIndex =
    nextIndex;

  const next =
    state.queue[nextIndex];

  if (!next) return;

  playSong(next, {
    preserveQueue: true
  });
}

function previousSong() {
  if (
    Number.isFinite(
      audio.currentTime
    ) &&
    audio.currentTime > 3
  ) {
    audio.currentTime = 0;
    return;
  }

  if (!state.queue.length) {
    return;
  }

  let index =
    state.queueIndex - 1;

  if (index < 0) {
    index =
      state.queue.length - 1;
  }

  state.queueIndex =
    index;

  const previous =
    state.queue[index];

  if (!previous) return;

  playSong(previous, {
    preserveQueue: true
  });
}

function handleSongEnded() {
  state.isPlaying = false;

  updatePlayButtons();

  nextSong();
}

function toggleShuffle() {
  state.shuffle =
    !state.shuffle;

  updateShuffleButton();

  /*
   * Rebuild queue around current song
   * so the new mode takes effect immediately.
   */
  if (state.currentSong) {
    buildQueue(
      state.currentSong
    );
  }
}

function updateShuffleButton() {
  const button =
    document.getElementById(
      "shuffleButton"
    );

  if (!button) return;

  button.classList.toggle(
    "active",
    state.shuffle
  );

  button.setAttribute(
    "aria-pressed",
    String(state.shuffle)
  );
}

function updatePlayerUI() {
  if (!state.currentSong) {
    return;
  }

  const song =
    state.currentSong;

  const title =
    song.title ||
    song.name ||
    "Unknown";

  const artist =
    song.artist ||
    song.artist_name ||
    "Unknown Artist";

  const miniTitle =
    document.getElementById(
      "miniTitle"
    );

  const miniArtist =
    document.getElementById(
      "miniArtist"
    );

  const playerTitle =
    document.getElementById(
      "playerTitle"
    );

  const playerArtist =
    document.getElementById(
      "playerArtist"
    );

  if (miniTitle) {
    miniTitle.textContent =
      title;
  }

  if (miniArtist) {
    miniArtist.textContent =
      artist;
  }

  if (playerTitle) {
    playerTitle.textContent =
      title;
  }

  if (playerArtist) {
    playerArtist.textContent =
      artist;
  }

  miniPlayer?.classList.remove(
    "hidden"
  );

  updatePlayerLike();
  updatePlayButtons();
}

function updatePlayerLike() {
  if (!state.currentSong) {
    return;
  }

  const liked =
    isFavorite(
      state.currentSong
    );

  const miniLike =
    document.getElementById(
      "miniLike"
    );

  const playerLike =
    document.getElementById(
      "playerLike"
    );

  if (miniLike) {
    miniLike.innerHTML =
      liked
        ? ICONS.heartFilled
        : ICONS.heart;

    miniLike.classList.toggle(
      "active",
      liked
    );

    miniLike.setAttribute(
      "aria-pressed",
      String(liked)
    );

    miniLike.setAttribute(
      "aria-label",
      liked
        ? "Remove favorite"
        : "Favorite"
    );
  }

  if (playerLike) {
    playerLike.innerHTML =
      liked
        ? ICONS.heartFilled
        : ICONS.heart;

    playerLike.classList.toggle(
      "active",
      liked
    );

    playerLike.setAttribute(
      "aria-pressed",
      String(liked)
    );

    playerLike.setAttribute(
      "aria-label",
      liked
        ? "Remove favorite"
        : "Favorite"
    );
  }
}

function updatePlayButtons() {
  const mini =
    document.getElementById(
      "miniPlay"
    );

  const main =
    document.getElementById(
      "mainPlay"
    );

  if (mini) {
    mini.innerHTML =
      state.isPlaying
        ? ICONS.pause
        : ICONS.play;

    mini.setAttribute(
      "aria-label",
      state.isPlaying
        ? "Pause"
        : "Play"
    );
  }

  if (main) {
    main.innerHTML =
      state.isPlaying
        ? ICONS.pause
        : ICONS.play;

    main.setAttribute(
      "aria-label",
      state.isPlaying
        ? "Pause"
        : "Play"
    );
  }
}

function openFullPlayer() {
  if (!state.currentSong) {
    return;
  }

  playerOverlay?.classList.remove(
    "hidden"
  );
}

function closeFullPlayer() {
  playerOverlay?.classList.add(
    "hidden"
  );
}

function updateProgress() {
  const progress =
    document.getElementById(
      "progress"
    );

  const currentTime =
    document.getElementById(
      "currentTime"
    );

  if (
    !progress ||
    !currentTime ||
    !Number.isFinite(
      audio.duration
    ) ||
    audio.duration <= 0
  ) {
    return;
  }

  const percent =
    (
      audio.currentTime /
      audio.duration
    ) * 100;

  progress.value =
    String(percent);

  currentTime.textContent =
    formatTime(
      audio.currentTime
    );
}

function updateDuration() {
  const duration =
    document.getElementById(
      "duration"
    );

  if (!duration) return;

  duration.textContent =
    formatTime(
      audio.duration
    );
}

function handleAudioError() {
  state.isPlaying = false;

  updatePlayButtons();

  miniPlayer?.classList.remove(
    "buffering"
  );

  console.error(
    "Audio error:",
    audio.error
  );

  showToast(
    "Unable to load this audio."
  );
}

function formatTime(seconds) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "0:00";
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    Math.floor(
      seconds % 60
    );

  return (
    minutes +
    ":" +
    String(
      remaining
    ).padStart(2, "0")
  );
}

/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {
  const button =
    document.getElementById(
      "searchButton"
    );

  const section =
    document.getElementById(
      "searchSection"
    );

  const input =
    document.getElementById(
      "searchInput"
    );

  if (!button || !section || !input) {
    return;
  }

  button.addEventListener(
    "click",
    () => {
      const isHidden =
        section.classList.contains(
          "hidden"
        );

      section.classList.toggle(
        "hidden"
      );

      if (isHidden) {
        setTimeout(
          () => input.focus(),
          50
        );
      }
    }
  );

  let timer = null;

  input.addEventListener(
    "input",
    () => {
      clearTimeout(timer);

      const value =
        input.value.trim();

      state.searchQuery =
        value;

      timer =
        setTimeout(
          () => search(value),
          300
        );
    }
  );

  input.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        input.value = "";
        state.searchQuery = "";

        section.classList.add(
          "hidden"
        );

        showPage(
          "homePage"
        );
      }
    }
  );
}

async function search(query) {
  const q =
    String(query || "").trim();

  if (!q) {
    showPage("homePage");
    return;
  }

  const container =
    document.getElementById(
      "searchResults"
    );

  if (!container) return;

  container.innerHTML =
    `<div class="loading">
      Searching...
    </div>`;

  showPage("searchPage");

  try {
    const data =
      await api(
        `/search?q=${encodeURIComponent(q)}`
      );

    const results =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    if (!results.length) {
      container.innerHTML =
        `<div class="empty">
          No results found.
        </div>`;
      return;
    }

    container.innerHTML =
      results
        .map(songHTML)
        .join("");

    bindSongButtons(
      container
    );

  } catch (error) {
    console.error(
      "Search:",
      error
    );

    container.innerHTML =
      `<div class="empty">
        Couldn't search right now.
      </div>`;
  }
}

/* =========================================================
   GLOBAL KEYBOARD
   ========================================================= */

function setupGlobalKeyboard() {
  document.addEventListener(
    "keydown",
    event => {
      /*
       * Don't intercept typing.
       */
      const tag =
        document.activeElement?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA"
      ) {
        return;
      }

      if (
        event.code === "Space"
      ) {
        event.preventDefault();
        togglePlay();
      }

      if (
        event.code === "ArrowRight"
      ) {
        nextSong();
      }

      if (
        event.code === "ArrowLeft"
      ) {
        previousSong();
      }

      if (
        event.key === "Escape"
      ) {
        closeFullPlayer();
        closePlaylistModal();
        closeAddPlaylistModal();
      }
    }
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function shuffleArray(array) {
  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );

    [
      array[i],
      array[j]
    ] = [
      array[j],
      array[i]
    ];
  }

  return array;
}

function showError(
  elementId,
  message
) {
  const element =
    document.getElementById(
      elementId
    );

  if (!element) return;

  element.innerHTML =
    `<div class="empty">
      ${escapeHTML(message)}
    </div>`;
}

function showToast(message) {
  /*
   * If your CSS already has a toast,
   * use it. Otherwise fall back to alert.
   */
  let toast =
    document.getElementById(
      "appToast"
    );

  if (!toast) {
    toast =
      document.createElement(
        "div"
      );

    toast.id =
      "appToast";

    toast.className =
      "app-toast";

    document.body.appendChild(
      toast
    );
  }

  toast.textContent =
    String(message || "");

  toast.classList.add(
    "visible"
  );

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {
      toast.classList.remove(
        "visible"
      );
    }, 2500);
}

function escapeHTML(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
