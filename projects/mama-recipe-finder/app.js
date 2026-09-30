const API_BASE = "https://www.themealdb.com/api/json/v1/1";
const STORAGE_KEY = "recipeFinder.settings.v1";
const FAVORITES_KEY = "recipeFinder.favorites.v1";
const CLAUDE_KEY_STORAGE = "recipeFinder.claudeApiKey.v1";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

const DEFAULT_SETTINGS = {
  theme: "light",
  accent: "#ff6b35",
  view: "grid",
  defaultArea: "",
  defaultCategory: "",
  liveSearch: true,
};

let settings = loadSettings();
let favorites = loadFavorites();
let currentView = settings.view;
let currentMealForModal = null;
let variantMeals = [];
let previousTab = "discover";

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheEls();
  applyTheme();
  applyAccent();
  bindTabs();
  bindSettingsUI();
  bindResultControls();
  bindModal();
  bindAiChef();
  bindApiKeyBanner();

  await Promise.all([populateCategories(), populateAreas(), populateIngredients(), loadVariantMeals()]);
  applyDefaultFilters();
  setView(currentView, false);
  loadRecipes();
  renderFavoritesTab();
  updateFavCountBadge();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (settings.theme === "auto") applyTheme();
  });
}

function cacheEls() {
  Object.assign(els, {
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
    clearBtn: document.getElementById("clearBtn"),
    categoryFilter: document.getElementById("categoryFilter"),
    areaFilter: document.getElementById("areaFilter"),
    ingredientFilter: document.getElementById("ingredientFilter"),
    results: document.getElementById("results"),
    resultCount: document.getElementById("resultCount"),
    loader: document.getElementById("loader"),
    emptyState: document.getElementById("emptyState"),
    detailContent: document.getElementById("detailContent"),
    detailBackBtn: document.getElementById("detailBackBtn"),
    detailFavBtn: document.getElementById("detailFavBtn"),
    viewToggle: document.getElementById("viewToggle"),
    favoritesResults: document.getElementById("favoritesResults"),
    favEmptyState: document.getElementById("favEmptyState"),
    favCount: document.getElementById("favCount"),
    favSummary: document.getElementById("favSummary"),
    clearFavsBtn: document.getElementById("clearFavsBtn"),
    resetSettingsBtn: document.getElementById("resetSettingsBtn"),
    themeSegmented: document.getElementById("themeSegmented"),
    viewSegmented: document.getElementById("viewSegmented"),
    accentSwatches: document.getElementById("accentSwatches"),
    defaultAreaSetting: document.getElementById("defaultAreaSetting"),
    defaultCategorySetting: document.getElementById("defaultCategorySetting"),
    liveSearchToggle: document.getElementById("liveSearchToggle"),
    toast: document.getElementById("toast"),
    aiChefInput: document.getElementById("aiChefInput"),
    aiChefBtn: document.getElementById("aiChefBtn"),
    aiChefStatus: document.getElementById("aiChefStatus"),
    aiChefNoKey: document.getElementById("aiChefNoKey"),
    aiChefGoSettings: document.getElementById("aiChefGoSettings"),
    aiChefLoader: document.getElementById("aiChefLoader"),
    aiChefResults: document.getElementById("aiChefResults"),
    claudeApiKeyInput: document.getElementById("claudeApiKeyInput"),
    saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
    clearApiKeyBtn: document.getElementById("clearApiKeyBtn"),
    apiKeyStatus: document.getElementById("apiKeyStatus"),
    apiKeyBanner: document.getElementById("apiKeyBanner"),
    apiKeyBannerBtn: document.getElementById("apiKeyBannerBtn"),
    apiKeyBannerDismiss: document.getElementById("apiKeyBannerDismiss"),
  });
}

/* ================= Settings persistence ================= */

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); }

/* ================= Theme / Accent ================= */

function applyTheme() {
  let effective = settings.theme;
  if (effective === "auto") {
    effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", effective);
  updateSegmented(els.themeSegmented, settings.theme);
}

function applyAccent() {
  const hex = settings.accent;
  document.documentElement.style.setProperty("--primary", hex);
  document.documentElement.style.setProperty("--primary-dark", shadeColor(hex, -15));
  document.documentElement.style.setProperty("--primary-rgb", hexToRgb(hex));
  document.querySelectorAll("#accentSwatches .swatch").forEach((sw) => {
    sw.classList.toggle("active", sw.dataset.color.toLowerCase() === hex.toLowerCase());
  });
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function shadeColor(hex, percent) {
  const m = hex.replace("#", "");
  let r = parseInt(m.substring(0, 2), 16);
  let g = parseInt(m.substring(2, 4), 16);
  let b = parseInt(m.substring(4, 6), 16);
  r = Math.max(0, Math.min(255, Math.round(r + (percent / 100) * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + (percent / 100) * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + (percent / 100) * 255)));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function updateSegmented(container, value) {
  if (!container) return;
  container.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
}

/* ================= Tabs ================= */

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
  if (tab === "favorites") renderFavoritesTab();
  if (tab === "aichef") updateAiChefKeyNotice();
  if (tab === "community") renderCommunityTab();
}

/* ================= Settings UI bindings ================= */

function bindSettingsUI() {
  els.themeSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.theme = btn.dataset.value;
      saveSettings();
      applyTheme();
      showToast(`Theme set to ${btn.dataset.value}`);
    });
  });

  els.viewSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.view = btn.dataset.value;
      saveSettings();
      updateSegmented(els.viewSegmented, settings.view);
      setView(settings.view);
      showToast(`Default view set to ${btn.dataset.value}`);
    });
  });

  els.accentSwatches.querySelectorAll(".swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      settings.accent = sw.dataset.color;
      saveSettings();
      applyAccent();
      showToast("Accent color updated");
    });
  });

  els.defaultAreaSetting.addEventListener("change", () => {
    settings.defaultArea = els.defaultAreaSetting.value;
    saveSettings();
    showToast("Default cuisine saved");
  });

  els.defaultCategorySetting.addEventListener("change", () => {
    settings.defaultCategory = els.defaultCategorySetting.value;
    saveSettings();
    showToast("Default category saved");
  });

  els.liveSearchToggle.addEventListener("change", () => {
    settings.liveSearch = els.liveSearchToggle.checked;
    saveSettings();
  });

  els.clearFavsBtn.addEventListener("click", () => {
    if (Object.keys(favorites).length === 0) return;
    favorites = {};
    saveFavorites();
    renderFavoritesTab();
    updateFavCountBadge();
    updateFavSummary();
    refreshCardFavStates();
    showToast("Favorites cleared");
  });

  els.resetSettingsBtn.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    applyTheme();
    applyAccent();
    els.defaultAreaSetting.value = "";
    els.defaultCategorySetting.value = "";
    els.liveSearchToggle.checked = true;
    updateSegmented(els.viewSegmented, settings.view);
    setView(settings.view);
    showToast("Settings reset to default");
  });

  updateSegmented(els.themeSegmented, settings.theme);
  updateSegmented(els.viewSegmented, settings.view);
  els.liveSearchToggle.checked = settings.liveSearch;
  updateFavSummary();

  bindApiKeyUI();
}

/* ================= Claude API key ================= */

function getClaudeApiKey() {
  try {
    return localStorage.getItem(CLAUDE_KEY_STORAGE) || "";
  } catch (e) { return ""; }
}

function setClaudeApiKey(key) {
  try {
    if (key) localStorage.setItem(CLAUDE_KEY_STORAGE, key);
    else localStorage.removeItem(CLAUDE_KEY_STORAGE);
  } catch (e) { /* storage unavailable */ }
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return key.slice(0, 7) + "…" + key.slice(-4);
}

function updateApiKeyStatus() {
  const key = getClaudeApiKey();
  if (els.apiKeyStatus) {
    els.apiKeyStatus.textContent = key ? `Key saved (${maskKey(key)})` : "No key saved";
  }
}

let apiKeyBannerDismissedForSession = false;

function updateApiKeyBanner() {
  if (!els.apiKeyBanner) return;
  const hasKey = !!getClaudeApiKey();
  const shouldShow = !hasKey && !apiKeyBannerDismissedForSession;
  els.apiKeyBanner.classList.toggle("hidden", !shouldShow);
}

function bindApiKeyBanner() {
  if (!els.apiKeyBanner) return;
  els.apiKeyBannerBtn.addEventListener("click", () => {
    switchTab("settings");
    els.claudeApiKeyInput.focus();
  });
  els.apiKeyBannerDismiss.addEventListener("click", () => {
    apiKeyBannerDismissedForSession = true;
    updateApiKeyBanner();
  });
}

function bindApiKeyUI() {
  if (!els.saveApiKeyBtn) return;
  updateApiKeyStatus();
  updateApiKeyBanner();

  els.saveApiKeyBtn.addEventListener("click", () => {
    const val = els.claudeApiKeyInput.value.trim();
    if (!val) {
      showToast("Enter a Claude API key first");
      return;
    }
    setClaudeApiKey(val);
    els.claudeApiKeyInput.value = "";
    updateApiKeyStatus();
    updateAiChefKeyNotice();
    updateApiKeyBanner();
    showToast("Claude API key saved");
  });

  els.clearApiKeyBtn.addEventListener("click", () => {
    setClaudeApiKey("");
    els.claudeApiKeyInput.value = "";
    updateApiKeyStatus();
    updateAiChefKeyNotice();
    apiKeyBannerDismissedForSession = false;
    updateApiKeyBanner();
    showToast("Claude API key cleared");
  });
}

function applyDefaultFilters() {
  if (settings.defaultArea) {
    els.areaFilter.value = settings.defaultArea;
    els.defaultAreaSetting.value = settings.defaultArea;
  }
  if (settings.defaultCategory) {
    els.categoryFilter.value = settings.defaultCategory;
    els.defaultCategorySetting.value = settings.defaultCategory;
  }
}

function updateFavSummary() {
  const n = Object.keys(favorites).length;
  els.favSummary.textContent = `${n} recipe${n === 1 ? "" : "s"} saved locally`;
}

/* ================= View toggle ================= */

function bindResultControls() {
  els.viewToggle.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  els.searchBtn.addEventListener("click", loadRecipes);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRecipes();
  });
  let debounceTimer = null;
  els.searchInput.addEventListener("input", () => {
    if (!settings.liveSearch) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadRecipes, 500);
  });
  els.categoryFilter.addEventListener("change", loadRecipes);
  els.areaFilter.addEventListener("change", loadRecipes);
  els.ingredientFilter.addEventListener("change", loadRecipes);
  els.clearBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.categoryFilter.value = "";
    els.areaFilter.value = "";
    els.ingredientFilter.value = "";
    loadRecipes();
  });
}

function setView(view, persist = true) {
  currentView = view;
  els.results.classList.toggle("list-view", view === "list");
  els.favoritesResults.classList.toggle("list-view", view === "list");
  els.viewToggle.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

/* ================= Toast ================= */

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  els.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.classList.remove("show"); }, 2200);
}

/* ================= Data population ================= */

async function populateCategories() {
  try {
    const res = await fetch(`${API_BASE}/list.php?c=list`);
    const data = await res.json();
    fillSelect(els.categoryFilter, data.meals, "strCategory");
    fillSelect(els.defaultCategorySetting, data.meals, "strCategory");

    // Locally-generated categories (Burger, Nuggets) don't exist in
    // TheMealDB's own category list, so add them so those recipes are
    // actually reachable via the filter.
    const extraCategories = ["Burger", "Nuggets"];
    const existingValues = new Set(Array.from(els.categoryFilter.options).map((o) => o.value));
    extraCategories.forEach((cat) => {
      if (!existingValues.has(cat)) {
        fillSelect(els.categoryFilter, [{ strCategory: cat }], "strCategory");
        fillSelect(els.defaultCategorySetting, [{ strCategory: cat }], "strCategory");
      }
    });

    sortSelectOptions(els.categoryFilter);
    sortSelectOptions(els.defaultCategorySetting);
  } catch (e) { console.error("categories failed", e); }
}

async function populateAreas() {
  try {
    const res = await fetch(`${API_BASE}/list.php?a=list`);
    const data = await res.json();
    fillSelect(els.areaFilter, data.meals, "strArea");
    fillSelect(els.defaultAreaSetting, data.meals, "strArea");

    // TheMealDB's own recipe data uses a handful of area names that don't
    // appear in its official area list (e.g. "France" instead of "French",
    // "United States" instead of "American"). Add them so those recipes
    // are actually reachable via the filter.
    const extraAreas = ["Slovakia", "France", "Venezuela", "Argentina", "India", "United States", "Netherlands", "Norway"];
    const existingValues = new Set(Array.from(els.areaFilter.options).map((o) => o.value));
    extraAreas.forEach((area) => {
      if (!existingValues.has(area)) {
        fillSelect(els.areaFilter, [{ strArea: area }], "strArea");
        fillSelect(els.defaultAreaSetting, [{ strArea: area }], "strArea");
      }
    });

    sortSelectOptions(els.areaFilter);
    sortSelectOptions(els.defaultAreaSetting);
  } catch (e) { console.error("areas failed", e); }
}

function sortSelectOptions(select) {
  const placeholder = select.options[0];
  const rest = Array.from(select.options).slice(1);
  rest.sort((a, b) => a.value.localeCompare(b.value));
  select.innerHTML = "";
  select.appendChild(placeholder);
  rest.forEach((opt) => select.appendChild(opt));
}

async function populateIngredients() {
  try {
    const res = await fetch(`${API_BASE}/list.php?i=list`);
    const data = await res.json();
    const sorted = (data.meals || []).sort((a, b) => a.strIngredient.localeCompare(b.strIngredient));
    fillSelect(els.ingredientFilter, sorted, "strIngredient");
  } catch (e) { console.error("ingredients failed", e); }
}

function fillSelect(select, items, key) {
  (items || []).forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item[key];
    opt.textContent = item[key];
    select.appendChild(opt);
  });
}

const LFS_MEDIA_BASE = "https://media.githubusercontent.com/media/swaruprihaan-arch/Recipe-Finder/main";

async function loadVariantMeals() {
  try {
    if (Array.isArray(window.__RECIPE_VARIANT_DATA__)) {
      variantMeals = window.__RECIPE_VARIANT_DATA__;
      return;
    }
    // GitHub Pages does not resolve Git LFS pointers via a same-origin
    // <script>/fetch of variant_meals.json (and the LFS media CDN serves it
    // as text/plain, which browsers refuse to execute as a <script> under
    // nosniff) — so on github.io, fetch the JSON straight from the LFS
    // media CDN and JSON.parse it, which fetch() happily allows.
    const onPages = /\.github\.io$/.test(location.hostname);
    const url = onPages ? `${LFS_MEDIA_BASE}/variant_meals.json` : "variant_meals.json";
    const res = await fetch(url);
    variantMeals = await res.json();
  } catch (e) {
    console.error("failed to load local variant recipes", e);
    variantMeals = [];
  }
}

function searchVariantMeals(query) {
  const q = query.toLowerCase();
  return variantMeals.filter((m) => m.strMeal.toLowerCase().includes(q));
}

function findVariantById(id) {
  return variantMeals.find((m) => m.idMeal === id);
}

/* ================= Recipe loading ================= */

async function loadRecipes() {
  const query = els.searchInput.value.trim();
  const category = els.categoryFilter.value;
  const area = els.areaFilter.value;
  const ingredient = els.ingredientFilter.value;

  setLoading(true);

  try {
    let meals = [];

    if (query) {
      const res = await fetch(`${API_BASE}/search.php?s=${encodeURIComponent(query)}`);
      const data = await res.json();
      const apiMeals = data.meals || [];
      const localMatches = searchVariantMeals(query);
      meals = dedupeMeals([...apiMeals, ...localMatches]);
      meals = applyLocalFilters(meals, category, area, ingredient);
    } else if (category || area || ingredient) {
      const filterSets = [];
      if (category) filterSets.push(await fetchFilterList("c", category));
      if (area) filterSets.push(await fetchFilterList("a", area));
      if (ingredient) filterSets.push(await fetchFilterList("i", ingredient));
      let apiMeals = intersectById(filterSets);
      const localMeals = applyLocalFilters(variantMeals, category, area, ingredient);
      meals = dedupeMeals([...apiMeals, ...localMeals]);
    } else {
      const allReal = await getAllMealsCached();
      meals = dedupeMeals([...allReal, ...variantMeals]);
    }

    renderResults(meals);
  } catch (e) {
    console.error("load failed", e);
    renderResults([]);
  } finally {
    setLoading(false);
  }
}

function dedupeMeals(meals) {
  const seen = new Set();
  return meals.filter((m) => {
    if (seen.has(m.idMeal)) return false;
    seen.add(m.idMeal);
    return true;
  });
}

async function fetchFilterList(param, value) {
  const res = await fetch(`${API_BASE}/filter.php?${param}=${encodeURIComponent(value)}`);
  const data = await res.json();
  return data.meals || [];
}

const ALL_MEALS_CACHE_KEY = "recipeFinder.allMeals.v1";
const ALL_MEALS_TTL_MS = 24 * 60 * 60 * 1000;
let allMealsMemoryCache = null;

async function getAllMealsCached() {
  if (allMealsMemoryCache) return allMealsMemoryCache;

  try {
    const raw = localStorage.getItem(ALL_MEALS_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.ts && Date.now() - cached.ts < ALL_MEALS_TTL_MS && Array.isArray(cached.meals) && cached.meals.length > 0) {
        allMealsMemoryCache = cached.meals;
        return allMealsMemoryCache;
      }
    }
  } catch (e) { /* ignore corrupt cache */ }

  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const results = await Promise.all(
    letters.map((l) =>
      fetch(`${API_BASE}/search.php?f=${l}`)
        .then((r) => r.json())
        .then((d) => d.meals || [])
        .catch(() => [])
    )
  );

  const seen = new Set();
  const meals = [];
  results.flat().forEach((m) => {
    if (!seen.has(m.idMeal)) {
      seen.add(m.idMeal);
      meals.push(m);
    }
  });

  allMealsMemoryCache = meals;
  try {
    localStorage.setItem(ALL_MEALS_CACHE_KEY, JSON.stringify({ ts: Date.now(), meals }));
  } catch (e) { /* storage full or unavailable, ignore */ }

  return meals;
}

function intersectById(lists) {
  if (lists.length === 0) return [];
  if (lists.length === 1) return lists[0];
  const idSets = lists.map((list) => new Set(list.map((m) => m.idMeal)));
  const common = lists[0].filter((m) => idSets.every((set) => set.has(m.idMeal)));
  const seen = new Set();
  return common.filter((m) => {
    if (seen.has(m.idMeal)) return false;
    seen.add(m.idMeal);
    return true;
  });
}

function applyLocalFilters(meals, category, area, ingredient) {
  return meals.filter((m) => {
    if (category && m.strCategory !== category) return false;
    if (area && m.strArea !== area) return false;
    if (ingredient) {
      const ingredients = getIngredients(m).map((i) => i.name.toLowerCase());
      if (!ingredients.includes(ingredient.toLowerCase())) return false;
    }
    return true;
  });
}

function setLoading(isLoading) {
  if (isLoading) {
    els.loader.innerHTML = Array.from({ length: 8 }).map(() => `<div class="skeleton-card"></div>`).join("");
    els.loader.classList.remove("hidden");
    els.results.innerHTML = "";
    els.emptyState.classList.add("hidden");
    els.resultCount.textContent = "";
  } else {
    els.loader.classList.add("hidden");
  }
}

/* ================= Rendering ================= */

const PAGE_SIZE = 60;
let currentMeals = [];
let currentPage = 0;

function renderResults(meals) {
  currentMeals = meals || [];
  currentPage = 0;
  els.results.innerHTML = "";

  if (!currentMeals.length) {
    els.emptyState.classList.remove("hidden");
    els.resultCount.textContent = "";
    removeLoadMoreBtn();
    return;
  }

  els.emptyState.classList.add("hidden");
  els.resultCount.textContent = `${currentMeals.length} recipe${currentMeals.length === 1 ? "" : "s"} found`;
  renderNextPage();
}

function renderNextPage() {
  const start = currentPage * PAGE_SIZE;
  const pageItems = currentMeals.slice(start, start + PAGE_SIZE);
  const frag = document.createDocumentFragment();
  pageItems.forEach((meal) => frag.appendChild(buildCard(meal)));
  els.results.appendChild(frag);
  currentPage += 1;
  updateLoadMoreBtn();
}

function updateLoadMoreBtn() {
  removeLoadMoreBtn();
  const shown = currentPage * PAGE_SIZE;
  if (shown < currentMeals.length) {
    const btn = document.createElement("button");
    btn.id = "loadMoreBtn";
    btn.className = "load-more-btn";
    btn.textContent = `Load more (${currentMeals.length - shown} remaining)`;
    btn.addEventListener("click", renderNextPage);
    els.results.insertAdjacentElement("afterend", btn);
  }
}

function removeLoadMoreBtn() {
  const existing = document.getElementById("loadMoreBtn");
  if (existing) existing.remove();
}

function unicodeSafeBtoa(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

const FALLBACK_THUMB = "data:image/svg+xml;base64," + unicodeSafeBtoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
  '<rect width="400" height="400" fill="#e0d5c4"/>' +
  '<text x="200" y="200" font-size="120" text-anchor="middle" dominant-baseline="middle">🍽️</text>' +
  '</svg>'
);

// Guarantees every meal object has a usable image + YouTube + source link,
// even if TheMealDB itself didn't provide one for that particular real recipe.
function ensureMealHasLinksAndImage(meal) {
  if (!meal.strMealThumb) {
    meal.strMealThumb = FALLBACK_THUMB;
  }
  const name = meal.strMeal || "recipe";
  if (!meal.strYoutube) {
    meal.strYoutube = `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " recipe")}`;
    meal.strYoutubeIsSearch = true;
  }
  if (!meal.strSource) {
    meal.strSource = `https://www.google.com/search?q=${encodeURIComponent(name + " recipe")}`;
    meal.strSourceIsSearch = true;
  }
}

// Best-effort mapping from TheMealDB-style area/nationality names to the
// actual Wikipedia article slug for that cuisine (falls back to a Wikipedia
// search link when there's no dedicated "X cuisine" article).
const CUISINE_WIKI_OVERRIDES = {
  "United States": "American_cuisine",
  "Antiguan, Barbudan": "Antigua_and_Barbuda", "Bosnian, Herzegovinian": "Bosnia_and_Herzegovina_cuisine",
  "France": "French_cuisine", "Netherlands": "Dutch_cuisine", "Norway": "Norwegian_cuisine",
  "Venezuela": "Venezuelan_cuisine", "Argentina": "Argentine_cuisine", "India": "Indian_cuisine",
  "Slovakia": "Slovak_cuisine", "British": "British_cuisine", "Hong Konger": "Cuisine_of_Hong_Kong",
  "Gibraltar": "Gibraltarian_cuisine", "Djibouti": "Djiboutian_cuisine",
};

function cuisineLink(area) {
  if (!area) return "";
  if (CUISINE_WIKI_OVERRIDES[area]) {
    return `https://en.wikipedia.org/wiki/${CUISINE_WIKI_OVERRIDES[area]}`;
  }
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(area.replace(/ /g, "_"))}_cuisine`;
}

function buildCard(meal) {
  ensureMealHasLinksAndImage(meal);
  const card = document.createElement("div");
  card.className = "recipe-card";
  card.dataset.id = meal.idMeal;
  const isFav = !!favorites[meal.idMeal];
  const isVariant = !!meal.isVariant;
  card.innerHTML = `
    <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_THUMB}';">
    ${isVariant ? `<span class="variant-badge">✨ ${meal.variantLabel || "Variant"}</span>` : ""}
    <button class="card-fav-btn ${isFav ? "active" : ""}" data-fav-toggle title="Save to favorites">${isFav ? "♥" : "♡"}</button>
    <div class="recipe-card-body">
      <div class="recipe-card-title">${meal.strMeal}</div>
      <div class="recipe-tags">
        ${meal.strCategory ? `<span class="tag">${meal.strCategory}</span>` : ""}
        ${meal.strArea ? `<a href="${cuisineLink(meal.strArea)}" target="_blank" rel="noopener" class="tag area" data-cuisine-link title="Learn about ${meal.strArea} cuisine">${meal.strArea}</a>` : ""}
      </div>
    </div>
  `;
  card.addEventListener("click", (e) => {
    if (e.target.closest("[data-fav-toggle]") || e.target.closest("[data-cuisine-link]")) return;
    openRecipe(meal.idMeal);
  });
  card.querySelector("[data-fav-toggle]").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(meal);
  });
  const cuisineEl = card.querySelector("[data-cuisine-link]");
  if (cuisineEl) cuisineEl.addEventListener("click", (e) => e.stopPropagation());
  return card;
}

function refreshCardFavStates() {
  document.querySelectorAll(".recipe-card").forEach((card) => {
    const id = card.dataset.id;
    const btn = card.querySelector("[data-fav-toggle]");
    if (!btn) return;
    const isFav = !!favorites[id];
    btn.classList.toggle("active", isFav);
    btn.textContent = isFav ? "♥" : "♡";
  });
}

/* ================= Favorites ================= */

function toggleFavorite(meal) {
  const id = meal.idMeal;
  if (favorites[id]) {
    delete favorites[id];
    showToast("Removed from favorites");
  } else {
    favorites[id] = {
      idMeal: meal.idMeal,
      strMeal: meal.strMeal,
      strMealThumb: meal.strMealThumb,
      strCategory: meal.strCategory,
      strArea: meal.strArea,
    };
    showToast("Added to favorites");
  }
  saveFavorites();
  refreshCardFavStates();
  updateFavCountBadge();
  updateFavSummary();
  if (document.getElementById("tab-favorites").classList.contains("active")) {
    renderFavoritesTab();
  }
  if (currentMealForModal && currentMealForModal.idMeal === id) {
    updateModalFavButton(id);
  }
}

function updateFavCountBadge() {
  const n = Object.keys(favorites).length;
  els.favCount.textContent = n;
  els.favCount.classList.toggle("hidden", n === 0);
}

function renderFavoritesTab() {
  const list = Object.values(favorites);
  els.favoritesResults.innerHTML = "";
  if (list.length === 0) {
    els.favEmptyState.classList.remove("hidden");
    return;
  }
  els.favEmptyState.classList.add("hidden");
  const frag = document.createDocumentFragment();
  list.forEach((meal) => frag.appendChild(buildCard(meal)));
  els.favoritesResults.appendChild(frag);
}

/* ================= Full-screen recipe detail ================= */

function bindModal() {
  els.detailBackBtn.addEventListener("click", closeDetail);
  els.detailFavBtn.addEventListener("click", () => {
    if (currentMealForModal) toggleFavorite(currentMealForModal);
  });
}

async function openRecipe(id) {
  const activePanel = document.querySelector(".tab-panel.active");
  previousTab = activePanel ? activePanel.id.replace("tab-", "") : "discover";

  els.detailContent.innerHTML = `<div class="skeleton-grid" style="padding:32px;"><div class="skeleton-card" style="height:440px;grid-column:1/-1;"></div></div>`;
  switchTab("detail");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  try {
    let meal = null;
    const localVariant = findVariantById(id);

    if (localVariant) {
      meal = localVariant;
    } else {
      const res = await fetch(`${API_BASE}/lookup.php?i=${id}`);
      const data = await res.json();
      meal = data.meals && data.meals[0];
    }

    if (!meal) return;

    currentMealForModal = meal;
    ensureMealHasLinksAndImage(meal);
    const ingredients = getIngredients(meal);
    const isVariant = !!meal.isVariant;
    const isSynthetic = !!meal.isSynthetic;
    const noticeText = `✨ This is a generated ${meal.variantLabel} variant based on a real recipe — not sourced from TheMealDB.`;

    els.detailContent.innerHTML = `
      <div class="detail-hero-wrap">
        <img class="detail-hero" src="${meal.strMealThumb}" alt="${meal.strMeal}" onerror="this.onerror=null;this.src='${FALLBACK_THUMB}';">
      </div>
      <div class="detail-body">
        ${isVariant && !isSynthetic ? `<div class="variant-notice">${noticeText}</div>` : ""}
        <h1>${meal.strMeal}</h1>
        <div class="detail-meta">
          ${meal.strCategory ? `<span class="tag">${meal.strCategory}</span>` : ""}
          ${meal.strArea ? `<a href="${cuisineLink(meal.strArea)}" target="_blank" rel="noopener" class="tag area">${meal.strArea}</a>` : ""}
          ${meal.strTags ? meal.strTags.split(",").map((t) => `<span class="tag">${t.trim()}</span>`).join("") : ""}
        </div>

        <div class="detail-grid">
          <div>
            <h3>Ingredients</h3>
            <ul class="ingredient-list">
              ${ingredients.map((i) => `<li><span>${i.name}</span><span class="measure">${i.measure}</span></li>`).join("")}
            </ul>
          </div>
          <div>
            <h3>Instructions</h3>
            <div class="instructions">${meal.strInstructions || "No instructions provided."}</div>
            <div class="detail-links">
              ${meal.strYoutube ? `<a href="${meal.strYoutube}" target="_blank">▶ Watch on YouTube</a>` : ""}
              ${meal.strSource ? `<a href="${meal.strSource}" target="_blank">🔗 Original Source</a>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
    updateModalFavButton(id);
  } catch (e) {
    console.error("recipe fetch failed", e);
    els.detailContent.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div>Failed to load recipe.</div>`;
  }
}

function updateModalFavButton(id) {
  const isFav = !!favorites[id];
  els.detailFavBtn.classList.toggle("active", isFav);
  els.detailFavBtn.textContent = isFav ? "♥ Saved" : "♡ Save";
}

function closeDetail() {
  currentMealForModal = null;
  switchTab(previousTab);
}

/* ================= Helpers ================= */

function getIngredients(meal) {
  const list = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      list.push({ name: name.trim(), measure: (measure || "").trim() });
    }
  }
  return list;
}

/* ================= AI Chef ================= */

function updateAiChefKeyNotice() {
  if (!els.aiChefNoKey) return;
  const hasKey = !!getClaudeApiKey();
  els.aiChefNoKey.classList.toggle("hidden", hasKey);
  els.aiChefBtn.disabled = !hasKey;
}

function bindAiChef() {
  if (!els.aiChefBtn) return;
  updateAiChefKeyNotice();

  els.aiChefGoSettings.addEventListener("click", () => {
    switchTab("settings");
    els.claudeApiKeyInput.focus();
  });

  els.aiChefBtn.addEventListener("click", runAiChef);
  els.aiChefInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runAiChef();
    }
  });
}

async function runAiChef() {
  const prompt = els.aiChefInput.value.trim();
  if (!prompt) {
    showToast("Describe what you have and what you want to make");
    return;
  }
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    updateAiChefKeyNotice();
    showToast("Add your Claude API key in Settings first");
    return;
  }

  setAiChefLoading(true);
  els.aiChefResults.innerHTML = "";

  try {
    const understanding = await aiUnderstandRequest(prompt, apiKey);
    els.aiChefStatus.textContent = "Searching real recipes...";

    const realMatch = await findBestRealMatch(understanding);

    // Only show a real match when it's a near-exact fit (uses almost all of
    // what the user listed) — otherwise always generate a fresh AI recipe.
    const allowedCount = (understanding.mainIngredients || []).length + (understanding.seasonings || []).length;
    const isNearExact = realMatch && allowedCount > 0 && getIngredients(realMatch).length >= Math.max(1, allowedCount - 1);

    if (isNearExact) {
      els.aiChefStatus.textContent = "Found a real match!";
      renderAiChefRealMatch(realMatch, understanding, prompt);
    } else {
      els.aiChefStatus.textContent = "Generating a custom recipe...";
      const generated = await aiGenerateRecipe(prompt, understanding, apiKey);
      enforceAllowedIngredients(generated, understanding);
      await attachRecipeImageAndLinks(generated);
      renderAiChefGenerated(generated);
      addToCommunityRecipes(generated, prompt);
    }
    els.aiChefStatus.textContent = "";
  } catch (e) {
    console.error("AI Chef failed", e);
    renderAiChefError(e);
    els.aiChefStatus.textContent = "";
  } finally {
    setAiChefLoading(false);
  }
}

function setAiChefLoading(isLoading) {
  els.aiChefBtn.disabled = isLoading || !getClaudeApiKey();
  if (isLoading) {
    els.aiChefLoader.innerHTML = `<div class="skeleton-card" style="height:220px;grid-column:1/-1;"></div>`;
    els.aiChefLoader.classList.remove("hidden");
  } else {
    els.aiChefLoader.classList.add("hidden");
  }
}

async function callClaude(apiKey, systemPrompt, userPrompt, maxTokens) {
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens || 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errData = await res.json();
      detail = errData.error && errData.error.message ? errData.error.message : JSON.stringify(errData);
    } catch (e) { detail = res.statusText; }
    const err = new Error(detail || `Claude API error (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Could not parse AI response as JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

// Step 1: ask Claude to turn the free-text request into structured search terms.
async function aiUnderstandRequest(prompt, apiKey) {
  const system = `You turn a free-text home-cook request into structured search intent for a recipe app.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "mainIngredients": ["string", ...],
  "seasonings": ["string", ...],
  "mealType": "breakfast|lunch|dinner|dessert|snack|side|other",
  "cuisine": "string or empty",
  "otherNotes": "string or empty",
  "searchKeywords": ["string", ...]
}
"mainIngredients" are the core foods to cook (e.g. potato, chicken, eggs). "seasonings" are spices/condiments/aromatics used to flavor it, kept separate from mainIngredients. "searchKeywords" should be 2-5 short terms (single words or short phrases, in English) most likely to find a matching real recipe name or ingredient in a recipe database, ranked by how central they are to the dish (usually the main ingredient and meal type first).`;

  const text = await callClaude(apiKey, system, prompt, 600);
  return extractJson(text);
}

// Normalizes an ingredient name for loose matching (case, plural, punctuation).
function normalizeIngredientName(str) {
  let s = (str || "").toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " "); // drop parenthetical notes
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // crude singularization
  if (s.length > 3 && s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.length > 3 && s.endsWith("es") && !s.endsWith("ses")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return s;
}

// True if `ingredientName` is (loosely) covered by the user's allowed ingredient list.
function isIngredientAllowed(ingredientName, normalizedAllowed) {
  const norm = normalizeIngredientName(ingredientName);
  if (!norm) return true; // empty/garbage ingredient slot, ignore
  return normalizedAllowed.some((allowed) => {
    if (!allowed) return false;
    return norm === allowed || norm.includes(allowed) || allowed.includes(norm);
  });
}

// A real recipe only counts as a match if EVERY one of its ingredients is
// something the user actually said they have — using fewer is fine, but the
// recipe can never require an ingredient outside the user's list.
function mealUsesOnlyAllowedIngredients(meal, normalizedAllowed) {
  const ingredients = getIngredients(meal);
  if (!ingredients.length) return false;
  return ingredients.every((i) => isIngredientAllowed(i.name, normalizedAllowed));
}

// Step 2: try to find a real TheMealDB (or local variant) recipe that fits,
// using ONLY the ingredients (main ingredients + seasonings) the user listed.
async function findBestRealMatch(understanding) {
  const allowedRaw = (understanding.mainIngredients || []).concat(understanding.seasonings || []);
  const normalizedAllowed = allowedRaw.map(normalizeIngredientName).filter(Boolean);
  if (!normalizedAllowed.length) return null;

  const keywords = (understanding.searchKeywords || []).concat(allowedRaw).filter(Boolean);

  const candidateSets = [];
  for (const kw of keywords.slice(0, 5)) {
    try {
      const res = await fetch(`${API_BASE}/filter.php?i=${encodeURIComponent(kw)}`);
      const data = await res.json();
      if (data.meals) candidateSets.push(data.meals);
    } catch (e) { /* ignore individual failures */ }
    try {
      const res2 = await fetch(`${API_BASE}/search.php?s=${encodeURIComponent(kw)}`);
      const data2 = await res2.json();
      if (data2.meals) candidateSets.push(data2.meals);
    } catch (e) { /* ignore */ }
  }

  const localHits = variantMeals.filter((m) => {
    const name = m.strMeal.toLowerCase();
    return keywords.some((kw) => name.includes(kw.toLowerCase()));
  });
  if (localHits.length) candidateSets.push(localHits);

  const seen = new Set();
  const candidates = [];
  candidateSets.flat().forEach((m) => {
    if (!seen.has(m.idMeal)) {
      seen.add(m.idMeal);
      candidates.push(m);
    }
  });

  if (!candidates.length) return null;

  // Bare filter/search results don't include the ingredient list, so we need
  // full detail on each candidate before we can check the "only allowed
  // ingredients" rule. Cap how many we hydrate to keep this fast.
  const hydrated = [];
  for (const m of candidates.slice(0, 25)) {
    let meal = m;
    if (!meal.strIngredient1) {
      const localFull = findVariantById(meal.idMeal);
      if (localFull) {
        meal = localFull;
      } else {
        try {
          const res = await fetch(`${API_BASE}/lookup.php?i=${meal.idMeal}`);
          const data = await res.json();
          if (data.meals && data.meals[0]) meal = data.meals[0];
        } catch (e) { continue; }
      }
    }
    hydrated.push(meal);
  }

  const eligible = hydrated.filter((m) => mealUsesOnlyAllowedIngredients(m, normalizedAllowed));
  if (!eligible.length) return null;

  const mealTypeToCategory = {
    breakfast: ["Breakfast"],
    dessert: ["Dessert"],
    side: ["Side", "Starter"],
    other: [],
  };

  const scored = eligible.map((m) => {
    let score = 0;
    const name = (m.strMeal || "").toLowerCase();
    keywords.forEach((kw) => { if (name.includes(kw.toLowerCase())) score += 3; });
    const wantedCats = mealTypeToCategory[understanding.mealType] || [];
    if (wantedCats.includes(m.strCategory)) score += 4;
    if (understanding.cuisine && m.strArea && m.strArea.toLowerCase() === understanding.cuisine.toLowerCase()) score += 3;
    // Prefer recipes that use MORE of what the user has (closer to exact match).
    score += getIngredients(m).length;
    return { meal: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].meal;
}

// Step 3: no real match found — ask Claude to generate a full custom recipe.
async function aiGenerateRecipe(originalPrompt, understanding, apiKey) {
  const system = `You are a professional home-cooking chef assistant. A user describes ingredients, seasonings, and what they want to cook. Create one complete, realistic, delicious recipe using ONLY the ingredients and seasonings the user actually listed.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "title": "string",
  "tagline": "one short enticing sentence",
  "mealType": "string",
  "cuisine": "string or empty",
  "servings": "string",
  "prepTime": "string",
  "cookTime": "string",
  "ingredients": [{"name": "string", "measure": "string"}, ...],
  "instructions": ["step 1 string", "step 2 string", ...],
  "chefTips": ["string", ...]
}
STRICT RULE: the "ingredients" list must contain ONLY items from the user's stated mainIngredients + seasonings (a subset is fine, using fewer of them is fine) — do NOT add any ingredient, spice, oil, water, garnish, or pantry staple the user did not mention, even a "small"/"optional" one. If the dish genuinely cannot be cooked at all without something basic like water or heat, you may use it only as a cooking medium mentioned in the instructions text (not water/heat as a listed ingredient) — but never introduce new flavoring ingredients. If chefTips exist, they must only suggest technique, not additional ingredients.
TITLE RULE: "title" must be SHORT and SIMPLE — 2 to 4 words max, like a normal recipe name a person would say out loud (e.g. "Salty Penne Pasta", "Garlic Butter Chicken", "Spicy Bean Tacos"). Never write long descriptive titles that list every ingredient or preparation detail (e.g. do NOT write "Olive Oil Penne Pasta With A Pinch Of Salt"). Use at most one descriptive adjective, then the main ingredient, then the dish type.`;

  const userMsg = `User's request: "${originalPrompt}"\n\nStructured understanding: ${JSON.stringify(understanding)}`;
  const text = await callClaude(apiKey, system, userMsg, 1600);
  return extractJson(text);
}

function renderAiChefRealMatch(meal, understanding, prompt) {
  ensureMealHasLinksAndImage(meal);
  const ingredients = getIngredients(meal);
  els.aiChefResults.innerHTML = `
    <div class="ai-chef-card">
      <span class="ai-chef-badge real-match">✅ Real recipe match from TheMealDB</span>
      <h2>${meal.strMeal}</h2>
      <div class="ai-chef-tagline">Matched to: "${escapeHtml(prompt)}"</div>
      <div class="ai-chef-grid">
        <div>
          <h3>Ingredients</h3>
          <ul>${ingredients.map((i) => `<li>${escapeHtml(i.name)}${i.measure ? ` — ${escapeHtml(i.measure)}` : ""}</li>`).join("")}</ul>
        </div>
        <div>
          <h3>Instructions</h3>
          <p style="white-space:pre-line;line-height:1.6;">${escapeHtml(meal.strInstructions || "")}</p>
        </div>
      </div>
      <div class="ai-chef-actions">
        <button data-view-full>View full recipe page</button>
        <button data-save-fav>♡ Save to favorites</button>
        <button data-try-again>Ask again</button>
      </div>
    </div>
  `;
  els.aiChefResults.querySelector("[data-view-full]").addEventListener("click", () => openRecipe(meal.idMeal));
  els.aiChefResults.querySelector("[data-save-fav]").addEventListener("click", () => toggleFavorite(meal));
  els.aiChefResults.querySelector("[data-try-again]").addEventListener("click", () => els.aiChefInput.focus());
}

function enforceAllowedIngredients(recipe, understanding) {
  const allowedRaw = (understanding.mainIngredients || []).concat(understanding.seasonings || []);
  const normalizedAllowed = allowedRaw.map(normalizeIngredientName).filter(Boolean);
  if (!normalizedAllowed.length || !Array.isArray(recipe.ingredients)) return recipe;

  const kept = recipe.ingredients.filter((i) => isIngredientAllowed(i.name, normalizedAllowed));
  const removed = recipe.ingredients.filter((i) => !isIngredientAllowed(i.name, normalizedAllowed));
  recipe.ingredients = kept;
  if (removed.length) {
    recipe.removedExtraIngredients = removed.map((i) => i.name);
  }
  return recipe;
}

function renderAiChefGenerated(recipe) {
  const ingredients = recipe.ingredients || [];
  const instructions = recipe.instructions || [];
  const tips = recipe.chefTips || [];
  els.aiChefResults.innerHTML = `
    <div class="ai-chef-card">
      <span class="ai-chef-badge">✨ AI Generated</span>
      <h2>${escapeHtml(recipe.title || "Custom Recipe")}</h2>
      <div class="ai-chef-tagline">${escapeHtml(recipe.tagline || "")}</div>
      ${recipe.removedExtraIngredients && recipe.removedExtraIngredients.length ? `<div class="ai-chef-notice" style="margin-bottom:12px;">Removed ingredients you didn't list: ${escapeHtml(recipe.removedExtraIngredients.join(", "))}</div>` : ""}
      <div class="ai-chef-tagline">
        ${recipe.mealType ? `<span class="tag" style="margin-right:6px;">${escapeHtml(recipe.mealType)}</span>` : ""}
        ${recipe.cuisine ? `<span class="tag" style="margin-right:6px;">${escapeHtml(recipe.cuisine)}</span>` : ""}
        ${recipe.servings ? `Serves ${escapeHtml(recipe.servings)} · ` : ""}
        ${recipe.prepTime ? `Prep ${escapeHtml(recipe.prepTime)} · ` : ""}
        ${recipe.cookTime ? `Cook ${escapeHtml(recipe.cookTime)}` : ""}
      </div>
      <div class="ai-chef-grid">
        <div>
          <h3>Ingredients</h3>
          <ul>${ingredients.map((i) => `<li>${escapeHtml(i.name)}${i.measure ? ` — ${escapeHtml(i.measure)}` : ""}</li>`).join("")}</ul>
        </div>
        <div>
          <h3>Instructions</h3>
          <ol>${instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
          ${tips.length ? `<h3>Chef tips</h3><ul>${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
        </div>
      </div>
      <div class="ai-chef-actions">
        <a href="${recipe.youtubeLink || '#'}" target="_blank" rel="noopener" class="link-pill">▶ YouTube search</a>
        <a href="${recipe.googleLink || '#'}" target="_blank" rel="noopener" class="link-pill">🔎 Google search</a>
        <button data-save-generated>♡ Save to favorites</button>
        <button data-try-again>Ask again</button>
      </div>
    </div>
  `;
  els.aiChefResults.querySelector("[data-try-again]").addEventListener("click", () => els.aiChefInput.focus());
  els.aiChefResults.querySelector("[data-save-generated]").addEventListener("click", () => {
    const id = `ai-${Date.now()}`;
    favorites[id] = {
      idMeal: id,
      strMeal: recipe.title || "Custom Recipe",
      strMealThumb: FALLBACK_THUMB,
      strCategory: recipe.mealType || "AI Recipe",
      strArea: recipe.cuisine || "",
      isAiGenerated: true,
      aiRecipe: recipe,
    };
    saveFavorites();
    updateFavCountBadge();
    updateFavSummary();
    showToast("Saved to favorites");
  });
}

function renderAiChefError(e) {
  let msg = e.message || "Something went wrong.";
  if (e.status === 401) msg = "Claude rejected the API key. Check it in Settings and try again.";
  if (e.status === 429) msg = "Rate limited by Claude's API. Wait a moment and try again.";
  els.aiChefResults.innerHTML = `<div class="ai-chef-error">⚠️ ${escapeHtml(msg)}</div>`;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ================= AI Chef: images, links, community feed ================= */

const FOODISH_API = "https://foodish-api.com/api";
const COMMUNITY_RECIPES_KEY = "recipeFinder.communityRecipes.v1";
const COMMUNITY_RECIPES_MAX = 300;

// Attaches YouTube/Google search links to a generated recipe (no image —
// AI Chef recipes are text/links only, per product decision).
async function attachRecipeImageAndLinks(recipe) {
  const name = recipe.title || "recipe";
  recipe.youtubeLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " recipe")}`;
  recipe.googleLink = `https://www.google.com/search?q=${encodeURIComponent(name + " recipe")}`;
  return recipe;
}

/* ---- Public/community recipe feed (shared in this browser's storage;
   rendered as a public-style feed anyone using this device can browse). ---- */

function loadCommunityRecipes() {
  try {
    const raw = localStorage.getItem(COMMUNITY_RECIPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveCommunityRecipes(list) {
  try { localStorage.setItem(COMMUNITY_RECIPES_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function addToCommunityRecipes(recipe, prompt) {
  const list = loadCommunityRecipes();
  list.unshift({
    id: `community-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: Date.now(),
    prompt,
    recipe,
  });
  saveCommunityRecipes(list.slice(0, COMMUNITY_RECIPES_MAX));
}

function renderCommunityTab() {
  const container = document.getElementById("communityResults");
  const empty = document.getElementById("communityEmptyState");
  if (!container) return;
  const list = loadCommunityRecipes();

  if (!list.length) {
    container.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  container.innerHTML = list.map((entry) => {
    const r = entry.recipe;
    const ingredients = r.ingredients || [];
    const instructions = r.instructions || [];
    return `
      <div class="ai-chef-card">
        <span class="ai-chef-badge">✨ AI Generated</span>
        <h2>${escapeHtml(r.title || "Custom Recipe")}</h2>
        <div class="ai-chef-tagline">${escapeHtml(r.tagline || "")}</div>
        <div class="ai-chef-tagline">Requested: "${escapeHtml(entry.prompt || "")}"</div>
        <div class="ai-chef-grid">
          <div>
            <h3>Ingredients</h3>
            <ul>${ingredients.map((i) => `<li>${escapeHtml(i.name)}${i.measure ? ` — ${escapeHtml(i.measure)}` : ""}</li>`).join("")}</ul>
          </div>
          <div>
            <h3>Instructions</h3>
            <ol>${instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
          </div>
        </div>
        <div class="ai-chef-actions">
          <a href="${r.youtubeLink || '#'}" target="_blank" rel="noopener" class="link-pill">▶ YouTube search</a>
          <a href="${r.googleLink || '#'}" target="_blank" rel="noopener" class="link-pill">🔎 Google search</a>
        </div>
      </div>
    `;
  }).join("");
}
