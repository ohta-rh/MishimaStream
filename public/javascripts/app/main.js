import { io } from '/socket.io/socket.io.esm.min.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

const colorEl = document.querySelector('[data-el="color"]');
const sizeEl = document.querySelector('[data-el="size"]');
const sizeValueEl = document.querySelector('[data-el="size-value"]');
const clearBtn = document.querySelector('[data-el="clear"]');
const statusDot = document.querySelector('[data-el="status-dot"]');
const statusLabel = document.querySelector('[data-el="status-label"]');
const presenceEl = document.querySelector('[data-el="presence"]');

const local = { drawing: false, color: colorEl.value, size: Number(sizeEl.value) };
const peers = new Map();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { innerWidth: w, innerHeight: h } = window;
  const snapshot = canvas.width
    ? ctx.getImageData(0, 0, canvas.width, canvas.height)
    : null;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (snapshot) ctx.putImageData(snapshot, 0, 0);
}
resize();
window.addEventListener('resize', resize, { passive: true });

function toNorm(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) / r.width,
    y: (clientY - r.top) / r.height,
  };
}

function toPx(n) {
  const r = canvas.getBoundingClientRect();
  return { x: n.x * r.width, y: n.y * r.height };
}

function drawSegment(peer, n, color, size) {
  const p = toPx(n);
  if (!peer.active) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    peer.active = true;
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  peer.last = p;
}

function endStroke(peer) {
  peer.active = false;
  peer.last = null;
}

function getPeer(id) {
  let peer = peers.get(id);
  if (!peer) {
    peer = { active: false, last: null };
    peers.set(id, peer);
  }
  return peer;
}

// Pointer handling (covers mouse, touch, pen in one API)
canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  canvas.setPointerCapture(e.pointerId);
  local.drawing = true;
  const n = toNorm(e.clientX, e.clientY);
  const payload = { ...n, color: local.color, size: local.size };
  socket.emit('stroke:start', payload);
  drawSegment(getPeer('__self'), n, local.color, local.size);
});

canvas.addEventListener('pointermove', (e) => {
  if (!local.drawing || !e.isPrimary) return;
  // coalesced events for smoother lines
  const events = e.getCoalescedEvents?.() ?? [e];
  for (const ev of events) {
    const n = toNorm(ev.clientX, ev.clientY);
    const payload = { ...n, color: local.color, size: local.size };
    socket.emit('stroke:move', payload);
    drawSegment(getPeer('__self'), n, local.color, local.size);
  }
});

const finish = (e) => {
  if (!local.drawing) return;
  local.drawing = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
  socket.emit('stroke:end');
  endStroke(getPeer('__self'));
};
canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);
canvas.addEventListener('pointerleave', finish);

// Prevent scroll/zoom while drawing on touch devices
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// Tool bindings
colorEl.addEventListener('input', (e) => { local.color = e.target.value; });
sizeEl.addEventListener('input', (e) => {
  local.size = Number(e.target.value);
  sizeValueEl.textContent = e.target.value;
});
clearBtn.addEventListener('click', () => {
  if (confirm('キャンバスを全消去しますか？')) socket.emit('canvas:clear');
});

// Keyboard: C to clear, [ / ] to change size
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'c' || e.key === 'C') clearBtn.click();
  if (e.key === '[') sizeEl.stepDown(), sizeEl.dispatchEvent(new Event('input'));
  if (e.key === ']') sizeEl.stepUp(), sizeEl.dispatchEvent(new Event('input'));
});

// Socket.IO
const socket = io({ transports: ['websocket', 'polling'] });

const setStatus = (connected) => {
  statusDot.classList.toggle('dot--online', connected);
  statusDot.classList.toggle('dot--offline', !connected);
  statusLabel.textContent = connected ? '接続中' : '切断';
};

socket.on('connect', () => setStatus(true));
socket.on('disconnect', () => setStatus(false));
socket.on('reconnect_attempt', () => (statusLabel.textContent = '再接続中…'));

socket.on('presence', ({ count }) => {
  presenceEl.textContent = String(count);
});

socket.on('history', (events) => {
  for (const ev of events) applyRemote(ev);
});

socket.on('stroke:start', applyRemote);
socket.on('stroke:move', applyRemote);
socket.on('stroke:end', applyRemote);
socket.on('canvas:clear', () => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  peers.clear();
});

function applyRemote(ev) {
  if (!ev) return;
  const peer = getPeer(ev.id ?? 'unknown');
  if (ev.type === 'start') {
    peer.active = false;
    drawSegment(peer, { x: ev.x, y: ev.y }, ev.color, ev.size);
  } else if (ev.type === 'move') {
    drawSegment(peer, { x: ev.x, y: ev.y }, ev.color, ev.size);
  } else if (ev.type === 'end') {
    endStroke(peer);
  }
}
