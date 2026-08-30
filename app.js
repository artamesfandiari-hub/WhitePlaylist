const API =
  "https://white-playlist-api-new.mahantem2.workers.dev/api/v1";

const AUDIO_API =
  "https://white-playlist-api-new.mahantem2.workers.dev/api/v1/audio";

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
  shuffle: false
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

  await Promise.allSettled([
    loadSongs(),
    loadFavorites(),
    loadArtists(),
    loadAlbums(),
    loadPlaylists()
  ]);

  renderRecentSongs();
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
  bindSongButtons(container);
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
  bindSongButtons(container);
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
          class="${liked ? "liked" : ""}"
          data-action="favorite"
          data-id="${song.id}"
          aria-label="${liked ? "Remove favorite" : "Add favorite"}"
        >
          ${liked ? ICONS.heartFilled : ICONS.heart}
        </button>

        <button
          data-action="playlist"
          data-id="${song.id}"
          aria-label="Add to playlist"
        >
          ${ICONS.plus}
        </button>

        ${
          !isInPlaylistDetail
            ? `<button data-action="delete" data-id="${song.id}" aria-label="Delete song"><svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; fill: none;"><path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"></path></svg></button>`
            : ""
        }
      </div>

    </div>
  `;
}

function bindSongButtons(container) {
  if (!container) return;

  container.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.action;
      const id = Number(button.dataset.id);
      const song = findSong(id);

      if (!song) return;

      if (action === "play") playSong(song);
      if (action === "favorite") toggleFavorite(song);
      if (action === "playlist") openAddToPlaylist(song);

      if (action === "delete") {
        showConfirmationModal(
          "Delete Song",
          `Delete "${song.title || "Unknown"}"? This removes the song from your library.`,
          () => deleteSong(song)
        );
      }
    });
  });
}

function findSong(id) {
  return state.songs.find(
    song => Number(song.id) === Number(id)
  );
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

  bindSongButtons(container);
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

    bindSongButtons(container);
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
          ${ICONS.album}
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

    bindSongButtons(container);
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
            ${ICONS.playlist}
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

    container.innerHTML = `
      <div class="detail-header">
        <h1 class="detail-title">
          ${escapeHTML(playlist.name || "Untitled Playlist")}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>
      </div>

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

    bindSongButtons(container);

    container.querySelectorAll("[data-song-id]").forEach(songItem => {
      const songId = Number(songItem.dataset.songId);
      const actions = songItem.querySelector(".song-actions");

      if (!actions) return;

      const removeBtn = document.createElement("button");
      removeBtn.className = "song-remove-btn";
      removeBtn.setAttribute("aria-label", "Remove from playlist");
      removeBtn.style.width = "36px";
      removeBtn.style.height = "36px";
      removeBtn.style.display = "flex";
      removeBtn.style.alignItems = "center";
      removeBtn.style.justifyContent = "center";
      removeBtn.style.color = "#777";
      removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; fill: none;">
          <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"></path>
        </svg>
      `;

      removeBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const song = findSong(songId);
        const title = song?.title || "this song";

        showConfirmationModal(
          "Remove from Playlist",
          `Remove "${title}" from this playlist? The song stays in your library.`,
          () => removeSongFromPlaylist(id, songId)
        );
      });

      actions.appendChild(removeBtn);
    });

    showPage("playlistDetailPage");
  } catch (error) {
    console.error("Playlist:", error);
    alert(error.message || "Couldn't load playlist.");
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
      loadPlaylists()
    ]);

    alert(`Deleted "${title}".`);
  } catch (error) {
    console.error("Delete song:", error);
    alert(error.message || "Couldn't delete song.");
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
    .getElementById("closeAddPlaylist")
    .addEventListener("click", () => {
      document
        .getElementById("addToPlaylistModal")
        .classList.add("hidden");
    });
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
    await api("/playlists", {
      method: "POST",
      body: JSON.stringify({ name })
    });

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
  const shuffleButton =
    document.getElementById("shuffleButton");

  if (shuffleButton) {
    shuffleButton.classList.toggle("active", state.shuffle);
    shuffleButton.setAttribute("aria-pressed", String(state.shuffle));
  }

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
    .addEventListener("click", () => {
      state.shuffle = !state.shuffle;

      const shuffleButton =
        document.getElementById("shuffleButton");

      shuffleButton.classList.toggle(
        "active",
        state.shuffle
      );

      shuffleButton.setAttribute(
        "aria-pressed",
        String(state.shuffle)
      );
    });

  document
    .getElementById("progress")
    .addEventListener("input", event => {
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
  audio.addEventListener("ended", nextSong);
}

function playSong(song) {
  state.currentSong = song;

  state.queue = state.songs.slice();

  state.queueIndex =
    state.queue.findIndex(
      item => Number(item.id) === Number(song.id)
    );

  audio.src =
    `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;

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
  playSong(state.queue[nextIndex]);
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
  playSong(state.queue[index]);
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
}

function openFullPlayer() {
  playerOverlay.classList.remove("hidden");
}

function closeFullPlayer() {
  playerOverlay.classList.add("hidden");
}

function updateProgress() {
  if (!audio.duration) return;

  const percent =
    (audio.currentTime / audio.duration) * 100;

  document.getElementById("progress").value = percent;

  document.getElementById("currentTime").textContent =
    formatTime(audio.currentTime);
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

      bindSongButtons(container);
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
