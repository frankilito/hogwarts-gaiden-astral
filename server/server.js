// 静态文件服务器 + 本地联机 WS 中继（房间制）
// 线上版走 PeerJS 云端；本服务器让局域网/本机双开也能联。
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8966;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---- WS 房间中继 ----
let WebSocketServer = null;
try { ({ WebSocketServer } = await import('ws')); } catch { console.log('[ws] 模块缺失，仅静态服务'); }
if (WebSocketServer) {
  const wss = new WebSocketServer({ server });
  const rooms = new Map(); // code -> Set<ws>
  wss.on('connection', (ws) => {
    ws.on('message', (buf) => {
      let msg; try { msg = JSON.parse(buf); } catch { return; }
      if (msg.t === 'join') {
        ws._room = msg.room;
        if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
        const set = rooms.get(msg.room);
        ws._id = msg.id || Math.random().toString(36).slice(2, 8);
        set.add(ws);
        ws.send(JSON.stringify({ t: 'joined', room: msg.room, id: ws._id, peers: set.size - 1 }));
        for (const o of set) if (o !== ws && o.readyState === 1) o.send(JSON.stringify({ t: 'peer_join', id: ws._id }));
      } else if (ws._room && rooms.has(ws._room)) {
        for (const o of rooms.get(ws._room)) if (o !== ws && o.readyState === 1) o.send(buf.toString());
      }
    });
    ws.on('close', () => {
      if (ws._room && rooms.has(ws._room)) {
        const set = rooms.get(ws._room);
        set.delete(ws);
        for (const o of set) if (o.readyState === 1) o.send(JSON.stringify({ t: 'peer_leave', id: ws._id }));
        if (!set.size) rooms.delete(ws._room);
      }
    });
  });
}

server.listen(PORT, () => console.log(`✨ 霍格沃茨之遗·番外篇  http://localhost:${PORT}`));
