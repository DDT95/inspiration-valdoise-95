const $ = (id) => document.getElementById(id);
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

const map = L.map("map", { zoomControl: false, preferCanvas: true }).setView([49.08, 2.1], 10);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap · © CARTO" }).addTo(map);

const state = { categories: new Set(Object.keys(CATEGORIES)), markers: new Map() };
const workLayer = L.layerGroup().addTo(map);

function markerIcon(category) {
  return L.divIcon({ className: "", html: `<div class="work-marker ${category}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
}

function visibleWorks() {
  return WORKS.filter((w) => state.categories.has(w.category));
}

function renderWorks(fit = false) {
  workLayer.clearLayers();
  state.markers.clear();
  const visible = visibleWorks();
  visible.forEach((w) => {
    const marker = L.marker([w.lat, w.lng], { icon: markerIcon(w.category) })
      .bindTooltip(`<strong>${esc(w.title)}</strong><br>${esc(w.place)}`, { direction: "top" })
      .on("click", () => showWork(w))
      .addTo(workLayer);
    state.markers.set(w.id, marker);
  });
  $("visibleCount").textContent = visible.length;
  $("mapStatus").textContent = visible.length < WORKS.length
    ? `${visible.length} œuvre(s) affichée(s) sur ${WORKS.length} · filtres actifs`
    : "Cliquez un point pour découvrir son histoire";
  if (fit && visible.length) {
    map.fitBounds(L.latLngBounds(visible.map((w) => [w.lat, w.lng])), { padding: [55, 55], maxZoom: 12 });
  }
}

function showWork(w) {
  const cat = CATEGORIES[w.category];
  $("detailContent").innerHTML = `
    <span class="detail-tag" style="color:${cat.color}">${esc(cat.label.toUpperCase())}</span>
    <h2>${esc(w.title)}</h2>
    <div class="detail-location">${esc(w.place)}${w.year ? " · " + esc(w.year) : ""}</div>
    ${w.author ? `<span class="stage-badge" style="background:${cat.color}1a;color:${cat.color}">${esc(w.author)}</span>` : ""}
    <p>${esc(w.summary)}</p>
    <div class="detail-meta">
      <div><small>LIEU</small><strong>${esc(w.location)}</strong></div>
      ${w.author ? `<div><small>AUTEUR / ARTISTE</small><strong>${esc(w.author)}</strong></div>` : ""}
    </div>
    <a class="profile-link" href="${esc(w.source)}" target="_blank" rel="noreferrer">En savoir plus ↗</a>
  `;
  $("detailPanel").classList.add("open");
  map.panTo([w.lat, w.lng]);
}

function buildFilters() {
  const list = $("layerList");
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = WORKS.filter((w) => w.category === key).length;
    const row = document.createElement("label");
    row.className = "layer-row";
    row.innerHTML = `<i class="layer-swatch" style="background:${cat.color}"></i><span class="layer-label"><strong>${esc(cat.label)}</strong><small>${count} œuvre(s) repérée(s)</small></span><input type="checkbox" checked>`;
    row.querySelector("input").onchange = (e) => {
      e.target.checked ? state.categories.add(key) : state.categories.delete(key);
      renderWorks();
    };
    list.appendChild(row);
  });
}

function search() {
  const q = $("searchInput").value.trim().toLowerCase();
  const results = $("searchResults");
  if (!q) { results.hidden = true; return; }
  const matches = WORKS.filter((w) => `${w.title} ${w.author || ""} ${w.place} ${CATEGORIES[w.category].label}`.toLowerCase().includes(q));
  results.innerHTML = matches.length
    ? matches.map((w) => `<button data-id="${w.id}"><b>${esc(w.title)}</b><small>${esc(w.place)} · ${esc(CATEGORIES[w.category].label)}</small></button>`).join("")
    : `<button><b>Aucune œuvre trouvée</b><small>Essayez un lieu, un artiste ou une catégorie.</small></button>`;
  results.hidden = false;
  results.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => {
    const w = WORKS.find((x) => x.id === b.dataset.id);
    state.categories.add(w.category);
    document.querySelectorAll("#layerList input").forEach((x, i) => { if (Object.keys(CATEGORIES)[i] === w.category) x.checked = true; });
    renderWorks();
    map.setView([w.lat, w.lng], 13);
    showWork(w);
    results.hidden = true;
  }));
}

function resetApplicationState() {
  state.categories = new Set(Object.keys(CATEGORIES));
  $("searchInput").value = "";
  $("searchResults").hidden = true;
  $("detailPanel").classList.remove("open");
  document.querySelectorAll("#layerList input").forEach((x) => (x.checked = true));
  renderWorks();
  map.setView([49.08, 2.1], 10, { animate: false });
}

function openDashboard() {
  const counts = Object.keys(CATEGORIES).map((k) => [k, WORKS.filter((w) => w.category === k).length]);
  const communes = [...new Set(WORKS.map((w) => w.place))];
  $("dashboardContent").innerHTML = `
    <div class="dialog-header">
      <span class="eyebrow">SYNTHÈSE DÉPARTEMENTALE</span>
      <h2>Le Val-d’Oise, terre d’inspiration</h2>
      <p>Sélection éditoriale d’œuvres et d’artistes liés au territoire : ce n’est pas un inventaire exhaustif du patrimoine culturel, mais un point de départ pour explorer la vallée de l’Oise et ses environs.</p>
    </div>
    <div class="dashboard-kpis">
      <article><small>ŒUVRES RECENSÉES</small><strong>${WORKS.length}</strong><span>peinture, cinéma, musique</span></article>
      <article><small>LIEUX DIFFÉRENTS</small><strong>${communes.length}</strong><span>communes concernées</span></article>
      <article><small>TABLEAUX</small><strong>${counts.find((c) => c[0] === "peinture")[1]}</strong><span>peints à Auvers-sur-Oise et Pontoise</span></article>
      <article><small>TOURNAGES</small><strong>${counts.find((c) => c[0] === "cinema")[1]}</strong><span>films et séries</span></article>
    </div>
    <div class="dashboard-grid">
      <article class="chart-card span-2">
        <h3>Répartition par catégorie</h3>
        <p>Nombre d’œuvres recensées par type</p>
        <div class="theme-list">${counts.map(([k, n]) => `<button data-cat="${k}"><i class="dot" style="background:${CATEGORIES[k].color}"></i><b>${esc(CATEGORIES[k].label)}</b><small>${n} œuvre(s)</small></button>`).join("")}</div>
      </article>
      <article class="dashboard-note">
        <span>COMMENT LIRE</span>
        <h3>Une sélection, pas un inventaire</h3>
        <p>Ces œuvres et artistes ont été choisis pour leur notoriété et leur lien direct et documenté avec une commune du Val-d’Oise. Beaucoup d’autres tournages, tableaux et musiciens existent : cette page est un point de départ, pas une liste close.</p>
      </article>
    </div>
  `;
  $("dashboardContent").querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => {
    $("dashboardDialog").close();
    state.categories = new Set([b.dataset.cat]);
    document.querySelectorAll("#layerList input").forEach((x, i) => (x.checked = Object.keys(CATEGORIES)[i] === b.dataset.cat));
    renderWorks(true);
  }));
  $("dashboardDialog").showModal();
}

buildFilters();
renderWorks();
$("searchButton").onclick = search;
$("searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
$("resetView").onclick = resetApplicationState;
$("clearLayers").onclick = () => {
  state.categories = new Set();
  document.querySelectorAll("#layerList input").forEach((x) => (x.checked = false));
  renderWorks();
};
$("closeDetail").onclick = () => $("detailPanel").classList.remove("open");
$("mobileLayers").onclick = () => $("layerSidebar").classList.toggle("open");
$("openData").onclick = openDashboard;
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
