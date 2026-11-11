(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  let gamePlayers = [];
  let guessOrder = [];
  let guessIndex = 0;
  let gridRemaining = [];
  let gridTarget = null;
  let gridRoundPlayers = [];
  let lives = 3;
  let language = localStorage.getItem("siteLanguage") || "pl";
  let guessFeedbackKey = "";
  let gridFeedbackKey = "";
  let guessRenderToken = 0;
  let guessSkinMode = "cropped";

  const tr = (key) => translations?.[language]?.[key]
    || translations?.pl?.[key] || key;

  const shuffle = (items) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const normalize = (value) => String(value || "").trim().toLocaleLowerCase();

  function showPanel(name) {
    $("#game-picker").classList.add("hidden");
    $("#guess-panel").classList.toggle("hidden", name !== "guess");
    $("#grid-panel").classList.toggle("hidden", name !== "grid");
  }

  function showPicker() {
    guessRenderToken++;
    $("#game-picker").classList.remove("hidden");
    $("#guess-panel").classList.add("hidden");
    $("#grid-panel").classList.add("hidden");
  }

  function startGuessGame() {
    if (!gamePlayers.length) return;
    guessOrder = shuffle(gamePlayers);
    guessIndex = 0;
    $("#guess-result").classList.add("hidden");
    guessFeedbackKey = "";
    $("#guess-feedback").textContent = "";
    $("#guess-form").classList.remove("hidden");
    $("#guess-next").classList.add("hidden");
    $("#guess-input").value = "";
    showPanel("guess");
    renderGuessRound();
  }

  function getVisibleBounds(imageData, width, height) {
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;
    return { minX, minY, maxX, maxY };
  }

  function countVisiblePixels(data, width, x, y, w, h) {
    let count = 0;
    const step = 3;

    for (let py = y; py < y + h; py += step) {
      for (let px = x; px < x + w; px += step) {
        if (data[(py * width + px) * 4 + 3] > 24) count++;
      }
    }

    return count;
  }

  function createRandomSkinFragment(image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;

    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0, width, height);

    let imageData;
    try {
      imageData = sourceContext.getImageData(0, 0, width, height);
    } catch (error) {
      console.error("Could not inspect skin transparency:", error);
      return image.src;
    }

    const bounds = getVisibleBounds(imageData, width, height);
    if (!bounds) return image.src;

    const bodyWidth = bounds.maxX - bounds.minX + 1;
    const bodyHeight = bounds.maxY - bounds.minY + 1;

    // Use small random windows so the clue is much harder to recognize.
    // Every candidate is checked for visible pixels before it can be selected.
    let crop = null;

    for (let attempt = 0; attempt < 240; attempt++) {
      const w = Math.max(1, Math.floor(bodyWidth * (0.20 + Math.random() * 0.14)));
      const h = Math.max(1, Math.floor(bodyHeight * (0.18 + Math.random() * 0.12)));
      const x = Math.floor(bounds.minX + Math.random() * Math.max(1, bodyWidth - w));
      const y = Math.floor(bounds.minY + Math.random() * Math.max(1, bodyHeight - h));
      const candidate = { x, y, w, h };

      if (countVisiblePixels(imageData.data, width, x, y, w, h) >= 2) {
        crop = candidate;
        break;
      }
    }

    // If the random search lands on transparent areas, gradually widen the search window.
    if (!crop) {
      for (let attempt = 0; attempt < 160; attempt++) {
        const w = Math.max(1, Math.floor(bodyWidth * (0.24 + Math.random() * 0.12)));
        const h = Math.max(1, Math.floor(bodyHeight * (0.22 + Math.random() * 0.12)));
        const x = Math.floor(bounds.minX + Math.random() * Math.max(1, bodyWidth - w));
        const y = Math.floor(bounds.minY + Math.random() * Math.max(1, bodyHeight - h));
        if (countVisiblePixels(imageData.data, width, x, y, w, h) >= 2) {
          crop = { x, y, w, h };
          break;
        }
      }
    }
    if (!crop) return image.src;

    // Tighten the selected crop to its actual visible pixels, so no empty tile is shown.
    let minX = crop.x + crop.w;
    let minY = crop.y + crop.h;
    let maxX = crop.x - 1;
    let maxY = crop.y - 1;

    for (let y = crop.y; y < crop.y + crop.h; y++) {
      for (let x = crop.x; x < crop.x + crop.w; x++) {
        if (imageData.data[(y * width + x) * 4 + 3] > 24) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return image.src;

    const padding = Math.max(5, Math.floor(Math.min(maxX - minX + 1, maxY - minY + 1) * 0.10));
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    outputCanvas.getContext("2d").drawImage(
      sourceCanvas,
      minX, minY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    return outputCanvas.toDataURL("image/png");
  }

  function renderGuessRound() {
    const player = guessOrder[guessIndex];
    if (!player) return;

    const token = ++guessRenderToken;
    const skin = $("#guess-skin");
    skin.alt = tr("guessPrompt");
    skin.dataset.loading = "true";

    const image = new Image();
    image.onload = () => {
      if (token !== guessRenderToken) return;
      skin.src = guessSkinMode === "full" ? player.image : createRandomSkinFragment(image);
      skin.dataset.loading = "false";
    };
    image.onerror = () => {
      if (token !== guessRenderToken) return;
      skin.src = player.image;
      skin.dataset.loading = "false";
    };
    image.src = player.image;

    guessFeedbackKey = "";
    $("#guess-feedback").textContent = "";
    $("#guess-input").value = "";
    $("#guess-input").disabled = false;
    $("#guess-form").querySelector("button").disabled = false;
    $("#guess-input").focus();
  }

  function submitGuess(event) {
    event.preventDefault();
    const player = guessOrder[guessIndex];
    const answer = normalize($("#guess-input").value);
    if (!answer) return;
    if (answer === "gupi pies") {
      window.location.href = "secret.html";
      return;
    }
    if (answer === normalize(player.nick)) {
      guessFeedbackKey = "correctAnswer";
      $("#guess-feedback").textContent = tr(guessFeedbackKey);
      $("#guess-input").disabled = true;
      $("#guess-form").querySelector("button").disabled = true;
      if (guessIndex === guessOrder.length - 1) {
        $("#guess-result-text").textContent = tr("guessWon");
        $("#guess-result").classList.remove("hidden");
        $("#guess-next").classList.add("hidden");
        $("#guess-form").classList.add("hidden");
      } else {
        $("#guess-next").classList.remove("hidden");
      }
    } else {
      guessFeedbackKey = "wrongAnswer";
      $("#guess-feedback").textContent = tr(guessFeedbackKey);
      $("#guess-input").select();
    }
  }

  function nextGuess() {
    guessIndex++;
    if (guessIndex >= guessOrder.length) {
      $("#guess-result-text").textContent = tr("guessFinished");
      $("#guess-result").classList.remove("hidden");
      $("#guess-next").classList.add("hidden");
      $("#guess-form").classList.add("hidden");
      return;
    }
    renderGuessRound();
  }

  function startGridGame() {
    if (gamePlayers.length < 9) {
      $("#grid-feedback").textContent = tr("noPlayersForGame");
      showPanel("grid");
      $("#skin-grid").innerHTML = "";
      $("#target-nick").textContent = "—";
      return;
    }
    gridRemaining = shuffle(gamePlayers);
    lives = 3;
    $("#grid-result").classList.add("hidden");
    gridFeedbackKey = "";
    $("#grid-feedback").textContent = "";
    showPanel("grid");
    renderGridRound();
  }

  function renderGridRound() {
    if (gridRemaining.length === 0) {
      endGridGame(true);
      return;
    }

    gridRoundPlayers = shuffle(gridRemaining).slice(0, 9);
    gridTarget = null;
    gridFeedbackKey = "";
    $("#grid-feedback").textContent = "";

    const grid = $("#skin-grid");
    grid.innerHTML = "";

    // This mode intentionally keeps the complete player skins unchanged.
    gridRoundPlayers.forEach((player) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "skin-tile";
      button.setAttribute("aria-label", player.nick);
      button.dataset.nick = player.nick;
      button.innerHTML = `<img src="${escapeAttribute(player.image)}" alt="" loading="lazy">`;
      button.addEventListener("click", () => chooseGridPlayer(player, button));
      grid.appendChild(button);
    });

    chooseNextGridTarget();
  }

  function chooseNextGridTarget() {
    const available = gridRoundPlayers.filter((player) => {
      const button = $("#skin-grid").querySelector(`[data-nick="${CSS.escape(player.nick)}"]`);
      return button && !button.disabled;
    });

    if (!available.length) {
      renderGridRound();
      return;
    }

    gridTarget = available[Math.floor(Math.random() * available.length)];
    $("#target-nick").textContent = gridTarget.nick;
    $("#lives-count").textContent = "♥ ".repeat(lives).trim() || "—";
  }

  function chooseGridPlayer(player, button) {
    if (button.disabled || !gridTarget) return;

    if (player.nick === gridTarget.nick) {
      gridRemaining = gridRemaining.filter((item) => item.nick !== player.nick);
      button.classList.remove("is-wrong");
      button.classList.add("is-correct");
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      gridFeedbackKey = "gridCorrect";
      $("#grid-feedback").textContent = tr(gridFeedbackKey);

      gridTarget = null;

      $("#skin-grid").querySelectorAll("button.is-wrong").forEach((wrongButton) => {
        wrongButton.disabled = false;
        wrongButton.removeAttribute("aria-disabled");
        wrongButton.classList.remove("is-wrong");
      });

      const activeButtons = $("#skin-grid").querySelectorAll("button:not(:disabled)");
      if (gridRemaining.length === 0) {
        endGridGame(true);
      } else if (activeButtons.length > 0) {
        chooseNextGridTarget();
      } else {
        renderGridRound();
      }
    } else {
      lives--;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.classList.add("is-wrong");
      $("#lives-count").textContent = "♥ ".repeat(lives).trim() || "—";
      gridFeedbackKey = "gridWrong";
      $("#grid-feedback").textContent = tr(gridFeedbackKey);
      if (lives <= 0) {
        gridTarget = null;
        endGridGame(false);
      }
    }
  }

  function endGridGame(won) {
    gridFeedbackKey = won ? "gameWon" : "gameLost";
    $("#grid-result-text").textContent = tr(gridFeedbackKey);
    $("#grid-result").classList.remove("hidden");
    $("#skin-grid").querySelectorAll("button").forEach((button) => button.disabled = true);
  }

  function escapeAttribute(value) {
    return String(value || "").replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function refreshLanguage() {
    language = localStorage.getItem("siteLanguage") || language;

    if (guessFeedbackKey) {
      $("#guess-feedback").textContent = tr(guessFeedbackKey);
    }

    if (gridFeedbackKey) {
      if (gridFeedbackKey === "gameWon" || gridFeedbackKey === "gameLost") {
        $("#grid-result-text").textContent = tr(gridFeedbackKey);
      } else {
        $("#grid-feedback").textContent = tr(gridFeedbackKey);
      }
    }

    $("#guess-skin").alt = tr("guessPrompt");
  }

  window.addEventListener("siteLanguageChanged", refreshLanguage);

  async function init() {
    $("#game-picker").addEventListener("click", (event) => {
      const choice = event.target.closest("[data-game]");
      if (!choice) return;
      if (choice.dataset.game === "guess") startGuessGame();
      if (choice.dataset.game === "grid") startGridGame();
    });
    $$("[data-back]").forEach((button) => button.addEventListener("click", showPicker));
    $$("[data-restart]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.restart === "guess") startGuessGame();
      else startGridGame();
    }));
    $("#guess-form").addEventListener("submit", submitGuess);
    $("#guess-next").addEventListener("click", nextGuess);
    $$("[data-guess-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        guessSkinMode = button.dataset.guessMode;
        $$("[data-guess-mode]").forEach((modeButton) => {
          modeButton.classList.toggle("active", modeButton.dataset.guessMode === guessSkinMode);
        });
        if (guessOrder.length && !$("#guess-panel").classList.contains("hidden")) {
          renderGuessRound();
        }
      });
    });
    try {
      const response = await fetch("data/players.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      gamePlayers = await response.json();
      gamePlayers = gamePlayers.filter((player) => player.nick && player.image);
    } catch (error) {
      console.error("Could not load players for games:", error);
      const feedback = $("#guess-feedback") || $("#grid-feedback");
      if (feedback) feedback.textContent = tr("noPlayersForGame");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
