const SERVER_IP = "gupipies.icsv.pl";

let currentLanguage = localStorage.getItem("siteLanguage") || "pl";

let players = [];
let news = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


/* =========================================================
   TRANSLATIONS
========================================================= */

function translate(key) {
  return translations[currentLanguage]?.[key]
    || translations.pl?.[key]
    || key;
}


function text(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value[currentLanguage]
    || value.pl
    || value.en
    || "";
}


function applyTranslations() {
  $$("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (translations[currentLanguage]?.[key]) {
      element.textContent = translate(key);
    }
  });

  $$("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;

    if (translations[currentLanguage]?.[key]) {
      element.placeholder = translate(key);
    }
  });

  document.documentElement.lang = currentLanguage;

  updatePageTitle();
  updateLanguageButtons();
}


function updatePageTitle() {
  const titleElement = $("title[data-i18n]");

  if (!titleElement) {
    return;
  }

  const key = titleElement.dataset.i18n;

  if (translations[currentLanguage]?.[key]) {
    titleElement.textContent = translate(key);
  }
}


function updateLanguageButtons() {
  $$("[data-lang]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.lang === currentLanguage
    );
  });
}


function setupLanguageSwitcher() {
  $$("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      const language = button.dataset.lang;

      if (!translations[language]) {
        return;
      }

      currentLanguage = language;

      localStorage.setItem(
        "siteLanguage",
        currentLanguage
      );

      applyTranslations();

      renderPlayers();
      renderNews();
      renderHomeNews();

      const dialog = $("#player-dialog");

      if (
        dialog &&
        dialog.open &&
        window.currentOpenedPlayer
      ) {
        openPlayer(window.currentOpenedPlayer);
      }
    });
  });
}


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    currentLanguage === "pl"
      ? "pl-PL"
      : "en-US",
    {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}


async function loadJSON(path) {
  const response = await fetch(path, {
    cache: "no-cache"
  });

  if (!response.ok) {
    throw new Error(
      `Could not load ${path}: ${response.status}`
    );
  }

  return response.json();
}


/* =========================================================
   PLAYERS
========================================================= */

function setupPlayerSearch() {
  const searchInput = $("#player-search");

  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", () => {
    renderPlayers(searchInput.value);
  });
}


function renderPlayers(searchValue = "") {
  const container = $("#player-list");
  const emptyState = $("#players-empty");

  if (!container) {
    return;
  }

  const query = searchValue
    .trim()
    .toLowerCase();

  const filteredPlayers = players.filter((player) => {
    return player.nick
      .toLowerCase()
      .includes(query);
  });

  container.innerHTML = "";

  filteredPlayers.forEach((player) => {
    const index = players.indexOf(player);

    const card = document.createElement("button");

    card.className = "player-card";
    card.type = "button";

    card.dataset.playerIndex = index;

    card.setAttribute(
      "aria-label",
      player.nick
    );

    card.innerHTML = `
      <div class="skin">
        <img
          src="${escapeHTML(player.image || "")}"
          alt="${escapeHTML(player.nick)}"
          loading="lazy"
          onerror="this.style.visibility='hidden'"
        >
      </div>

      <h3>
        ${escapeHTML(player.nick)}
      </h3>
    `;

    card.addEventListener("click", () => {
      openPlayer(player);
    });

    container.appendChild(card);
  });

  if (emptyState) {
    emptyState.classList.toggle(
      "hidden",
      filteredPlayers.length !== 0
    );
  }
}


function setupPlayerDialog() {
  const dialog = $("#player-dialog");

  if (!dialog) {
    return;
  }

  // Poprawiono z [data-close-dialog] na #close-player, żeby pasowało do HTML
  const closeButton = dialog.querySelector("#close-player");

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      () => dialog.close()
    );
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}


function openPlayer(player) {
  const dialog = $("#player-dialog");
  const profile = $("#player-profile");

  if (!dialog || !profile) {
    return;
  }

  window.currentOpenedPlayer = player;

  profile.innerHTML = `
    <div class="profile-image">
      <img
        src="${escapeHTML(player.image || "")}"
        alt="${escapeHTML(player.nick)}"
        onerror="this.style.visibility='hidden'"
      >
    </div>

    <div class="profile-content">

      <p class="eyebrow">
        ${escapeHTML(translate("profileLabel"))}
      </p>

      <h2>
        ${escapeHTML(player.nick)}
      </h2>

      <p class="profile-description">
        ${escapeHTML(
          text(player.description)
        )}
      </p>

    </div>
  `;

  if (!dialog.open) {
    dialog.showModal();
  }
}


/* =========================================================
   NEWS
========================================================= */

function sortedNews() {
  return [...news].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
}


function videoMarkup(item) {
  const subtitlesUrl =
    item.videoSubtitles?.trim() || "";

  const noSubtitlesUrl =
    item.videoNoSubtitles?.trim() || "";

  if (!subtitlesUrl && !noSubtitlesUrl) {
    return "";
  }

  let buttons = "";

  if (subtitlesUrl) {
    buttons += `
      <button
        type="button"
        class="video-option active"
        data-video-url="${escapeHTML(subtitlesUrl)}"
      >
        ${escapeHTML(
          translate("subtitles")
        )}
      </button>
    `;
  }

  if (noSubtitlesUrl) {
    buttons += `
      <button
        type="button"
        class="video-option ${
          subtitlesUrl ? "" : "active"
        }"
        data-video-url="${escapeHTML(noSubtitlesUrl)}"
      >
        ${escapeHTML(
          translate("noSubtitles")
        )}
      </button>
    `;
  }

  const initialUrl =
    subtitlesUrl || noSubtitlesUrl;

  return `
    <div class="video-block">

      <div class="video-switch">
        ${buttons}
      </div>

      <div class="video-frame">

        <iframe
          src="${escapeHTML(initialUrl)}"
          title="${escapeHTML(text(item.title))}"
          loading="lazy"
          allow="autoplay; encrypted-media"
          allowfullscreen>
        </iframe>

      </div>

    </div>
  `;
}


function renderNews() {
  const container = $("#news-list");
  const emptyState = $("#news-empty");

  if (!container) {
    return;
  }

  const sorted = sortedNews();

  container.innerHTML = "";

  sorted.forEach((item) => {
    const article = document.createElement("article");

    article.className = "news-entry";

    article.innerHTML = `
      <div class="news-meta">
        ${escapeHTML(
          translate("published")
        )}
        ·
        ${escapeHTML(
          formatDate(item.date)
        )}
      </div>

      <h2>
        ${escapeHTML(
          text(item.title)
        )}
      </h2>

      <p class="news-body">
        ${escapeHTML(
          text(item.description)
        )}
      </p>

      ${videoMarkup(item)}
    `;

    container.appendChild(article);
  });

  if (emptyState) {
    emptyState.classList.toggle(
      "hidden",
      sorted.length !== 0
    );
  }

  setupVideoButtons();
}


function setupVideoButtons() {
  $$(".video-switch").forEach((switcher) => {
    const buttons =
      switcher.querySelectorAll(
        ".video-option"
      );

    const videoBlock =
      switcher.closest(".video-block");

    if (!videoBlock) {
      return;
    }

    const iframe =
      videoBlock.querySelector("iframe");

    if (!iframe) {
      return;
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => {

        const url =
          button.dataset.videoUrl;

        if (!url) {
          return;
        }

        iframe.src = url;

        buttons.forEach((otherButton) => {
          otherButton.classList.remove(
            "active"
          );
        });

        button.classList.add("active");
      });
    });
  });
}


/* =========================================================
   HOME NEWS
========================================================= */

function renderHomeNews() {
  const container = $("#home-news");

  if (!container) {
    return;
  }

  const latest = sortedNews().slice(0, 3);

  container.innerHTML = "";

  latest.forEach((item) => {
    const article =
      document.createElement("article");

    article.className = "news-card";

    article.innerHTML = `
      <div class="news-meta">
        ${escapeHTML(
          formatDate(item.date)
        )}
      </div>

      <h3>
        ${escapeHTML(
          text(item.title)
        )}
      </h3>

      <p>
        ${escapeHTML(
          text(item.description)
        )}
      </p>

      <a
        class="text-link"
        href="news.html">
        ${escapeHTML(
          translate("readMore")
        )}
      </a>
    `;

    container.appendChild(article);
  });
}


/* =========================================================
   COPY SERVER IP
========================================================= */

function setupIPCopy() {
  const button = $("#copy-ip");
  const statusElement = $("#copy-status");

  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(SERVER_IP);

      if (statusElement) {
        statusElement.textContent = translate("copySuccess");
      } else {
        button.textContent = translate("copySuccess");
      }

      setTimeout(() => {
        if (statusElement) {
          statusElement.textContent = "";
        } else {
          button.textContent = translate("copyIp");
          applyTranslations(); // Przywraca tłumaczenie z data-i18n
        }
      }, 2000);

    } catch (error) {
      console.error("Clipboard error:", error);

      if (statusElement) {
        statusElement.textContent = translate("copyError");
      } else {
        button.textContent = translate("copyError");
      }

      setTimeout(() => {
        if (statusElement) {
          statusElement.textContent = "";
        } else {
          button.textContent = translate("copyIp");
          applyTranslations();
        }
      }, 2500);
    }
  });
}


/* =========================================================
   SERVER ADDRESS
========================================================= */

function setupServerIP() {
  $$("[data-server-ip]").forEach(
    (element) => {
      element.textContent = SERVER_IP;
    }
  );
}


/* =========================================================
   YEAR
========================================================= */

function setupYear() {
  const yearElement = $("#year");

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {
  setupYear();
  setupLanguageSwitcher();
  setupPlayerSearch();
  setupPlayerDialog();
  setupIPCopy();
  setupServerIP();

  applyTranslations();

  try {
    const [loadedPlayers, loadedNews] =
      await Promise.all([
        loadJSON("data/players.json"),
        loadJSON("data/news.json")
      ]);

    players =
      Array.isArray(loadedPlayers)
        ? loadedPlayers
        : [];

    news =
      Array.isArray(loadedNews)
        ? loadedNews
        : [];

  } catch (error) {

    console.error(
      "Failed to load website data:",
      error
    );

    players = [];
    news = [];
  }

  renderPlayers();
  renderNews();
  renderHomeNews();
}


document.addEventListener(
  "DOMContentLoaded",
  initialize
);