'use strict';

(function () {
  let activeFilter = '';

  function timeAgo(iso) {
    const secs = Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000);
    if (secs < 60)         return 'just now';
    if (secs < 3600)       return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400)      return `${Math.floor(secs / 3600)}h ago`;
    if (secs < 86400 * 7)  return `${Math.floor(secs / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

    list.querySelectorAll('.note-row').forEach(row => {
      row.addEventListener('click', () => {
        location.hash = 'noteEditor/' + row.dataset.id;
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter') location.hash = 'noteEditor/' + row.dataset.id;
      });
    });
  }

  async function fetchAndRender() {
    const qs = activeFilter ? `?type=${activeFilter}` : '';
    const notes = await api('GET', `/notes${qs}`);
    renderNotes(notes);
  }

  async function loadHome() {
    activeFilter = '';
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === activeFilter);
      btn.onclick = () => {
        activeFilter = btn.dataset.filter;
        document.querySelectorAll('.filter-tab').forEach(b => b.classList.toggle('active', b === btn));
        fetchAndRender();
      };
    });
    await fetchAndRender();
  }

  window.loadHome = loadHome;
})();
