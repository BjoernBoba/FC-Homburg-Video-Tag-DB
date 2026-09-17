// ===== CONFIG CHECK =====
if (!window.SUPABASE_URL || window.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                font-family:sans-serif;background:#0F172A;color:#fff;text-align:center;padding:2rem;">
      <div>
        <div style="font-size:3rem;margin-bottom:1rem">⚙️</div>
        <h1 style="margin-bottom:.75rem">Konfiguration erforderlich</h1>
        <p style="color:#94A3B8;max-width:420px;line-height:1.6">
          Bitte öffne <code style="background:#1E293B;padding:.2rem .5rem;border-radius:4px">js/config.js</code>
          und trage deine Supabase-URL und den Anon-Key ein.
        </p>
      </div>
    </div>`;
  throw new Error('Supabase not configured');
}

// ===== SUPABASE INIT =====
const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ===== STATE =====
const state = {
  user:            null,
  teams:           [],
  tags:            [],
  querySelectedTags: new Set(),
};
const sceneTagSets = new Map(); // gameId → Set of selected tag IDs

// ===== UTILS =====
function calculateSeason(dateStr) {
  if (!dateStr) return '—';
  const [y, m] = dateStr.split('-').map(Number);
  return m >= 7 ? `${y}/${String(y + 1).slice(-2)}` : `${y - 1}/${String(y).slice(-2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function fmt2(n) { return String(n).padStart(2, '0'); }

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str ?? ''));
  return d.innerHTML;
}

let _toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast hidden'; }, 3200);
}

function showFeedback(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `feedback ${type}`;
  setTimeout(() => { if (el) el.className = 'feedback hidden'; }, 3500);
}

// ===== NAVIGATION =====
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.remove('hidden');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');

  if (name === 'games')  renderGamesList();
  if (name === 'query')  { loadQuerySeasons(); populateFilterTeams(); renderTagSelector('query-tag-selector', state.querySelectedTags); }
  if (name === 'tags')   renderTagsList();
}

// ===== AUTH =====
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');
  btn.disabled = true; btn.textContent = 'Anmelden...';
  errEl.classList.add('hidden');

  const { error } = await db.auth.signInWithPassword({
    email:    document.getElementById('input-email').value,
    password: document.getElementById('input-password').value,
  });

  if (error) {
    errEl.textContent = 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Anmelden';
  }
});

document.getElementById('btn-logout').addEventListener('click', () => db.auth.signOut());

// ===== DATA LOADING =====
async function loadTeams() {
  const { data } = await db.from('teams').select('*').order('name');
  state.teams = data ?? [];
  const sel = document.getElementById('game-team');
  sel.innerHTML = '<option value="">Mannschaft wählen...</option>';
  state.teams.forEach(t => { sel.innerHTML += `<option value="${t.id}">${escHtml(t.name)}</option>`; });
}

function populateFilterTeams() {
  const sel = document.getElementById('filter-team');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Alle Mannschaften</option>';
  state.teams.forEach(t => { sel.innerHTML += `<option value="${t.id}" ${t.id === cur ? 'selected' : ''}>${escHtml(t.name)}</option>`; });
}

async function loadTags() {
  const { data } = await db.from('tags').select('*').order('name');
  state.tags = data ?? [];
}

async function loadQuerySeasons() {
  const { data } = await db.from('games').select('season').order('season', { ascending: false });
  if (!data) return;
  const seasons = [...new Set(data.map(g => g.season))];
  const sel = document.getElementById('filter-season');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Alle Saisons</option>';
  seasons.forEach(s => { sel.innerHTML += `<option value="${s}" ${s === cur ? 'selected' : ''}>${escHtml(s)}</option>`; });
}

// ===== TAG SELECTOR =====
function renderTagSelector(containerId, selectedSet) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  if (state.tags.length === 0) {
    c.innerHTML = '<span style="color:#94A3B8;font-size:.85rem">Noch keine Tags vorhanden.</span>';
    return;
  }
  state.tags.forEach(tag => {
    const chip = document.createElement('div');
    const sel = selectedSet.has(tag.id);
    chip.className = `tag-chip ${sel ? 'selected' : 'unselected'}`;
    chip.style.backgroundColor = tag.color;
    chip.innerHTML = `<span class="chip-check">${sel ? '✓ ' : ''}</span>${escHtml(tag.name)}`;
    chip.addEventListener('click', () => {
      if (selectedSet.has(tag.id)) {
        selectedSet.delete(tag.id);
        chip.className = 'tag-chip unselected';
        chip.querySelector('.chip-check').textContent = '';
      } else {
        selectedSet.add(tag.id);
        chip.className = 'tag-chip selected';
        chip.querySelector('.chip-check').textContent = '✓ ';
      }
    });
    c.appendChild(chip);
  });
}

function getSceneTagSet(gameId) {
  if (!sceneTagSets.has(gameId)) sceneTagSets.set(gameId, new Set());
  return sceneTagSets.get(gameId);
}

// ===== GAMES VIEW =====
document.getElementById('game-date').addEventListener('change', (e) => {
  document.getElementById('game-season-display').textContent = calculateSeason(e.target.value);
});

document.getElementById('form-new-game').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date     = document.getElementById('game-date').value;
  const teamId   = document.getElementById('game-team').value;
  const homeAway = document.getElementById('game-home-away').value;
  const opponent = document.getElementById('game-opponent').value.trim();
  const result   = document.getElementById('game-result').value.trim();
  const btn = document.getElementById('btn-save-game');

  btn.disabled = true; btn.textContent = 'Speichern...';

  const { error } = await db.from('games').insert({
    date, season: calculateSeason(date), team_id: teamId,
    opponent, home_away: homeAway || null, result: result || null,
    created_by: state.user.id,
  });

  if (error) {
    showFeedback('game-feedback', 'Fehler: ' + error.message, 'error');
    btn.disabled = false; btn.textContent = 'Spiel anlegen';
    return;
  }

  document.getElementById('game-opponent').value = '';
  document.getElementById('game-result').value   = '';
  showToast('Spiel angelegt.');
  btn.disabled = false; btn.textContent = 'Spiel anlegen';
  await renderGamesList();
});

async function renderGamesList() {
  const container = document.getElementById('games-list');
  container.innerHTML = '<p class="loading-hint">Lade Spiele...</p>';

  const { data: games, error } = await db
    .from('games')
    .select('*, team:teams(name)')
    .order('date', { ascending: false });

  if (error || !games) { container.innerHTML = '<p class="loading-hint">Fehler beim Laden.</p>'; return; }

  if (games.length === 0) {
    container.innerHTML = '<p class="results-hint">Noch keine Spiele angelegt.</p>';
    return;
  }

  // Scene counts in one query
  const { data: entryCounts } = await db.from('entries').select('game_id');
  const countMap = {};
  (entryCounts || []).forEach(e => { countMap[e.game_id] = (countMap[e.game_id] || 0) + 1; });

  container.innerHTML = games.map(g => buildGameCardHtml(g, countMap[g.id] ?? 0)).join('');

  // Render tag selectors for any open scene forms (re-render after list rebuild)
  games.forEach(g => {
    const form = document.getElementById(`scene-form-${g.id}`);
    if (form && !form.classList.contains('hidden')) {
      renderTagSelector(`scene-tags-${g.id}`, getSceneTagSet(g.id));
    }
  });
}

function buildGameCardHtml(g, sceneCount) {
  const locClass = g.home_away === 'Heim' ? 'heim' : 'auswaerts';
  const locBadge = g.home_away
    ? `<span class="game-location-badge ${locClass}">${escHtml(g.home_away)}</span>` : '';
  const resultHtml = g.result
    ? `<span class="game-result-text" id="result-text-${g.id}">${escHtml(g.result)}</span>`
    : `<span class="game-result-text empty" id="result-text-${g.id}">—</span>`;

  return `
    <div class="game-card" id="game-${g.id}">
      <div class="game-main">
        <div class="game-info">
          <span class="entry-team-badge">${escHtml(g.team?.name ?? '—')}</span>
          <span class="game-date-text">${formatDate(g.date)}</span>
          <span class="game-vs">vs</span>
          <span class="game-opponent-text">${escHtml(g.opponent)}</span>
          ${locBadge}
          <div class="game-result-area">
            ${resultHtml}
            <input type="text" class="game-result-input hidden" id="result-input-${g.id}"
              value="${escHtml(g.result || '')}" maxlength="20" placeholder="3:1">
            <button class="btn-icon" id="result-edit-btn-${g.id}"
              onclick="startEditResult('${g.id}')" title="Ergebnis bearbeiten">✏</button>
            <button class="btn-icon confirm hidden" id="result-save-btn-${g.id}"
              onclick="saveResult('${g.id}')">✓</button>
            <button class="btn-icon hidden" id="result-cancel-btn-${g.id}"
              onclick="cancelEditResult('${g.id}')">✗</button>
          </div>
        </div>
        <div class="game-footer">
          <span class="game-season-text">${escHtml(g.season)}</span>
          <span class="dot-sep">·</span>
          <span class="scene-count" id="scene-count-${g.id}">${sceneCount} Szene${sceneCount !== 1 ? 'n' : ''}</span>
          <div class="game-btns">
            <button class="btn-secondary btn-sm" onclick="toggleGameScenes('${g.id}')">Szenen</button>
            <button class="btn-primary btn-sm" onclick="toggleSceneForm('${g.id}')">+ Szene</button>
            <button class="btn-danger btn-sm" onclick="deleteGame('${g.id}', '${escHtml(g.opponent).replace(/'/g,"\\'")}')">Löschen</button>
          </div>
        </div>
      </div>

      <!-- Inline Szene-Formular -->
      <div class="scene-add-form hidden" id="scene-form-${g.id}">
        <div class="form-row">
          <div class="form-group">
            <label>Minute</label>
            <input type="number" id="scene-min-${g.id}" min="0" max="250" placeholder="10">
          </div>
          <div class="form-group">
            <label>Sekunde</label>
            <input type="number" id="scene-sec-${g.id}" min="0" max="59" placeholder="30" value="0">
          </div>
        </div>
        <div class="form-group">
          <label>Tags <span class="label-hint">(mehrere auswählbar)</span></label>
          <div class="tag-selector" id="scene-tags-${g.id}"></div>
        </div>
        <div class="form-group">
          <label>Kommentar <span class="label-hint">(optional)</span></label>
          <textarea id="scene-comment-${g.id}" rows="2" placeholder="Anmerkungen zur Szene..."></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-primary btn-sm" onclick="saveScene('${g.id}')">Szene speichern</button>
          <button class="btn-secondary btn-sm" onclick="toggleSceneForm('${g.id}')">Abbrechen</button>
        </div>
        <div id="scene-feedback-${g.id}" class="feedback hidden"></div>
      </div>

      <!-- Szenen-Liste (aufklappbar) -->
      <div class="game-scenes hidden" id="game-scenes-${g.id}"></div>
    </div>`;
}

function toggleSceneForm(gameId) {
  const form = document.getElementById(`scene-form-${gameId}`);
  if (form.classList.contains('hidden')) {
    form.classList.remove('hidden');
    renderTagSelector(`scene-tags-${gameId}`, getSceneTagSet(gameId));
    document.getElementById(`scene-min-${gameId}`)?.focus();
  } else {
    form.classList.add('hidden');
  }
}

async function toggleGameScenes(gameId) {
  const container = document.getElementById(`game-scenes-${gameId}`);
  if (container.classList.contains('hidden')) {
    container.classList.remove('hidden');
    await loadAndShowScenes(gameId);
  } else {
    container.classList.add('hidden');
  }
}

async function loadAndShowScenes(gameId) {
  const container = document.getElementById(`game-scenes-${gameId}`);
  container.innerHTML = '<p class="loading-hint">Lade Szenen...</p>';

  const { data } = await db
    .from('entries')
    .select('id, minute, second, comment, entry_tags(tag:tags(id,name,color))')
    .eq('game_id', gameId)
    .order('minute').order('second');

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="loading-hint">Noch keine Szenen für dieses Spiel.</p>';
    return;
  }

  container.innerHTML = data.map(entry => {
    const tags = (entry.entry_tags ?? []).map(et => et.tag).filter(Boolean)
      .map(t => `<span class="tag-badge" style="background:${t.color}">${escHtml(t.name)}</span>`).join('');
    const comment = entry.comment ? `<span class="entry-comment">💬 ${escHtml(entry.comment)}</span>` : '';
    return `
      <div class="scene-item">
        <span class="entry-timestamp">${fmt2(entry.minute)}:${fmt2(entry.second)}</span>
        <div class="entry-right">
          <div class="entry-tags">${tags}</div>
          ${comment}
        </div>
        <button class="btn-danger btn-sm" onclick="deleteScene('${entry.id}','${gameId}')">✕</button>
      </div>`;
  }).join('');
}

async function saveScene(gameId) {
  const minVal = document.getElementById(`scene-min-${gameId}`).value;
  const minute  = parseInt(minVal, 10);
  const second  = parseInt(document.getElementById(`scene-sec-${gameId}`).value || '0', 10);
  const comment = document.getElementById(`scene-comment-${gameId}`).value.trim();
  const tagIds  = [...getSceneTagSet(gameId)];

  if (minVal === '' || isNaN(minute)) { showFeedback(`scene-feedback-${gameId}`, 'Bitte Minute eingeben.', 'error'); return; }
  if (tagIds.length === 0)            { showFeedback(`scene-feedback-${gameId}`, 'Bitte mindestens einen Tag wählen.', 'error'); return; }

  const { data: entry, error } = await db
    .from('entries')
    .insert({ game_id: gameId, minute, second, comment: comment || null, created_by: state.user.id })
    .select().single();

  if (error) { showFeedback(`scene-feedback-${gameId}`, 'Fehler: ' + error.message, 'error'); return; }

  await db.from('entry_tags').insert(tagIds.map(tagId => ({ entry_id: entry.id, tag_id: tagId })));

  // Reset form
  document.getElementById(`scene-min-${gameId}`).value     = '';
  document.getElementById(`scene-sec-${gameId}`).value     = '0';
  document.getElementById(`scene-comment-${gameId}`).value = '';
  getSceneTagSet(gameId).clear();
  renderTagSelector(`scene-tags-${gameId}`, getSceneTagSet(gameId));

  // Update count
  const countEl = document.getElementById(`scene-count-${gameId}`);
  if (countEl) {
    const cur = parseInt(countEl.textContent) || 0;
    const n = cur + 1;
    countEl.textContent = `${n} Szene${n !== 1 ? 'n' : ''}`;
  }

  // Refresh scenes list if open
  const scenesEl = document.getElementById(`game-scenes-${gameId}`);
  if (scenesEl && !scenesEl.classList.contains('hidden')) await loadAndShowScenes(gameId);

  showToast('Szene gespeichert.');
  document.getElementById(`scene-form-${gameId}`).classList.add('hidden');
}

async function deleteScene(entryId, gameId) {
  if (!confirm('Szene wirklich löschen?')) return;
  const { error } = await db.from('entries').delete().eq('id', entryId);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

  const countEl = document.getElementById(`scene-count-${gameId}`);
  if (countEl) {
    const n = Math.max(0, (parseInt(countEl.textContent) || 1) - 1);
    countEl.textContent = `${n} Szene${n !== 1 ? 'n' : ''}`;
  }
  await loadAndShowScenes(gameId);
}

async function deleteGame(gameId, opponent) {
  if (!confirm(`Spiel gegen "${opponent}" und alle zugehörigen Szenen wirklich löschen?`)) return;
  const { error } = await db.from('games').delete().eq('id', gameId);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  sceneTagSets.delete(gameId);
  showToast(`Spiel gegen "${opponent}" gelöscht.`);
  await renderGamesList();
}

// Ergebnis inline bearbeiten
function startEditResult(gameId) {
  document.getElementById(`result-text-${gameId}`).classList.add('hidden');
  document.getElementById(`result-input-${gameId}`).classList.remove('hidden');
  document.getElementById(`result-edit-btn-${gameId}`).classList.add('hidden');
  document.getElementById(`result-save-btn-${gameId}`).classList.remove('hidden');
  document.getElementById(`result-cancel-btn-${gameId}`).classList.remove('hidden');
  document.getElementById(`result-input-${gameId}`).focus();
}

function cancelEditResult(gameId) {
  document.getElementById(`result-text-${gameId}`).classList.remove('hidden');
  document.getElementById(`result-input-${gameId}`).classList.add('hidden');
  document.getElementById(`result-edit-btn-${gameId}`).classList.remove('hidden');
  document.getElementById(`result-save-btn-${gameId}`).classList.add('hidden');
  document.getElementById(`result-cancel-btn-${gameId}`).classList.add('hidden');
}

async function saveResult(gameId) {
  const result = document.getElementById(`result-input-${gameId}`).value.trim();
  const { error } = await db.from('games').update({ result: result || null }).eq('id', gameId);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

  const textEl = document.getElementById(`result-text-${gameId}`);
  textEl.textContent = result || '—';
  textEl.className = result ? 'game-result-text' : 'game-result-text empty';
  cancelEditResult(gameId);
  showToast('Ergebnis gespeichert.');
}

// ===== QUERY VIEW =====
document.getElementById('btn-search').addEventListener('click', handleQuery);

document.getElementById('btn-reset-filter').addEventListener('click', () => {
  document.getElementById('filter-season').value    = '';
  document.getElementById('filter-team').value      = '';
  document.getElementById('filter-date-from').value  = '';
  document.getElementById('filter-date-to').value    = '';
  document.getElementById('filter-opponent').value   = '';
  state.querySelectedTags.clear();
  renderTagSelector('query-tag-selector', state.querySelectedTags);
  document.getElementById('query-results').innerHTML = '<p class="results-hint">Filter anwenden um Szenen anzuzeigen.</p>';
});

async function handleQuery() {
  const season   = document.getElementById('filter-season').value;
  const teamId   = document.getElementById('filter-team').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo   = document.getElementById('filter-date-to').value;
  const opponent = document.getElementById('filter-opponent').value.trim();
  const tagIds   = [...state.querySelectedTags];
  const resultsEl = document.getElementById('query-results');

  resultsEl.innerHTML = '<p class="loading-hint">Suche läuft...</p>';

  // 1. Spiele filtern
  let gq = db.from('games').select('id,date,season,opponent,home_away,result,team:teams(name)').order('date', { ascending: false });
  if (season)   gq = gq.eq('season', season);
  if (teamId)   gq = gq.eq('team_id', teamId);
  if (dateFrom) gq = gq.gte('date', dateFrom);
  if (dateTo)   gq = gq.lte('date', dateTo);
  if (opponent) gq = gq.ilike('opponent', `%${opponent}%`);

  const { data: games } = await gq;
  if (!games || games.length === 0) { resultsEl.innerHTML = '<p class="results-hint">Keine Spiele gefunden.</p>'; return; }

  const gameIds = games.map(g => g.id);
  const gameMap = Object.fromEntries(games.map(g => [g.id, g]));

  // 2. Tag-Filter: entry_ids ermitteln
  let entryIdFilter = null;
  if (tagIds.length > 0) {
    const { data: tagged } = await db.from('entry_tags').select('entry_id').in('tag_id', tagIds);
    if (!tagged || tagged.length === 0) { resultsEl.innerHTML = '<p class="results-hint">Keine Szenen gefunden.</p>'; return; }
    entryIdFilter = [...new Set(tagged.map(r => r.entry_id))];
  }

  // 3. Szenen laden
  let eq = db.from('entries')
    .select('id,game_id,minute,second,comment,entry_tags(tag:tags(id,name,color))')
    .in('game_id', gameIds)
    .order('minute').order('second');
  if (entryIdFilter) eq = eq.in('id', entryIdFilter);

  const { data: entries } = await eq;
  if (!entries || entries.length === 0) { resultsEl.innerHTML = '<p class="results-hint">Keine Szenen gefunden.</p>'; return; }

  renderQueryResults(entries, gameMap, gameIds);
}

function renderQueryResults(entries, gameMap, orderedGameIds) {
  // Group by game, preserve game order
  const groups = {};
  entries.forEach(e => {
    if (!groups[e.game_id]) groups[e.game_id] = [];
    groups[e.game_id].push(e);
  });

  const total = entries.length;
  let html = `<p class="results-count">${total} Szene${total !== 1 ? 'n' : ''} in ${Object.keys(groups).length} Spiel${Object.keys(groups).length !== 1 ? 'en' : ''} gefunden</p>`;

  orderedGameIds.forEach(gameId => {
    const scenes = groups[gameId];
    if (!scenes) return;
    const g = gameMap[gameId];
    const locClass = g.home_away === 'Heim' ? 'heim' : 'auswaerts';
    const locBadge = g.home_away
      ? `<span class="game-location-badge ${locClass}">${escHtml(g.home_away)}</span>` : '';

    html += `
      <div class="result-game-group">
        <div class="result-game-header">
          <span class="entry-team-badge">${escHtml(g.team?.name ?? '—')}</span>
          <span>${formatDate(g.date)}</span>
          <span class="game-vs">vs</span>
          <span class="result-game-opponent">${escHtml(g.opponent)}</span>
          ${locBadge}
          ${g.result ? `<span class="result-game-result">${escHtml(g.result)}</span>` : ''}
        </div>
        <div class="result-scenes">
          ${scenes.map(entry => {
            const tags = (entry.entry_tags ?? []).map(et => et.tag).filter(Boolean)
              .map(t => `<span class="tag-badge" style="background:${t.color}">${escHtml(t.name)}</span>`).join('');
            const comment = entry.comment ? `<span class="entry-comment">💬 ${escHtml(entry.comment)}</span>` : '';
            return `
              <div class="scene-item">
                <span class="entry-timestamp">${fmt2(entry.minute)}:${fmt2(entry.second)}</span>
                <div class="entry-right">
                  <div class="entry-tags">${tags}</div>
                  ${comment}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  });

  document.getElementById('query-results').innerHTML = html;
}

// ===== TAG MANAGEMENT =====
async function renderTagsList() {
  await loadTags();
  const container = document.getElementById('tags-list');
  if (state.tags.length === 0) { container.innerHTML = '<p class="loading-hint">Noch keine Tags vorhanden.</p>'; return; }

  container.innerHTML = state.tags.map(tag => `
    <div class="tag-row" id="tag-row-${tag.id}">
      <div class="tag-row-display" id="tag-display-${tag.id}">
        <div class="tag-swatch" style="background:${tag.color}"></div>
        <span class="tag-row-name">${escHtml(tag.name)}</span>
      </div>
      <div class="tag-row-edit" id="tag-edit-${tag.id}">
        <input type="text" id="tag-edit-name-${tag.id}" value="${escHtml(tag.name)}" maxlength="60">
        <input type="color" id="tag-edit-color-${tag.id}" value="${tag.color}">
      </div>
      <div class="tag-row-actions">
        <button class="btn-edit btn-sm" id="tag-btn-edit-${tag.id}" onclick="startEditTag('${tag.id}')">Bearbeiten</button>
        <button class="btn-primary btn-sm" id="tag-btn-save-${tag.id}" style="display:none" onclick="saveEditTag('${tag.id}')">Speichern</button>
        <button class="btn-secondary btn-sm" id="tag-btn-cancel-${tag.id}" style="display:none" onclick="cancelEditTag('${tag.id}')">Abbrechen</button>
        <button class="btn-danger btn-sm" onclick="deleteTag('${tag.id}','${escHtml(tag.name).replace(/'/g,"\\'")}')">Löschen</button>
      </div>
    </div>`).join('');
}

function startEditTag(id) {
  document.getElementById(`tag-display-${id}`).style.display = 'none';
  document.getElementById(`tag-edit-${id}`).classList.add('visible');
  document.getElementById(`tag-btn-edit-${id}`).style.display   = 'none';
  document.getElementById(`tag-btn-save-${id}`).style.display   = '';
  document.getElementById(`tag-btn-cancel-${id}`).style.display = '';
  document.getElementById(`tag-edit-name-${id}`).focus();
}

function cancelEditTag(id) {
  const tag = state.tags.find(t => t.id === id);
  if (tag) {
    document.getElementById(`tag-edit-name-${id}`).value  = tag.name;
    document.getElementById(`tag-edit-color-${id}`).value = tag.color;
  }
  document.getElementById(`tag-display-${id}`).style.display = '';
  document.getElementById(`tag-edit-${id}`).classList.remove('visible');
  document.getElementById(`tag-btn-edit-${id}`).style.display   = '';
  document.getElementById(`tag-btn-save-${id}`).style.display   = 'none';
  document.getElementById(`tag-btn-cancel-${id}`).style.display = 'none';
}

async function saveEditTag(id) {
  const name  = document.getElementById(`tag-edit-name-${id}`).value.trim();
  const color = document.getElementById(`tag-edit-color-${id}`).value;
  if (!name) { showToast('Tag-Name darf nicht leer sein.', 'error'); return; }
  const { error } = await db.from('tags').update({ name, color }).eq('id', id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Tag aktualisiert.');
  await renderTagsList();
}

async function deleteTag(id, name) {
  if (!confirm(`Tag "${name}" wirklich löschen?\nEr wird auch von allen Szenen entfernt.`)) return;
  const { error } = await db.from('tags').delete().eq('id', id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  state.querySelectedTags.delete(id);
  sceneTagSets.forEach(set => set.delete(id));
  showToast(`Tag "${name}" gelöscht.`);
  await renderTagsList();
}

document.getElementById('btn-add-tag').addEventListener('click', async () => {
  const name  = document.getElementById('new-tag-name').value.trim();
  const color = document.getElementById('new-tag-color').value;
  if (!name) { showFeedback('add-tag-feedback', 'Bitte einen Tag-Namen eingeben.', 'error'); return; }
  const { error } = await db.from('tags').insert({ name, color });
  if (error) {
    showFeedback('add-tag-feedback',
      (error.message.includes('unique') || error.code === '23505') ? `Tag "${name}" existiert bereits.` : 'Fehler: ' + error.message,
      'error');
    return;
  }
  document.getElementById('new-tag-name').value  = '';
  document.getElementById('new-tag-color').value = '#6366F1';
  showToast(`Tag "${name}" erstellt.`);
  await renderTagsList();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // Set default date for new game form
  document.getElementById('game-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('game-season-display').textContent = calculateSeason(document.getElementById('game-date').value);

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      state.user = session.user;
      document.getElementById('screen-login').classList.add('hidden');
      document.getElementById('screen-app').classList.remove('hidden');
      document.getElementById('nav-user-email').textContent = session.user.email;
      await Promise.all([loadTeams(), loadTags()]);
      await renderGamesList();
    } else {
      state.user = null;
      document.getElementById('screen-login').classList.remove('hidden');
      document.getElementById('screen-app').classList.add('hidden');
    }
  });
});
