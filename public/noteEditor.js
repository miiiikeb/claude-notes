'use strict';

(function () {
  let currentId  = null;
  let previewOn  = true;
  let debounceTimer;

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderPreview() {
    const src = document.getElementById('editor-textarea').value;
    document.getElementById('editor-preview').innerHTML = marked.parse(src);
  }

  function setPreviewVisible(on) {
    previewOn = on;
    document.getElementById('editor-preview-pane').style.display = on ? '' : 'none';
    document.getElementById('editor-body').classList.toggle('preview-hidden', !on);
    document.getElementById('btn-preview-toggle').textContent = on ? 'Hide preview' : 'Preview';
    if (on) renderPreview();
  }

  function populate(note) {
    document.getElementById('editor-type').value  = note.type;
    document.getElementById('editor-date').value  = note.note_date;
    document.getElementById('editor-title').value = note.title;
    document.getElementById('editor-textarea').value = note.body || '';
    renderPreview();
  }

  function reset() {
    document.getElementById('editor-type').value  = 'general';
    document.getElementById('editor-date').value  = today();
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-textarea').value = '';
    document.getElementById('editor-preview').innerHTML = '';
  }

  async function save() {
    const type      = document.getElementById('editor-type').value;
    const note_date = document.getElementById('editor-date').value;
    const title     = document.getElementById('editor-title').value.trim();
    const body      = document.getElementById('editor-textarea').value;

    if (!title) { showToast('Title is required', true); return; }

    const btn = document.getElementById('btn-editor-save');
    btn.disabled = true;
    try {
      if (currentId) {
        await api('PATCH', `/notes/${currentId}`, { type, note_date, title, body });
        showToast('Saved');
      } else {
        const note = await api('POST', '/notes', { type, note_date, title, body });
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

  async function loadEditorTags(noteId) {
    const section    = document.getElementById('editor-tags-section');
    const chipsEl    = document.getElementById('editor-tags-list');
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

  async function loadNoteEditor() {
    // Parse optional note ID from hash: #noteEditor/123
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
        await loadEditorTags(currentId);
      } catch {
        showToast('Note not found', true);
        navigate('home');
        return;
      }
    } else {
      reset();
    }

    setPreviewVisible(previewOn);
    document.getElementById('editor-title').focus();
  }

  // Wire up controls once DOM is ready — done here so handlers aren't re-added on each load
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-editor-back').addEventListener('click', () => navigate('home'));
    document.getElementById('btn-editor-save').addEventListener('click', save);
    document.getElementById('btn-editor-delete').addEventListener('click', deleteNote);
    document.getElementById('btn-preview-toggle').addEventListener('click', () => setPreviewVisible(!previewOn));

    document.getElementById('editor-textarea').addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { if (previewOn) renderPreview(); }, 200);
    });

    // Ctrl/Cmd+S to save
    document.getElementById('editor-textarea').addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
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
