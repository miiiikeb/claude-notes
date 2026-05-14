'use strict';

(function () {
  let activeFilter = 'all';
  let expandedId = null;

  const ALL_STATUSES = ['backlog','todo','in_progress','blocked','done','cancelled'];

  function statusOptions(current) {
    return ALL_STATUSES.map(s =>
      `<option value="${s}"${s === current ? ' selected' : ''}>${s.replace('_', ' ')}</option>`
    ).join('');
  }

  function renderTaskRow(t) {
    const expanded = t.id === expandedId;
    return `
      <div class="task-row${expanded ? ' task-row--expanded' : ''}" data-task-id="${t.id}">
        <div class="task-row-main">
          <select class="task-status-select" data-id="${t.id}" data-status="${t.status}">
            ${statusOptions(t.status)}
          </select>
          <span class="task-row-title">${escHtml(t.title)}</span>
          ${t.due_date ? `<span class="task-row-due">${t.due_date}</span>` : ''}
          ${t.note_count ? `<span class="task-row-note-count" title="${t.note_count} note${t.note_count !== 1 ? 's' : ''}">${t.note_count}</span>` : ''}
          <button class="btn btn-ghost btn-sm task-row-expand-btn" data-id="${t.id}">${expanded ? '−' : '+'}</button>
        </div>
        ${expanded ? `<div class="task-row-notes" id="task-notes-${t.id}"><span class="detail-section-empty">Loading…</span></div>` : ''}
      </div>
    `;
  }

  async function fetchAndRender() {
    const list  = document.getElementById('tasks-list');
    const empty = document.getElementById('tasks-empty');
    try {
      const qs    = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
      const tasks = await api('GET', `/tasks${qs}`);
      if (!tasks.length) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
      }
      empty.style.display = 'none';
      list.innerHTML = tasks.map(renderTaskRow).join('');
      wireList(list);
      if (expandedId) loadLinkedNotes(expandedId);
    } catch {
      showToast('Failed to load tasks', true);
    }
  }

  function wireList(list) {
    list.querySelectorAll('.task-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        sel.dataset.status = sel.value;
        try {
          await api('PATCH', `/tasks/${sel.dataset.id}`, { status: sel.value });
          await fetchAndRender();
        } catch {
          showToast('Failed to update status', true);
          await fetchAndRender();
        }
      });
    });

    list.querySelectorAll('.task-row-expand-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        expandedId = expandedId === id ? null : id;
        await fetchAndRender();
      });
    });
  }

  async function loadLinkedNotes(taskId) {
    const el = document.getElementById(`task-notes-${taskId}`);
    if (!el) return;
    try {
      const notes = await api('GET', `/tasks/${taskId}/notes`);
      if (!notes.length) {
        el.innerHTML = '<span class="detail-section-empty">No notes linked.</span>';
        return;
      }
      el.innerHTML = notes.map(n => `
        <a href="#noteDetail/${n.id}" class="task-linked-note">
          <span class="type-badge type-badge--${n.type}">${n.type}</span>
          <span class="task-linked-note-title">${escHtml(n.title)}</span>
          <span class="task-linked-note-date">${n.note_date}</span>
        </a>
      `).join('');
    } catch {
      el.innerHTML = '<span class="detail-section-empty">Could not load notes.</span>';
    }
  }

  function showCreateForm() {
    document.getElementById('tasks-create-form').style.display = '';
    document.getElementById('new-task-title').focus();
  }

  function hideCreateForm() {
    document.getElementById('tasks-create-form').style.display = 'none';
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-status').value = 'backlog';
    document.getElementById('new-task-due').value = '';
  }

  async function saveNewTask() {
    const title = document.getElementById('new-task-title').value.trim();
    if (!title) { showToast('Title required', true); return; }
    const status   = document.getElementById('new-task-status').value;
    const due_date = document.getElementById('new-task-due').value || null;
    try {
      await api('POST', '/tasks', { title, status, due_date });
      hideCreateForm();
      await fetchAndRender();
    } catch {
      showToast('Failed to create task', true);
    }
  }

  async function loadTasks() {
    activeFilter = 'all';
    expandedId   = null;
    hideCreateForm();
    document.querySelectorAll('#page-tasks .filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    await fetchAndRender();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#page-tasks .filter-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeFilter = btn.dataset.filter;
        expandedId   = null;
        document.querySelectorAll('#page-tasks .filter-tab').forEach(b =>
          b.classList.toggle('active', b === btn));
        await fetchAndRender();
      });
    });

    document.getElementById('btn-new-task-page').addEventListener('click', showCreateForm);
    document.getElementById('tasks-create-cancel').addEventListener('click', hideCreateForm);
    document.getElementById('tasks-create-save').addEventListener('click', saveNewTask);
    document.getElementById('new-task-title').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveNewTask();
      if (e.key === 'Escape') hideCreateForm();
    });
  });

  window.loadTasks = loadTasks;
})();
