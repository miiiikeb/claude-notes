'use strict';

(function () {
  let activeFilter = '';
  let searchTimer  = null;

  function timeAgo(iso) {
    // SQLite datetime() uses a space separator; replace with T for cross-browser ISO 8601 parsing
    const ms = new Date(iso.replace(' ', 'T') + 'Z').getTime();
    if (!ms) return '';
    const secs = Math.floor((Date.now() - ms) / 1000);
    if (secs < 60)         return 'just now';
    if (secs < 3600)       return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400)      return `${Math.floor(secs / 3600)}h ago`;
    if (secs < 86400 * 7)  return `${Math.floor(secs / 86400)}d ago`;
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // Escape then restore <<<…>>> markers as <mark> — keeps user content XSS-safe
  function renderSnippet(raw) {
    if (!raw) return '';
    return escHtml(raw)
      .replace(/&lt;&lt;&lt;/g, '<mark>')
      .replace(/&gt;&gt;&gt;/g, '</mark>');
  }

  function wireRows(list) {
    list.querySelectorAll('.note-row').forEach(row => {
      row.addEventListener('click', () => { location.hash = 'noteDetail/' + row.dataset.id; });
      row.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = 'noteDetail/' + row.dataset.id; });
    });
  }

  function renderNotes(notes) {
    const list  = document.getElementById('notes-list');
    const empty = document.getElementById('notes-empty');
    if (!notes.length) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = notes.map(n => `
      <div class="note-row" data-id="${n.id}" role="button" tabindex="0">
        <span class="type-badge type-badge--${n.type}">${n.type}</span>
        <span class="note-row-title">${escHtml(n.title)}</span>
        <span class="note-row-date">${n.note_date}</span>
        <span class="note-row-age">${timeAgo(n.updated_at)}</span>
      </div>
    `).join('');
    wireRows(list);
  }

  function renderSearchResults(results) {
    const list  = document.getElementById('notes-list');
    const empty = document.getElementById('notes-empty');
    empty.style.display = 'none';
    if (!results.length) {
      list.innerHTML = '<p class="search-no-results">No notes match your search.</p>';
      return;
    }
    list.innerHTML = results.map(n => `
      <div class="note-row note-row--search" data-id="${n.id}" role="button" tabindex="0">
        <span class="type-badge type-badge--${n.type}">${n.type}</span>
        <span class="note-row-title">${escHtml(n.title)}</span>
        <span class="note-row-date">${n.note_date}</span>
        ${n.snippet ? `<span class="search-snippet">${renderSnippet(n.snippet)}</span>` : ''}
      </div>
    `).join('');
    wireRows(list);
  }

  function showFilterTabs(show) {
    document.getElementById('home-filter-tabs').style.display = show ? '' : 'none';
  }

  async function doSearch(q) {
    showFilterTabs(false);
    try {
      const results = await api('GET', `/notes/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(results);
    } catch {
      showToast('Search failed', true);
    }
  }

  async function fetchAndRender() {
    showFilterTabs(true);
    try {
      const qs = activeFilter ? `?type=${activeFilter}` : '';
      const notes = await api('GET', `/notes${qs}`);
      renderNotes(notes);
    } catch {
      showToast('Failed to load notes', true);
    }
  }

  async function loadHome() {
    activeFilter = '';
    clearTimeout(searchTimer);
    document.getElementById('home-search').value = '';
    showFilterTabs(true);

    document.querySelectorAll('#page-home .filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === activeFilter);
      btn.onclick = () => {
        activeFilter = btn.dataset.filter;
        document.getElementById('home-search').value = '';
        document.querySelectorAll('#page-home .filter-tab').forEach(b =>
          b.classList.toggle('active', b === btn));
        fetchAndRender();
      };
    });

    await fetchAndRender();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('home-search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      const q = this.value.trim();
      if (q.length < 2) {
        fetchAndRender();
        return;
      }
      searchTimer = setTimeout(() => doSearch(q), 300);
    });
  });

  window.loadHome = loadHome;
})();
