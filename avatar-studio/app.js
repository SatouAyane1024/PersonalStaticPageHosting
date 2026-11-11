const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  file: $('#fileInput'), upload: $('#uploadButton'), emptyUpload: $('#emptyUploadButton'), edit: $('#editButton'),
  download: $('#downloadButton'), dialog: $('#editorDialog'), close: $('#closeButton'), cancel: $('#cancelButton'),
  apply: $('#applyButton'), reset: $('#resetButton'), zoom: $('#zoomRange'), zoomOutput: $('#zoomOutput'),
  gridToggle: $('#gridToggle'), safeToggle: $('#safeToggle'), grid: $('#gridGuide'), safe: $('#safeGuide'),
  editor: $('#editorCanvas'), wrap: $('#canvasWrap'), output: $('#outputCanvas'), empty: $('#emptyState'),
  preview: $('#previewGrid'), meta: $('#imageMeta'), toast: $('#toast')
};

const state = { image: null, fileName: '', naturalW: 0, naturalH: 0, zoom: 1, x: 0, y: 0, applied: null, pointers: new Map(), pinchDistance: 0 };
const editorCtx = els.editor.getContext('2d');
const outputCtx = els.output.getContext('2d');
let toastTimer;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function baseScale(canvasSize = els.editor.width) {
  return Math.max(canvasSize / state.naturalW, canvasSize / state.naturalH);
}

function clampPosition() {
  if (!state.image) return;
  const w = state.naturalW * baseScale() * state.zoom;
  const h = state.naturalH * baseScale() * state.zoom;
  const limitX = Math.max(0, (w - els.editor.width) / 2);
  const limitY = Math.max(0, (h - els.editor.height) / 2);
  state.x = Math.max(-limitX, Math.min(limitX, state.x));
  state.y = Math.max(-limitY, Math.min(limitY, state.y));
}

function drawEditor() {
  if (!state.image) return;
  clampPosition();
  const scale = baseScale() * state.zoom;
  const w = state.naturalW * scale;
  const h = state.naturalH * scale;
  editorCtx.clearRect(0, 0, els.editor.width, els.editor.height);
  editorCtx.drawImage(state.image, (els.editor.width - w) / 2 + state.x, (els.editor.height - h) / 2 + state.y, w, h);
  els.zoom.value = state.zoom;
  els.zoomOutput.value = `${Math.round(state.zoom * 100)}%`;
}

function drawOutput() {
  const ratio = els.output.width / els.editor.width;
  const scale = baseScale(els.editor.width) * state.zoom * ratio;
  const w = state.naturalW * scale;
  const h = state.naturalH * scale;
  outputCtx.clearRect(0, 0, els.output.width, els.output.height);
  outputCtx.drawImage(state.image, (els.output.width - w) / 2 + state.x * ratio, (els.output.height - h) / 2 + state.y * ratio, w, h);
  const url = els.output.toDataURL('image/png');
  $$('.avatar').forEach(img => img.src = url);
  els.empty.hidden = true;
  els.preview.hidden = false;
  return url;
}

function openEditor() {
  if (!state.image) return;
  state.applied = { zoom: state.zoom, x: state.x, y: state.y };
  drawEditor();
  els.dialog.showModal();
}

function closeWithoutSaving() {
  if (state.applied) Object.assign(state, state.applied);
  els.dialog.close();
}

function applyEdits() {
  drawOutput();
  state.applied = { zoom: state.zoom, x: state.x, y: state.y };
  els.dialog.close();
  showToast('Avatar updated');
}

function resetTransform() {
  state.zoom = 1; state.x = 0; state.y = 0;
  drawEditor();
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Please select a valid image file.'); return; }
  const reader = new FileReader();
  reader.onerror = () => showToast('Failed to load image, please try again.');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => showToast('Unable to open this image.');
    img.onload = () => {
      state.image = img; state.fileName = file.name; state.naturalW = img.naturalWidth; state.naturalH = img.naturalHeight;
      resetTransform();
      state.applied = { zoom: 1, x: 0, y: 0 };
      els.meta.textContent = `${file.name} · ${img.naturalWidth} × ${img.naturalHeight}`;
      els.edit.disabled = false; els.download.disabled = false;
      openEditor();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function changeZoom(next, focusX = els.editor.width / 2, focusY = els.editor.height / 2) {
  const old = state.zoom;
  state.zoom = Math.max(1, Math.min(4, next));
  const factor = state.zoom / old;
  state.x = (state.x - (focusX - els.editor.width / 2)) * factor + (focusX - els.editor.width / 2);
  state.y = (state.y - (focusY - els.editor.height / 2)) * factor + (focusY - els.editor.height / 2);
  drawEditor();
}

function canvasPoint(event) {
  const rect = els.wrap.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * els.editor.width / rect.width, y: (event.clientY - rect.top) * els.editor.height / rect.height };
}

[els.upload, els.emptyUpload].forEach(btn => btn.addEventListener('click', () => els.file.click()));
els.file.addEventListener('change', () => { loadFile(els.file.files[0]); els.file.value = ''; });
els.edit.addEventListener('click', openEditor);
els.close.addEventListener('click', closeWithoutSaving);
els.cancel.addEventListener('click', closeWithoutSaving);
els.apply.addEventListener('click', applyEdits);
els.reset.addEventListener('click', resetTransform);
els.dialog.addEventListener('cancel', e => { e.preventDefault(); closeWithoutSaving(); });
els.dialog.addEventListener('click', e => { if (e.target === els.dialog) closeWithoutSaving(); });
els.zoom.addEventListener('input', () => changeZoom(Number(els.zoom.value)));
els.gridToggle.addEventListener('change', () => els.grid.classList.toggle('is-hidden', !els.gridToggle.checked));
els.safeToggle.addEventListener('change', () => els.safe.classList.toggle('is-hidden', !els.safeToggle.checked));
els.download.addEventListener('click', () => {
  const url = drawOutput();
  const link = document.createElement('a');
  const stem = state.fileName.replace(/\.[^.]+$/, '') || 'avatar';
  link.download = `${stem}-avatar.png`; link.href = url; link.click();
  showToast('Starting download...');
});

els.wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const p = canvasPoint(e);
  changeZoom(state.zoom * (e.deltaY > 0 ? .92 : 1.08), p.x, p.y);
}, { passive: false });

els.wrap.addEventListener('pointerdown', e => {
  els.wrap.setPointerCapture(e.pointerId);
  state.pointers.set(e.pointerId, canvasPoint(e));
});
els.wrap.addEventListener('pointermove', e => {
  if (!state.pointers.has(e.pointerId)) return;
  const current = canvasPoint(e);
  const previous = state.pointers.get(e.pointerId);
  state.pointers.set(e.pointerId, current);
  const points = [...state.pointers.values()];
  if (points.length === 1) { state.x += current.x - previous.x; state.y += current.y - previous.y; drawEditor(); }
  if (points.length === 2) {
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    if (state.pinchDistance) changeZoom(state.zoom * distance / state.pinchDistance);
    state.pinchDistance = distance;
  }
});
function endPointer(e) { state.pointers.delete(e.pointerId); state.pinchDistance = 0; }
els.wrap.addEventListener('pointerup', endPointer);
els.wrap.addEventListener('pointercancel', endPointer);

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
