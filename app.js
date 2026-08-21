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
      ? String(
          tg.initDataUnsafe.user.id
        )
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
   API
   ========================================================= */

async function api(
  endpoint,
  options = {}
) {

  const headers = {
    ...(options.headers || {})
  };

  if (
    state.userId
  ) {
    headers[
      "X-Telegram-User-Id"
    ] = state.userId;
  }

  if (
    options.body &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  const response =
    await fetch(
      `${API}${endpoint}`,
      {
        ...options,
        headers
      }
    );

  let data;

  try {
    data =
      await response.json();
  } catch (_) {
    throw new Error(
      "Invalid server response"
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ||
      "Request failed"
    );
  }

  return data;
}


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);

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

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          showPage(page);

        }
      );

    });


  document
    .getElementById(
      "seeAllSongs"
    )
    .addEventListener(
      "click",
      () => showPage("songsPage")
    );


  document
    .querySelectorAll(
      "[data-back]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          showPage(
            button.dataset.back
          );
        }
      );

    });
}


function showPage(
  pageId
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(page => {
      page.classList.remove(
        "active"
      );
    });


  const page =
    document.getElementById(
      pageId
    );

  if (page) {
    page.classList.add(
      "active"
    );
  }


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page ===
          pageId
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

    const data =
      await api(
        "/songs?limit=500"
      );

    state.songs =
      data.songs || [];

    renderSongs();
    renderRecentSongs();

  } catch (error) {

    console.error(
      "Songs:",
      error
    );

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


function renderSongs() {

  const container =
    document.getElementById(
      "allSongs"
    );

  if (!state.songs.length) {

    container.innerHTML =
      `<div class="empty">
        No songs yet.
      </div>`;

    return;
  }

  container.innerHTML =
    state.songs
      .map(songHTML)
      .join("");

  bindSongButtons(
    container
  );
}


function renderRecentSongs() {

  const container =
    document.getElementById(
      "recentSongs"
    );

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
    songs
      .map(songHTML)
      .join("");

  bindSongButtons(
    container
  );
}


function songHTML(song) {

  const liked =
    state.favorites.some(
      item =>
        Number(item.id) ===
        Number(song.id)
    );

  const artist =
    song.artist ||
    "Unknown Artist";

  const album =
    song.album ||
    "Unknown Album";

  return `
    <div
      class="song-item"
      data-song-id="${song.id}"
    >

      <button
        class="song-cover"
        data-action="play"
        data-id="${song.id}"
      >
        ♪
      </button>

      <button
        class="song-info"
        data-action="play"
        data-id="${song.id}"
        style="text-align:left"
      >

        <div class="song-title">
          ${escapeHTML(
            song.title || "Unknown"
          )}
        </div>

        <div class="song-meta">
          ${escapeHTML(artist)}
          •
          ${escapeHTML(album)}
        </div>

      </button>

      <div class="song-actions">

        <button
          class="${
            liked ? "liked" : ""
          }"
          data-action="favorite"
          data-id="${song.id}"
        >
          ${liked ? "♥" : "♡"}
        </button>

        <button
          data-action="playlist"
          data-id="${song.id}"
        >
          +
        </button>

      </div>

    </div>
  `;
}


function bindSongButtons(
  container
) {

  container
    .querySelectorAll(
      "[data-action]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          const action =
            button.dataset.action;

          const id =
            Number(
              button.dataset.id
            );

          const song =
            findSong(id);

          if (!song) return;

          if (
            action === "play"
          ) {
            playSong(song);
          }

          if (
            action === "favorite"
          ) {
            toggleFavorite(song);
          }

          if (
            action === "playlist"
          ) {
            openAddToPlaylist(
              song
            );
          }

        }
      );

    });
}


function findSong(id) {

  return state.songs.find(
    song =>
      Number(song.id) ===
      Number(id)
  );
}


/* =========================================================
   FAVORITES
   ========================================================= */

async function loadFavorites() {

  try {

    const data =
      await api(
        "/favorites"
      );

    state.favorites =
      data.favorites || [];

    renderFavoriteSongs();

  } catch (error) {

    console.error(
      "Favorites:",
      error
    );
  }
}


function renderFavoriteSongs() {

  const container =
    document.getElementById(
      "favoriteSongs"
    );

  if (!state.favorites.length) {

    container.innerHTML =
      `<div class="empty">
        No favorite songs yet.
      </div>`;

    return;
  }

  container.innerHTML =
    state.favorites
      .map(songHTML)
      .join("");

  bindSongButtons(
    container
  );
}


async function toggleFavorite(
  song
) {

  const liked =
    state.favorites.some(
      item =>
        Number(item.id) ===
        Number(song.id)
    );

  try {

    if (liked) {

      await api(
        "/favorites",
        {
          method: "DELETE",

          body:
            JSON.stringify({
              song_id:
                song.id
            })
        }
      );

    } else {

      await api(
        "/favorites",
        {
          method: "POST",

          body:
            JSON.stringify({
              song_id:
                song.id
            })
        }
      );

    }

    await loadFavorites();

    renderSongs();
    renderRecentSongs();

    updatePlayerLike();

  } catch (error) {

    console.error(
      "Favorite:",
      error
    );

    alert(
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
      await api(
        "/artists?limit=500"
      );

    state.artists =
      data.artists || [];

    renderArtists();

  } catch (error) {

    console.error(
      "Artists:",
      error
    );

    showError(
      "artistsList",
      "Couldn't load artists."
    );
  }
}


function renderArtists() {

  const container =
    document.getElementById(
      "artistsList"
    );

  if (!state.artists.length) {

    container.innerHTML =
      `<div class="empty">
        No artists yet.
      </div>`;

    return;
  }

  container.innerHTML =
    state.artists
      .map(artist => `
        <button
          class="library-item"
          data-artist-id="${artist.id}"
        >

          <div class="library-icon">
            ♪
          </div>

          <div class="library-info">

            <div class="library-name">
              ${escapeHTML(
                artist.name
              )}
            </div>

            <div class="library-meta">
              ${artist.song_count || 0}
              songs
            </div>

          </div>

          <div class="library-arrow">
            ›
          </div>

        </button>
      `)
      .join("");


  container
    .querySelectorAll(
      "[data-artist-id]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openArtist(
            Number(
              button.dataset.artistId
            )
          );

        }
      );

    });
}


async function openArtist(id) {

  try {

    const data =
      await api(
        `/artists/${id}`
      );

    const artist =
      data.artist;

    const songs =
      data.songs || [];

    const container =
      document.getElementById(
        "artistDetail"
      );

    container.innerHTML = `
      <div class="detail-header">

        <h1 class="detail-title">
          ${escapeHTML(
            artist.name
          )}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>

      </div>

      <div class="song-list">
        ${
          songs
            .map(songHTML)
            .join("")
        }
      </div>
    `;

    bindSongButtons(
      container
    );

    showPage(
      "artistDetailPage"
    );

  } catch (error) {

    console.error(
      "Artist detail:",
      error
    );
  }
}


/* =========================================================
   ALBUMS
   ========================================================= */

async function loadAlbums() {

  try {

    const data =
      await api(
        "/albums"
      );

    state.albums =
      data.albums || [];

    renderAlbums();

  } catch (error) {

    console.error(
      "Albums:",
      error
    );

    showError(
      "albumsList",
      "Couldn't load albums."
    );
  }
}


function renderAlbums() {

  const container =
    document.getElementById(
      "albumsList"
    );

  if (!state.albums.length) {

    container.innerHTML =
      `<div class="empty">
        No albums yet.
      </div>`;

    return;
  }

  container.innerHTML =
    state.albums
      .map(album => `
        <button
          class="library-item"
          data-album-id="${album.id}"
        >

          <div class="library-icon">
            ▣
          </div>

          <div class="library-info">

            <div class="library-name">
              ${escapeHTML(
                album.title
              )}
            </div>

            <div class="library-meta">
              ${escapeHTML(
                album.artist ||
                "Unknown Artist"
              )}
              •
              ${album.song_count || 0}
              songs
            </div>

          </div>

          <div class="library-arrow">
            ›
          </div>

        </button>
      `)
      .join("");


  container
    .querySelectorAll(
      "[data-album-id]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openAlbum(
            Number(
              button.dataset.albumId
            )
          );

        }
      );

    });
}


async function openAlbum(id) {

  try {

    const data =
      await api(
        `/albums/${id}`
      );

    const album =
      data.album;

    const songs =
      data.songs || [];

    const container =
      document.getElementById(
        "albumDetail"
      );

    container.innerHTML = `
      <div class="detail-header">

        <h1 class="detail-title">
          ${escapeHTML(
            album.title
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
          songs
            .map(songHTML)
            .join("")
        }
      </div>
    `;

    bindSongButtons(
      container
    );

    showPage(
      "albumDetailPage"
    );

  } catch (error) {

    console.error(
      "Album detail:",
      error
    );
  }
}


/* =========================================================
   PLAYLISTS
   ========================================================= */

async function loadPlaylists() {

  try {

    const data =
      await api(
        "/playlists"
      );

    state.playlists =
      data.playlists || [];

    renderPlaylists();

  } catch (error) {

    console.error(
      "Playlists:",
      error
    );

    showError(
      "playlistsList",
      "Couldn't load playlists."
    );
  }
}


function renderPlaylists() {

  const container =
    document.getElementById(
      "playlistsList"
    );

  if (!state.playlists.length) {

    container.innerHTML =
      `<div class="empty">
        Create your first playlist.
      </div>`;

    return;
  }

  container.innerHTML =
    state.playlists
      .map(playlist => `
        <button
          class="library-item"
          data-playlist-id="${playlist.id}"
        >

          <div class="library-icon">
            ☷
          </div>

          <div class="library-info">

            <div class="library-name">
              ${escapeHTML(
                playlist.name
              )}
            </div>

            <div class="library-meta">
              ${playlist.song_count || 0}
              songs
            </div>

          </div>

          <div class="library-arrow">
            ›
          </div>

        </button>
      `)
      .join("");


  container
    .querySelectorAll(
      "[data-playlist-id]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openPlaylist(
            Number(
              button.dataset.playlistId
            )
          );

        }
      );

    });
}


async function openPlaylist(
  id
) {

  try {

    const data =
      await api(
        `/playlists/${id}/songs`
      );

    const playlist =
      data.playlist;

    const songs =
      data.songs || [];

    const container =
      document.getElementById(
        "playlistDetail"
      );

    container.innerHTML = `
      <div class="detail-header">

        <h1 class="detail-title">
          ${escapeHTML(
            playlist.name
          )}
        </h1>

        <div class="detail-subtitle">
          ${songs.length} songs
        </div>

      </div>

      <div class="song-list">
        ${
          songs
            .map(songHTML)
            .join("")
        }
      </div>
    `;

    bindSongButtons(
      container
    );

    showPage(
      "playlistDetailPage"
    );

  } catch (error) {

    console.error(
      "Playlist:",
      error
    );
  }
}


function setupModals() {

  document
    .getElementById(
      "createPlaylistButton"
    )
    .addEventListener(
      "click",
      () => {

        document
          .getElementById(
            "playlistName"
          )
          .value = "";

        document
          .getElementById(
            "playlistModal"
          )
          .classList.remove(
            "hidden"
          );

      }
    );


  document
    .getElementById(
      "cancelPlaylist"
    )
    .addEventListener(
      "click",
      closePlaylistModal
    );


  document
    .getElementById(
      "savePlaylist"
    )
    .addEventListener(
      "click",
      createPlaylist
    );


  document
    .getElementById(
      "closeAddPlaylist"
    )
    .addEventListener(
      "click",
      () => {

        document
          .getElementById(
            "addToPlaylistModal"
          )
          .classList.add(
            "hidden"
          );

      }
    );
}


function closePlaylistModal() {

  document
    .getElementById(
      "playlistModal"
    )
    .classList.add(
      "hidden"
    );
}


async function createPlaylist() {

  const input =
    document.getElementById(
      "playlistName"
    );

  const name =
    input.value.trim();

  if (!name) {
    return;
  }

  try {

    await api(
      "/playlists",
      {
        method: "POST",

        body:
          JSON.stringify({
            name
          })
      }
    );

    closePlaylistModal();

    await loadPlaylists();

  } catch (error) {

    console.error(
      "Create playlist:",
      error
    );

    alert(
      error.message
    );
  }
}


/* =========================================================
   ADD TO PLAYLIST
   ========================================================= */

let selectedSongForPlaylist =
  null;


async function openAddToPlaylist(
  song
) {

  selectedSongForPlaylist =
    song;

  const modal =
    document.getElementById(
      "addToPlaylistModal"
    );

  const list =
    document.getElementById(
      "addPlaylistList"
    );

  list.innerHTML =
    `<div class="loading">
      Loading playlists...
    </div>`;

  modal.classList.remove(
    "hidden"
  );

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
            +
          </div>

          <div class="library-info">

            <div class="library-name">
              ${escapeHTML(
                playlist.name
              )}
            </div>

            <div class="library-meta">
              ${playlist.song_count || 0}
              songs
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
        async () => {

          const playlistId =
            Number(
              button.dataset
                .addPlaylistId
            );

          try {

            await api(
              `/playlists/${playlistId}/songs`,
              {
                method: "POST",

                body:
                  JSON.stringify({
                    song_id:
                      selectedSongForPlaylist.id
                  })
              }
            );

            modal.classList.add(
              "hidden"
            );

            await loadPlaylists();

          } catch (error) {

            alert(
              error.message
            );
          }

        }
      );

    });
}


/* =========================================================
   PLAYER
   ========================================================= */

function setupPlayer() {

  document
    .getElementById(
      "miniPlayer"
    )
    .addEventListener(
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


  document
    .getElementById(
      "miniPlay"
    )
    .addEventListener(
      "click",
      togglePlay
    );


  document
    .getElementById(
      "miniLike"
    )
    .addEventListener(
      "click",
      () => {

        if (
          state.currentSong
        ) {
          toggleFavorite(
            state.currentSong
          );
        }

      }
    );


  document
    .getElementById(
      "playerClose"
    )
    .addEventListener(
      "click",
      closeFullPlayer
    );


  document
    .getElementById(
      "mainPlay"
    )
    .addEventListener(
      "click",
      togglePlay
    );


  document
    .getElementById(
      "playerLike"
    )
    .addEventListener(
      "click",
      () => {

        if (
          state.currentSong
        ) {
          toggleFavorite(
            state.currentSong
          );
        }

      }
    );


  document
    .getElementById(
      "previousButton"
    )
    .addEventListener(
      "click",
      previousSong
    );


  document
    .getElementById(
      "nextButton"
    )
    .addEventListener(
      "click",
      nextSong
    );


  document
    .getElementById(
      "shuffleButton"
    )
    .addEventListener(
      "click",
      () => {

        state.shuffle =
          !state.shuffle;

        document
          .getElementById(
            "shuffleButton"
          )
          .style.color =
            state.shuffle
              ? "#ffffff"
              : "#777777";

      }
    );


  document
    .getElementById(
      "progress"
    )
    .addEventListener(
      "input",
      event => {

        if (!audio.duration) {
          return;
        }

        audio.currentTime =
          (
            Number(
              event.target.value
            ) / 100
          ) *
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
    nextSong
  );
}


function playSong(song) {

  state.currentSong =
    song;

  state.queue =
    state.songs.slice();

  state.queueIndex =
    state.queue.findIndex(
      item =>
        Number(item.id) ===
        Number(song.id)
    );

  audio.src =
  `${AUDIO_API}/${song.id}?user_id=${encodeURIComponent(state.userId)}`;

  audio.play()
    .catch(error => {

      console.error(
        "Playback:",
        error
      );

    });

  updatePlayerUI();

  api(
    "/recently-played",
    {
      method: "POST",

      body:
        JSON.stringify({
          song_id:
            song.id
        })
    }
  )
  .catch(
    console.error
  );
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

  if (
    audio.paused
  ) {

    audio.play()
      .catch(
        console.error
      );

  } else {

    audio.pause();

  }
}


function nextSong() {

  if (!state.queue.length) {
    return;
  }

  let nextIndex;

  if (state.shuffle) {

    nextIndex =
      Math.floor(
        Math.random() *
        state.queue.length
      );

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

  playSong(
    state.queue[nextIndex]
  );
}


function previousSong() {

  if (
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

  playSong(
    state.queue[index]
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
    "Unknown";

  const artist =
    song.artist ||
    "Unknown Artist";

  document
    .getElementById(
      "miniTitle"
    )
    .textContent =
      title;

  document
    .getElementById(
      "miniArtist"
    )
    .textContent =
      artist;

  document
    .getElementById(
      "playerTitle"
    )
    .textContent =
      title;

  document
    .getElementById(
      "playerArtist"
    )
    .textContent =
      artist;

  miniPlayer
    .classList.remove(
      "hidden"
    );

  updatePlayerLike();
  updatePlayButtons();
}


function updatePlayerLike() {

  if (
    !state.currentSong
  ) {
    return;
  }

  const liked =
    state.favorites.some(
      item =>
        Number(item.id) ===
        Number(
          state.currentSong.id
        )
    );

  document
    .getElementById(
      "miniLike"
    )
    .textContent =
      liked ? "♥" : "♡";

  document
    .getElementById(
      "playerLike"
    )
    .textContent =
      liked ? "♥" : "♡";
}


function updatePlayButtons() {

  const mini =
    document.getElementById("miniPlay");

  const main =
    document.getElementById("mainPlay");


  if (mini) {

    mini.textContent =
      state.isPlaying
      ? "❚❚"
      : "▶";

  }


  if (main) {

    main.innerHTML =
      state.isPlaying

      ?

      `
      <svg viewBox="0 0 24 24">
        <path d="M6 5h4v14H6z"/>
        <path d="M14 5h4v14h-4z"/>
      </svg>
      `

      :

      `
      <svg viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
      `;

  }

}

function openFullPlayer() {

  playerOverlay
    .classList.remove(
      "hidden"
    );

}


function closeFullPlayer() {

  playerOverlay
    .classList.add(
      "hidden"
    );

}


function updateProgress() {

  if (!audio.duration) {
    return;
  }

  const percent =
    (
      audio.currentTime /
      audio.duration
    ) * 100;

  document
    .getElementById(
      "progress"
    )
    .value =
      percent;

  document
    .getElementById(
      "currentTime"
    )
    .textContent =
      formatTime(
        audio.currentTime
      );
}


function updateDuration() {

  document
    .getElementById(
      "duration"
    )
    .textContent =
      formatTime(
        audio.duration
      );
}


function formatTime(seconds) {

  if (
    !Number.isFinite(seconds)
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
    ).padStart(
      2,
      "0"
    )
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


  button.addEventListener(
    "click",
    () => {

      section
        .classList.toggle(
          "hidden"
        );

      if (
        !section.classList.contains(
          "hidden"
        )
      ) {

        input.focus();

      }

    }
  );


  let timer;

  input.addEventListener(
    "input",
    () => {

      clearTimeout(timer);

      timer =
        setTimeout(
          () => search(input.value),
          350
        );

    }
  );
}


async function search(query) {

  const q =
    query.trim();

  if (!q) {

    showPage(
      "homePage"
    );

    return;
  }

  try {

    const data =
      await api(
        `/search?q=${encodeURIComponent(q)}`
      );

    const results =
      data.songs || [];

    const container =
      document.getElementById(
        "searchResults"
      );

    if (!results.length) {

      container.innerHTML =
        `<div class="empty">
          No results found.
        </div>`;

    } else {

      container.innerHTML =
        results
          .map(songHTML)
          .join("");

      bindSongButtons(
        container
      );

    }

    showPage(
      "searchPage"
    );

  } catch (error) {

    console.error(
      "Search:",
      error
    );
  }
}


/* =========================================================
   HELPERS
   ========================================================= */

function showError(
  elementId,
  message
) {

  const element =
    document.getElementById(
      elementId
    );

  if (!element) {
    return;
  }

  element.innerHTML =
    `<div class="empty">
      ${escapeHTML(message)}
    </div>`;
}


function escapeHTML(
  value
) {

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
