const $ = (id) => document.getElementById(id);
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

const map = L.map("map", { zoomControl: false, preferCanvas: true }).setView([49.08, 2.1], 10);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap · © CARTO" }).addTo(map);

const ALL_WORKS = [
  ...WORKS,
  ...CINEMA_COMMUNES.map((c) => ({
    id: c.id,
    category: "cinema",
    title: c.place,
    place: c.place,
    lat: c.lat,
    lng: c.lng,
    films: c.films,
  })),
];

function categoryCount(key) {
  return key === "cinema"
    ? CINEMA_COMMUNES.reduce((sum, c) => sum + c.films.length, 0)
    : WORKS.filter((w) => w.category === key).length;
}

const state = { categories: new Set(Object.keys(CATEGORIES)), markers: new Map() };
const workLayer = L.layerGroup().addTo(map);

async function loadDepartmentOutline() {
  try {
    const communes = await fetch("https://geo.api.gouv.fr/departements/95/communes?fields=nom,code,contour").then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    });
    const features = communes.filter((c) => c.contour).map((c) => ({ type: "Feature", properties: { nom: c.nom, code: c.code }, geometry: c.contour }));
    const layer = L.geoJSON(
      { type: "FeatureCollection", features },
      {
        style: { color: "#8fa6c9", weight: 0.6, opacity: 0.6, fillColor: "#e9eef3", fillOpacity: 0.12 },
        onEachFeature: (f, l) => l.bindTooltip(f.properties.nom, { sticky: true }),
      },
    );
    layer.addTo(map);
    layer.bringToBack();
    map.invalidateSize(false);
    map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 11 });
  } catch {
    $("mapStatus").textContent = "Fond communal momentanément indisponible · œuvres accessibles";
  }
}

function markerIcon(category) {
  return L.divIcon({ className: "", html: `<div class="work-marker ${category}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
}

function visibleWorks() {
  return ALL_WORKS.filter((w) => state.categories.has(w.category));
}

function renderWorks(fit = false) {
  workLayer.clearLayers();
  state.markers.clear();
  const visible = visibleWorks();
  visible.forEach((w) => {
    const tooltip = w.films
      ? `<strong>${esc(w.place)}</strong><br>${w.films.length} tournage(s)`
      : `<strong>${esc(w.title)}</strong><br>${esc(w.place)}`;
    const marker = L.marker([w.lat, w.lng], { icon: markerIcon(w.category) })
      .bindTooltip(tooltip, { direction: "top" })
      .on("click", () => showWork(w))
      .addTo(workLayer);
    state.markers.set(w.id, marker);
  });
  $("visibleCount").textContent = visible.length;
  $("mapStatus").textContent = visible.length < ALL_WORKS.length
    ? `${visible.length} point(s) affiché(s) sur ${ALL_WORKS.length} · filtres actifs`
    : "Cliquez un point pour découvrir son histoire";
  if (fit && visible.length) {
    map.fitBounds(L.latLngBounds(visible.map((w) => [w.lat, w.lng])), { padding: [55, 55], maxZoom: 12 });
  }
}

function showWork(w) {
  const cat = CATEGORIES[w.category];
  if (w.films) {
    const rows = w.films
      .slice()
      .reverse()
      .map((f) => `<li><span class="film-year">${esc(f.year || "s.d.")}</span><span class="film-text">${esc(f.text)}</span></li>`)
      .join("");
    $("detailContent").innerHTML = `
      <span class="detail-tag" style="color:${cat.color}">${esc(cat.label.toUpperCase())}</span>
      <h2>${esc(w.place)}</h2>
      <div class="detail-location">${w.films.length} tournage(s) recensé(s)</div>
      <ul class="film-list">${rows}</ul>
      <a class="profile-link" href="https://fr.wikipedia.org/wiki/Liste_de_films_tourn%C3%A9s_dans_le_d%C3%A9partement_du_Val-d%27Oise" target="_blank" rel="noreferrer">Source : Wikipédia ↗</a>
    `;
  } else {
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
  }
  $("detailPanel").classList.add("open");
  map.panTo([w.lat, w.lng]);
}

function buildFilters() {
  const list = $("layerList");
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = categoryCount(key);
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
  const matches = ALL_WORKS.filter((w) => {
    const haystack = w.films
      ? `${w.place} ${CATEGORIES[w.category].label} ${w.films.map((f) => f.text).join(" ")}`
      : `${w.title} ${w.author || ""} ${w.place} ${CATEGORIES[w.category].label}`;
    return haystack.toLowerCase().includes(q);
  }).slice(0, 40);
  results.innerHTML = matches.length
    ? matches.map((w) => `<button data-id="${w.id}"><b>${esc(w.title)}</b><small>${esc(w.place)} · ${esc(CATEGORIES[w.category].label)}</small></button>`).join("")
    : `<button><b>Aucune œuvre trouvée</b><small>Essayez un lieu, un artiste ou une catégorie.</small></button>`;
  results.hidden = false;
  results.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => {
    const w = ALL_WORKS.find((x) => x.id === b.dataset.id);
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
  const counts = Object.keys(CATEGORIES).map((k) => [k, categoryCount(k)]);
  const totalWorks = counts.reduce((s, [, n]) => s + n, 0);
  const communes = new Set([...WORKS.map((w) => w.place), ...CINEMA_COMMUNES.map((c) => c.place)]);
  const topCinema = CINEMA_COMMUNES.slice().sort((a, b) => b.films.length - a.films.length).slice(0, 6);
  $("dashboardContent").innerHTML = `
    <div class="dialog-header">
      <span class="eyebrow">SYNTHÈSE DÉPARTEMENTALE</span>
      <h2>Le Val-d’Oise, terre d’inspiration</h2>
      <p>Peinture et musique : sélection éditoriale. Cinéma : recensement exhaustif d’après la liste Wikipédia des films tournés dans le Val-d’Oise, commune par commune.</p>
    </div>
    <div class="dashboard-kpis">
      <article><small>ŒUVRES RECENSÉES</small><strong>${totalWorks}</strong><span>peinture, cinéma, musique</span></article>
      <article><small>COMMUNES CONCERNÉES</small><strong>${communes.size}</strong><span>sur 183 communes du Val-d’Oise</span></article>
      <article><small>TABLEAUX</small><strong>${counts.find((c) => c[0] === "peinture")[1]}</strong><span>peints à Auvers-sur-Oise et Vétheuil</span></article>
      <article><small>TOURNAGES</small><strong>${counts.find((c) => c[0] === "cinema")[1]}</strong><span>films et séries recensés, ${CINEMA_COMMUNES.length} communes</span></article>
    </div>
    <div class="dashboard-grid">
      <article class="chart-card span-2">
        <h3>Répartition par catégorie</h3>
        <p>Nombre d’œuvres recensées par type</p>
        <div class="theme-list">${counts.map(([k, n]) => `<button data-cat="${k}"><i class="dot" style="background:${CATEGORIES[k].color}"></i><b>${esc(CATEGORIES[k].label)}</b><small>${n} œuvre(s)</small></button>`).join("")}</div>
      </article>
      <article class="chart-card span-2">
        <h3>Communes les plus filmées</h3>
        <p>Nombre de tournages recensés par commune</p>
        ${topCinema.map((c) => `<div class="bar-row"><span>${esc(c.place)}</span><div class="bar-track"><i style="width:${Math.round((c.films.length / topCinema[0].films.length) * 100)}%;background:${CATEGORIES.cinema.color}"></i></div><b>${c.films.length}</b></div>`).join("")}
      </article>
      <article class="dashboard-note">
        <span>COMMENT LIRE</span>
        <h3>Une base exhaustive pour le cinéma</h3>
        <p>Chaque point cinéma correspond à une commune : cliquez dessus pour voir la liste complète de ses tournages recensés. Peinture et musique restent une sélection éditoriale de repères notables.</p>
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
loadDepartmentOutline();
$("headlineCount").textContent = `${Object.keys(CATEGORIES).reduce((s, k) => s + categoryCount(k), 0)} œuvres recensées`;
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
