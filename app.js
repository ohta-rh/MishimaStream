import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3004;

const app = express();
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(
  express.static(join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true,
  }),
);

app.get('/', (_req, res) => {
  res.render('index', { title: 'Mishima Stream' });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  pingInterval: 20_000,
  pingTimeout: 25_000,
});

const MAX_HISTORY = 2048;
const history = [];
const appendHistory = (event) => {
  history.push(event);
  if (history.length > MAX_HISTORY) history.shift();
};

io.on('connection', (socket) => {
  socket.emit('history', history);
  io.emit('presence', { count: io.engine.clientsCount });

  socket.on('stroke:start', (p) => {
    const event = { type: 'start', ...sanitizePoint(p), id: socket.id };
    appendHistory(event);
    socket.broadcast.emit('stroke:start', event);
  });

  socket.on('stroke:move', (p) => {
    const event = { type: 'move', ...sanitizePoint(p), id: socket.id };
    appendHistory(event);
    socket.broadcast.emit('stroke:move', event);
  });

  socket.on('stroke:end', () => {
    const event = { type: 'end', id: socket.id };
    appendHistory(event);
    socket.broadcast.emit('stroke:end', event);
  });

  socket.on('canvas:clear', () => {
    history.length = 0;
    io.emit('canvas:clear');
  });

  socket.on('disconnect', () => {
    io.emit('presence', { count: io.engine.clientsCount });
  });
});

function sanitizePoint(p) {
  const n = (v, fallback = 0) =>
    Number.isFinite(v) ? Math.max(-1, Math.min(1, Number(v))) : fallback;
  return {
    x: n(p?.x),
    y: n(p?.y),
    color: typeof p?.color === 'string' ? p.color.slice(0, 32) : '#ffffff',
    size: Number.isFinite(p?.size) ? Math.max(1, Math.min(64, Number(p.size))) : 6,
  };
}

server.listen(PORT, () => {
  console.log(`Mishima Stream listening on http://localhost:${PORT}`);
});
