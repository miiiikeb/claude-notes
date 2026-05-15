'use strict';

(function () {
  let currentNote = null;

  // ── Tasks (wired in #5) ───────────────────────────────────────────────────

  const ALL_STATUSES = ['backlog','todo','in_progress','blocked','done','cancelled'];

  async function loadTasks(noteId) {
    const list = document.getElementById('detail-tasks-list');
    try {
      const tasks = await api('GET', `/notes/${noteId}/tasks`);
      if (!tasks.length) {
        list.innerHTML = '<p class="detail-section-empty">No tasks linked.</p>';
        return;
      }
      list.innerHTML = tasks.map(t => `
        <div class="detail-task-row" data-task-id="${t.id}">
          <select class="task-status-select task-status-select--sm" data-id="${t.id}" data-status="${t.status}">
            ${ALL_STATUSES.map(s => `<option value="${s}"${s === t.status ? ' selected' : ''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
          <span class="detail-task-title">${escHtml(t.title)}</span>
          ${t.due_date ? `<span class="detail-task-due">${t.due_date}</span>` : ''}
          <button class="btn btn-ghost btn-sm detail-task-unlink" data-id="${t.id}" title="Unlink">×</button>
        </div>
      `).join('');

      list.querySelectorAll('.task-status-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          sel.dataset.status = sel.value;
          try {
            await api('PATCH', `/tasks/${sel.dataset.id}`, { status: sel.value });
          } catch {
            showToast('Failed to update status', true);
            await loadTasks(noteId);
          }
        });
      });

      list.querySelectorAll('.detail-task-unlink').forEach(btn => {
        btn.addEventListener('click', () => unlinkTask(noteId, btn.dataset.id));
      });
    } catch {
      list.innerHTML = '<p class="detail-section-empty">Tasks not yet available.</p>';
    }
  }

  async function unlinkTask(noteId, taskId) {
    await api('DELETE', `/notes/${noteId}/tasks/${taskId}`);
    await loadTasks(noteId);
  }

  // ── Tags (wired in #8) ───────────────────────────────────────────────────

  async function loadTags(noteId) {
    const chipsEl = document.getElementById('detail-tags-list');
    try {
      const tags = await api('GET', `/notes/${noteId}/tags`);
      renderTagChips(noteId, tags);
    } catch {
      chipsEl.innerHTML = '<span class="detail-section-empty">Tags not yet available.</span>';
    }
  }

  function renderTagChips(noteId, tags) {
    const chipsEl = document.getElementById('detail-tags-list');
    chipsEl.innerHTML = tags.map(t => `
      <span class="tag-chip">
        ${escHtml(t.name)}
        <button class="tag-chip-remove" data-id="${t.id}" title="Remove">×</button>
      </span>
    `).join('');
    chipsEl.querySelectorAll('.tag-chip-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api('DELETE', `/notes/${noteId}/tags/${btn.dataset.id}`);
        await loadTags(noteId);
      });
    });
  }

  async function setupTagInput(noteId) {
    const input = document.getElementById('detail-tag-input');
    const suggestions = document.getElementById('detail-tags-suggestions');

    try {
      const allTags = await api('GET', '/tags');
      suggestions.innerHTML = allTags.map(t => `<option value="${escHtml(t.name)}">`).join('');
    } catch { /* tags route not yet available */ }

    input.onkeydown = async (e) => {
      if (e.key !== 'Enter') return;
      const name = input.value.trim();
      if (!name) return;
      try {
        await api('POST', `/notes/${noteId}/tags`, { name });
        input.value = '';
        await loadTags(noteId);
      } catch (err) {
        showToast(err.message || 'Failed to add tag', true);
      }
    };
  }

  // ── Main ─────────────────────────────────────────────────────────────────

  async function loadNoteDetail() {
    const id = location.hash.replace('#', '').split('/')[1];
    if (!id) { navigate('home'); return; }

    try {
      currentNote = await api('GET', `/notes/${id}`);
    } catch {
      showToast('Note not found', true);
      navigate('home');
      return;
    }

    const n = currentNote;

    const badge = document.getElementById('detail-type-badge');
    badge.textContent = n.type;
    badge.className = `type-badge type-badge--${n.type}`;

    document.getElementById('detail-date').textContent  = n.note_date;
    document.getElementById('detail-title').textContent = n.title;
    const rawBody = n.body || '';
    document.getElementById('detail-body').innerHTML = n.format === 'html'
      ? DOMPurify.sanitize(rawBody)
      : DOMPurify.sanitize(marked.parse(rawBody));

    await Promise.all([
      loadTasks(id),
      loadTags(id),
      setupTagInput(id),
    ]);
  }

  // ── Static event wiring ───────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-detail-back').addEventListener('click', () => navigate('home'));
    document.getElementById('btn-detail-edit').addEventListener('click', () => {
      if (currentNote) location.hash = 'noteEditor/' + currentNote.id;
    });
    const addTaskForm   = document.getElementById('detail-task-add-form');
    const addTaskTitle  = document.getElementById('detail-new-task-title');
    const addTaskSave   = document.getElementById('detail-task-add-save');
    const addTaskCancel = document.getElementById('detail-task-add-cancel');

    document.getElementById('btn-add-task').addEventListener('click', () => {
      addTaskForm.style.display = '';
      addTaskTitle.focus();
    });

    addTaskCancel.addEventListener('click', () => {
      addTaskForm.style.display = 'none';
      addTaskTitle.value = '';
    });

    addTaskSave.addEventListener('click', async () => {
      const title = addTaskTitle.value.trim();
      if (!title) { showToast('Title required', true); return; }
      try {
        await api('POST', `/notes/${currentNote.id}/tasks`, { title });
        addTaskTitle.value = '';
        addTaskForm.style.display = 'none';
        await loadTasks(currentNote.id);
      } catch {
        showToast('Failed to add task', true);
      }
    });

    addTaskTitle.addEventListener('keydown', e => {
      if (e.key === 'Enter') addTaskSave.click();
      if (e.key === 'Escape') addTaskCancel.click();
    });
  });

  window.loadNoteDetail = loadNoteDetail;
})();
