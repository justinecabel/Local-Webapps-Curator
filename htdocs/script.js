const baseHost = window.location.hostname || "localhost";
const sortBtn = document.getElementById("sort");
const refreshBtn = document.getElementById("refresh");
const searchInput = document.getElementById("search");
const themeBtn = document.getElementById("theme");
const tabsContainer = document.getElementById("tabs-container");
const contentContainer = document.getElementById("content-container");

let allData = {};
let categories = [];
let sortModePerTab = {};
let activeTab = "";
const statusMap = new Map();
const PROBE_TIMEOUT_MS = 2500;
const THEME_KEY = "theme-mode";
let themeMode = "dark";

const applyTheme = (mode) => {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  const isLight = mode === "light";
  themeBtn.textContent = isLight ? "☀" : "☾";
  const label = isLight ? "Light theme enabled" : "Dark theme enabled";
  themeBtn.setAttribute("aria-label", `${label}. Click to switch.`);
  themeBtn.setAttribute("title", `${label}. Click to switch.`);
};

const loadTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    themeMode = saved;
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    themeMode = "light";
  }
  applyTheme(themeMode);
};

const toggleTheme = () => {
  themeMode = themeMode === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, themeMode);
  applyTheme(themeMode);
};

const switchTab = (tab) => {
  activeTab = tab;
  document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
  
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document.getElementById(`${tab}-content`).classList.add("active");
  
  // Show all headings if on "all" tab, hide them otherwise
  if (tab === "all") {
    categories.forEach((category) => {
      const heading = document.getElementById(`${category}-all-heading`);
      if (heading) heading.style.display = "block";
    });
  } else {
    categories.forEach((category) => {
      const heading = document.getElementById(`${category}-all-heading`);
      if (heading) heading.style.display = "none";
    });
  }
  
  // Update sort button to reflect current tab's sort mode
  let currentSort;
  if (tab === "all") {
    currentSort = sortModePerTab["all"] || "list";
  } else {
    currentSort = sortModePerTab[tab] || "list";
  }
  
  if (currentSort === "list") {
    sortBtn.textContent = "Sort: List";
  } else if (currentSort === "az") {
    sortBtn.textContent = "Sort: A-Z";
  } else {
    sortBtn.textContent = "Sort: Z-A";
  }
};

const createDynamicTabs = (data) => {
  categories = Object.keys(data).filter(key => Array.isArray(data[key]) && data[key].length > 0).sort().reverse();
  
  if (categories.length === 0) return;
  
  // Create tab buttons - include "all" at the beginning
  tabsContainer.innerHTML = "";
  
  // Add "all" tab button
  const allBtn = document.createElement("button");
  allBtn.className = "tab-button active";
  allBtn.dataset.tab = "all";
  allBtn.textContent = "all";
  allBtn.addEventListener("click", () => switchTab("all"));
  tabsContainer.appendChild(allBtn);
  
  // Add other category tab buttons
  categories.forEach((category, idx) => {
    const btn = document.createElement("button");
    btn.className = "tab-button";
    btn.dataset.tab = category;
    btn.textContent = category;
    btn.addEventListener("click", () => switchTab(category));
    tabsContainer.appendChild(btn);
  });

  // Create tab content sections
  contentContainer.innerHTML = "";
  
  // Create "all" tab content
  const allContent = document.createElement("div");
  allContent.className = "tab-content active";
  allContent.id = "all-content";
  
  let allHTML = "";
  categories.forEach((category) => {
    allHTML += `<h2 id="${category}-all-heading" style="font-size: 18px; margin: 0 0 16px; color: var(--muted);">${category}</h2>`;
    allHTML += `<section class="grid" id="${category}-all-grid"></section>`;
  });
  allContent.innerHTML = allHTML;
  contentContainer.appendChild(allContent);
  
  // Create category tab contents
  categories.forEach((category, idx) => {
    const content = document.createElement("div");
    content.className = "tab-content";
    content.id = `${category}-content`;
    
    content.innerHTML = `
      <h2 id="${category}-heading" style="font-size: 18px; margin: 0 0 16px; color: var(--muted); display: none;">${category}</h2>
      <section class="grid" id="${category}-grid"></section>
      <div class="empty" id="${category}-empty" hidden>No ${category} found.</div>
    `;
    contentContainer.appendChild(content);
  });

  activeTab = "all";
};

const buildUrl = (app) => {
  const protocol = app.protocol || "http";
  return `${protocol}://${baseHost}:${app.path}`;
};

const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value === "up") return "up";
  if (value === "down") return "down";
  return "checking";
};

const getStatusLabel = (status) => {
  if (status === "up") return "UP";
  if (status === "down") return "DOWN";
  return "CHECKING";
};

const getAppKey = (app, category) => {
  if (app.port) {
    return `${category}::${app.name}::${app.port}`;
  }
  return `${category}::${app.name}::${app.protocol || "http"}::${app.path}`;
};

const setAppStatus = (app, status, category) => {
  const key = getAppKey(app, category);
  statusMap.set(key, normalizeStatus(status));
};

const getAppStatus = (app, category) => {
  const key = getAppKey(app, category);
  const stored = statusMap.get(key);
  if (stored) return stored;
  return normalizeStatus(app.status);
};

const updateStatusBadge = (app, category) => {
  const key = getAppKey(app, category);
  const status = getAppStatus(app, category);
  
  // Update in regular tab grid
  const gridId = `${category}-grid`;
  const grid = document.getElementById(gridId);
  if (grid) {
    const badge = grid.querySelector(`[data-app-key="${CSS.escape(key)}"]`);
    if (badge) {
      badge.classList.remove("status-up", "status-down", "status-checking");
      badge.classList.add(`status-${status}`);
      badge.textContent = getStatusLabel(status);
    }
  }
  
  // Update in "all" tab grid
  const allGridId = `${category}-all-grid`;
  const allGrid = document.getElementById(allGridId);
  if (allGrid) {
    const allBadge = allGrid.querySelector(`[data-app-key="${CSS.escape(key)}"]`);
    if (allBadge) {
      allBadge.classList.remove("status-up", "status-down", "status-checking");
      allBadge.classList.add(`status-${status}`);
      allBadge.textContent = getStatusLabel(status);
    }
  }
};

const probeAppStatus = async (app, category) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  
  let url;
  if (app.port) {
    url = `http://${baseHost}:${app.port}`;
  } else {
    url = buildUrl(app);
  }

  try {
    await fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal
    });
    setAppStatus(app, "up", category);
  } catch (_) {
    setAppStatus(app, "down", category);
  } finally {
    clearTimeout(timeoutId);
    updateStatusBadge(app, category);
  }
};

const refreshStatuses = async (categoriesToRefresh = null) => {
  // Check for JSON updates
  try {
    const response = await fetch("/list.json");
    const data = await response.json();
    
    // Update allData with new JSON data
    Object.keys(data).forEach(category => {
      if (Array.isArray(data[category]) && data[category].length > 0) {
        allData[category] = data[category].map((app, index) => ({ 
          ...app, 
          _index: index 
        }));
        
        // Set status for new items
        allData[category].forEach((app) => setAppStatus(app, app.status, category));
      }
    });
  } catch (error) {
    console.error("Error updating list.json:", error);
  }

  // Determine which categories to refresh
  const toRefresh = categoriesToRefresh || categories;

  // Set all apps to "checking" status before probing
  toRefresh.forEach(category => {
    if (allData[category]) {
      allData[category].forEach((app) => {
        setAppStatus(app, "checking", category);
        updateStatusBadge(app, category);
      });
    }
  });

  const promises = [];
  toRefresh.forEach(category => {
    if (allData[category]) {
      allData[category].forEach((app) => {
        promises.push(probeAppStatus(app, category));
      });
    }
  });
  await Promise.all(promises);
};

const renderCards = (items, category) => {
  const gridId = `${category}-grid`;
  const grid = document.getElementById(gridId);
  const emptyId = `${category}-empty`;
  const emptyState = document.getElementById(emptyId);

  grid.innerHTML = "";
  if (!items.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  items.forEach((app, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${index * 40}ms`;

    const status = getAppStatus(app, category);
    const key = getAppKey(app, category);

    let cardHTML = `
      <div class="card-head">
        <h3>${app.name}</h3>
        <span class="status status-${status}" data-app-key="${key}">${getStatusLabel(status)}</span>
      </div>
    `;

    // Only show Open buttons if webapp === true
    if (app.webapp === true && app.path) {
      const url = buildUrl(app);
      cardHTML += `
        <div class="actions">
          <a href="${url}" target="_blank" rel="noopener">Open</a>
          <a class="secondary" href="${url}" target="_self">Open Here</a>
        </div>
      `;
    }

    card.innerHTML = cardHTML;
    grid.appendChild(card);
  });
};

const renderCardsForAll = (items, category) => {
  const gridId = `${category}-all-grid`;
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = "";
  items.forEach((app, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${index * 40}ms`;

    const status = getAppStatus(app, category);
    const key = getAppKey(app, category);

    let cardHTML = `
      <div class="card-head">
        <h3>${app.name}</h3>
        <span class="status status-${status}" data-app-key="${key}">${getStatusLabel(status)}</span>
      </div>
    `;

    // Only show Open buttons if webapp === true
    if (app.webapp === true && app.path) {
      const url = buildUrl(app);
      cardHTML += `
        <div class="actions">
          <a href="${url}" target="_blank" rel="noopener">Open</a>
          <a class="secondary" href="${url}" target="_self">Open Here</a>
        </div>
      `;
    }

    card.innerHTML = cardHTML;
    grid.appendChild(card);
  });
};

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  const hasQuery = query.length > 0;

  categories.forEach(category => {
    let filtered = allData[category].filter((app) => {
      const searchText = app.name + (app.path || "") + (app.port || "") + (app.protocol || "");
      return searchText.toLowerCase().includes(query);
    });

    // Get the appropriate sort mode
    let currentSort;
    if (activeTab === "all") {
      currentSort = sortModePerTab["all"] || "list";
    } else {
      currentSort = sortModePerTab[activeTab] || "list";
    }
    
    if (currentSort === "list") {
      filtered = filtered.sort((a, b) => a._index - b._index);
    } else if (currentSort === "az") {
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));
    }

    renderCards(filtered, category);
    renderCardsForAll(filtered, category);

    // Show/hide tabs and headings based on search query
    const tabBtn = document.querySelector(`[data-tab="${category}"]`);
    const content = document.getElementById(`${category}-content`);
    const heading = document.getElementById(`${category}-heading`);
    
    if (hasQuery) {
      if (tabBtn) tabBtn.classList.add("active");
      if (content) content.classList.add("active");
      if (heading) heading.style.display = "block";
    } else {
      if (tabBtn) tabBtn.classList.remove("active");
      if (content) content.classList.remove("active");
      if (heading) heading.style.display = "none";
    }
  });

  // Only switch to active tab if not searching
  if (!hasQuery && categories.length > 0) {
    if (!activeTab || activeTab === "") {
      switchTab("all");
    }
  }
};

const toggleSort = () => {
  if (activeTab === "all") {
    // For "all" tab, update all category sort modes
    const currentSort = sortModePerTab["all"] || "list";
    let newSort;
    
    if (currentSort === "list") {
      newSort = "az";
      sortBtn.textContent = "Sort: A-Z";
    } else if (currentSort === "az") {
      newSort = "za";
      sortBtn.textContent = "Sort: Z-A";
    } else {
      newSort = "list";
      sortBtn.textContent = "Sort: List";
    }
    
    sortModePerTab["all"] = newSort;
    // Apply to all categories
    categories.forEach(category => {
      sortModePerTab[category] = newSort;
    });
  } else {
    const currentSort = sortModePerTab[activeTab] || "list";
    let newSort;
    
    if (currentSort === "list") {
      newSort = "az";
      sortBtn.textContent = "Sort: A-Z";
    } else if (currentSort === "az") {
      newSort = "za";
      sortBtn.textContent = "Sort: Z-A";
    } else {
      newSort = "list";
      sortBtn.textContent = "Sort: List";
    }
    
    sortModePerTab[activeTab] = newSort;
  }
  applyFilters();
};

sortBtn.addEventListener("click", toggleSort);
refreshBtn.addEventListener("click", () => {
  if (activeTab === "all") {
    refreshStatuses(categories);
  } else {
    refreshStatuses([activeTab]);
  }
});
sortBtn.textContent = "Sort: List";
searchInput.addEventListener("input", applyFilters);
themeBtn.addEventListener("click", toggleTheme);
loadTheme();

fetch("/list.json")
  .then((response) => response.json())
  .then((data) => {
    // Process all categories from JSON
    Object.keys(data).forEach(category => {
      if (Array.isArray(data[category]) && data[category].length > 0) {
        allData[category] = data[category].map((app, index) => ({ 
          ...app, 
          _index: index 
        }));
        
        // Set initial status for all items
        allData[category].forEach((app) => setAppStatus(app, app.status, category));
      }
    });

    createDynamicTabs(allData);
    
    // Initialize sort mode for each tab
    categories.forEach(category => {
      sortModePerTab[category] = "list";
    });
    sortModePerTab["all"] = "list";
    
    applyFilters();
    refreshStatuses();
  })
  .catch((error) => {
    contentContainer.innerHTML = `<div class="empty" style="color: var(--status-down-fg);">Error loading list: ${error.message}</div>`;
  });
