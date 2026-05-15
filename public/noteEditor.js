'use strict';

(function () {
  let currentId    = null;
  let currentMode  = 'rt'; // 'rt' | 'md'
  let previewOn    = false;
  let debounceTimer;
  let quill;
  let turndown;

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  // ── Mode management ────────────────────────────────────────────────────────

  function setMode(mode) {
    currentMode = mode;
    const isRT = mode === 'rt';

    document.getElementById('editor-rt-pane').style.display   = isRT ? '' : 'none';
    document.getElementById('editor-md-pane').style.display   = isRT ? 'none' : '';
    document.getElementById('btn-mode-toggle').textContent    = isRT ? 'Markdown' : 'Rich Text';
    document.getElementById('btn-preview-toggle').style.display = isRT ? 'none' : '';

    if (isRT) {
      document.getElementById('editor-preview-pane').style.display = 'none';
      previewOn = false;
    }
  }

  async function toggleMode() {
    if (currentMode === 'rt') {
      const ok = await confirmDialog(
        'Switch to Markdown',
        'Some rich-text formatting may not survive conversion to Markdown. Continue?'
      );
      if (!ok) return;
      const html = quill.root.innerHTML;
      document.getElementById('editor-textarea').value = turndown.turndown(html);
      setMode('md');
    } else {
      const md   = document.getElementById('editor-textarea').value;
      const html = DOMPurify.sanitize(marked.parse(md));
      quill.root.innerHTML = html;
      setMode('rt');
    }
  }

  // ── Preview (MD mode only) ─────────────────────────────────────────────────

  function renderPreview() {
    const src = document.getElementById('editor-textarea').value;
    document.getElementById('editor-preview').innerHTML = DOMPurify.sanitize(marked.parse(src));
  }

  function setPreviewVisible(on) {
    previewOn = on;
    document.getElementById('editor-preview-pane').style.display = on ? '' : 'none';
    document.getElementById('btn-preview-toggle').textContent    = on ? 'Hide preview' : 'Preview';
    if (on) renderPreview();
  }

  // ── Populate / reset ───────────────────────────────────────────────────────

  function populate(note) {
    document.getElementById('editor-type').value  = note.type;
    document.getElementById('editor-date').value  = note.note_date;
    document.getElementById('editor-title').value = note.title;

    if (note.format === 'html') {
      quill.root.innerHTML = DOMPurify.sanitize(note.body || '');
      setMode('rt');
    } else {
      document.getElementById('editor-textarea').value = note.body || '';
      setMode('md');
    }
  }

  function reset() {
    document.getElementById('editor-type').value  = 'general';
    document.getElementById('editor-date').value  = today();
    document.getElementById('editor-title').value = '';
    quill.setText('');
    setMode('rt');
    document.getElementById('editor-tasks-section').style.display = 'none';
    document.getElementById('editor-task-add-form').style.display = 'none';
  }

  // ── Save / delete ──────────────────────────────────────────────────────────

  async function save() {
    const type      = document.getElementById('editor-type').value;
    const note_date = document.getElementById('editor-date').value;
    const title     = document.getElementById('editor-title').value.trim();

    let body, format;
    if (currentMode === 'rt') {
      // Quill empty state is '<p><br></p>' — normalise to ''
      const raw = quill.root.innerHTML;
      body   = (raw === '<p><br></p>' || quill.getLength() <= 1) ? '' : raw;
      format = 'html';
    } else {
      body   = document.getElementById('editor-textarea').value;
      format = 'md';
    }

    if (!title) { showToast('Title is required', true); return; }

    const btn = document.getElementById('btn-editor-save');
    btn.disabled = true;
    try {
      if (currentId) {
        await api('PATCH', `/notes/${currentId}`, { type, note_date, title, body, format });
        showToast('Saved');
      } else {
        const note = await api('POST', '/notes', { type, note_date, title, body, format });
        currentId = note.id;
        document.getElementById('btn-editor-delete').style.display = '';
        location.replace('#noteEditor/' + currentId);
        showToast('Note created');
      }
    } catch (e) {
      showToast(e.message || 'Save failed', true);
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteNote() {
    if (!currentId) return;
    const ok = await confirmDialog('Delete note', 'This note will be permanently deleted.');
    if (!ok) return;
    try {
      await api('DELETE', `/notes/${currentId}`);
      navigate('home');
      showToast('Note deleted');
    } catch (e) {
      showToast(e.message || 'Delete failed', true);
    }
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  async function loadEditorTasks(noteId) {
    const section = document.getElementById('editor-tasks-section');
    const list    = document.getElementById('editor-tasks-list');
    section.style.display = '';
    try {
      const tasks = await api('GET', `/notes/${noteId}/tasks`);
      list.innerHTML = tasks.map(t => `
        <span class="editor-task-chip">
          <span class="task-status-badge task-status--${t.status}">${t.status.replace('_', ' ')}</span>
          ${escHtml(t.title)}
          <button class="task-chip-remove" data-id="${t.id}" title="Unlink">×</button>
        </span>
      `).join('');
      list.querySelectorAll('.task-chip-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          await api('DELETE', `/notes/${noteId}/tasks/${btn.dataset.id}`);
          await loadEditorTasks(noteId);
        });
      });
    } catch { /* ignore */ }
  }

  async function loadEditorTags(noteId) {
    const section     = document.getElementById('editor-tags-section');
    const chipsEl     = document.getElementById('editor-tags-list');
    const suggestions = document.getElementById('editor-tags-suggestions');
    section.style.display = '';
    try {
      const [tags, allTags] = await Promise.all([
        api('GET', `/notes/${noteId}/tags`),
        api('GET', '/tags'),
      ]);
      chipsEl.innerHTML = tags.map(t => `
        <span class="tag-chip">
          ${escHtml(t.name)}
          <button class="tag-chip-remove" data-id="${t.id}" title="Remove">×</button>
        </span>
      `).join('');
      chipsEl.querySelectorAll('.tag-chip-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          await api('DELETE', `/notes/${noteId}/tags/${btn.dataset.id}`);
          await loadEditorTags(noteId);
        });
      });
      suggestions.innerHTML = allTags.map(t => `<option value="${escHtml(t.name)}">`).join('');
    } catch { /* ignore */ }
  }

  // ── Page load ──────────────────────────────────────────────────────────────

  async function loadNoteEditor() {
    const parts = location.hash.replace('#', '').split('/');
    const id = parts[1] ? parseInt(parts[1], 10) : null;
    currentId = id || null;

    const deleteBtn = document.getElementById('btn-editor-delete');
    deleteBtn.style.display = currentId ? '' : 'none';
    document.getElementById('editor-tags-section').style.display = 'none';

    if (currentId) {
      try {
        const note = await api('GET', `/notes/${currentId}`);
        populate(note);
        await Promise.all([loadEditorTags(currentId), loadEditorTasks(currentId)]);
      } catch {
        showToast('Note not found', true);
        navigate('home');
        return;
      }
    } else {
      reset();
    }

    document.getElementById('editor-title').focus();
  }

  // ── Static wiring (once on DOMContentLoaded) ───────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    quill = new Quill('#editor-quill', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
      },
      placeholder: 'Write your note…',
    });

    turndown = new TurndownService({
      headingStyle:    'atx',
      bulletListMarker: '-',
      codeBlockStyle:  'fenced',
    });

    document.getElementById('btn-editor-back').addEventListener('click', () => navigate('home'));
    document.getElementById('btn-editor-save').addEventListener('click', save);
    document.getElementById('btn-editor-delete').addEventListener('click', deleteNote);
    document.getElementById('btn-mode-toggle').addEventListener('click', toggleMode);
    document.getElementById('btn-preview-toggle').addEventListener('click', () => setPreviewVisible(!previewOn));

    document.getElementById('editor-textarea').addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { if (previewOn) renderPreview(); }, 200);
    });

    // Ctrl/Cmd+S saves from either mode
    const saveOnCtrlS = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    };
    document.getElementById('editor-textarea').addEventListener('keydown', saveOnCtrlS);
    document.getElementById('editor-quill').addEventListener('keydown', saveOnCtrlS);

    const editorTaskForm   = document.getElementById('editor-task-add-form');
    const editorTaskTitle  = document.getElementById('editor-new-task-title');
    const editorTaskStatus = document.getElementById('editor-new-task-status');
    const editorTaskDue    = document.getElementById('editor-new-task-due');

    function resetEditorTaskForm() {
      editorTaskTitle.value  = '';
      editorTaskStatus.value = 'backlog';
      editorTaskDue.value    = '';
      editorTaskForm.style.display = 'none';
    }

    async function saveEditorTask() {
      const title    = editorTaskTitle.value.trim();
      const status   = editorTaskStatus.value;
      const due_date = editorTaskDue.value || null;
      if (!title || !currentId) return;
      try {
        await api('POST', `/notes/${currentId}/tasks`, { title, status, due_date });
        resetEditorTaskForm();
        await loadEditorTasks(currentId);
      } catch (err) {
        showToast(err.message || 'Failed to add task', true);
      }
    }

    document.getElementById('btn-editor-add-task').addEventListener('click', () => {
      editorTaskForm.style.display = '';
      editorTaskTitle.focus();
    });

    document.getElementById('editor-task-add-save').addEventListener('click', saveEditorTask);
    document.getElementById('editor-task-add-cancel').addEventListener('click', resetEditorTaskForm);

    editorTaskTitle.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveEditorTask();
      if (e.key === 'Escape') resetEditorTaskForm();
    });
    editorTaskStatus.addEventListener('keydown', e => {
      if (e.key === 'Escape') resetEditorTaskForm();
    });
    editorTaskDue.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveEditorTask();
      if (e.key === 'Escape') resetEditorTaskForm();
    });

    document.getElementById('editor-tag-input').addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const name = e.target.value.trim();
      if (!name || !currentId) return;
      try {
        await api('POST', `/notes/${currentId}/tags`, { name });
        e.target.value = '';
        await loadEditorTags(currentId);
      } catch (err) {
        showToast(err.message || 'Failed to add tag', true);
      }
    });
  });

  window.loadNoteEditor = loadNoteEditor;
})();
