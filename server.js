const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

const wss = new WebSocket.Server({ server });

let p1 = null;
let p2 = null;

let s1 = [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}];
let d1 = {x: 1, y: 0};
let nd1 = {x: 1, y: 0};
let sc1 = 0;

let s2 = [{x: 14, y: 12}, {x: 15, y: 12}, {x: 16, y: 12}];
let d2 = {x: -1, y: 0};
let nd2 = {x: -1, y: 0};
let sc2 = 0;

let food = {x: 10, y: 8};
let isGameOver = 0;

function resetGame() {
  s1 = [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}];
  d1 = {x: 1, y: 0};
  nd1 = {x: 1, y: 0};
  sc1 = 0;
  s2 = [{x: 14, y: 12}, {x: 15, y: 12}, {x: 16, y: 12}];
  d2 = {x: -1, y: 0};
  nd2 = {x: -1, y: 0};
  sc2 = 0;
  food = {x: 10, y: 8};
  isGameOver = 0;
}

function spawnFood() {
  food.x = Math.floor(Math.random() * 20);
  food.y = Math.floor(Math.random() * 13) + 2;
}

function gameTick() {
  if (!p1 || !p2) return;
  if (isGameOver) return;

  d1 = nd1;
  d2 = nd2;

  let h1 = {x: s1[0].x + d1.x, y: s1[0].y + d1.y};
  let h2 = {x: s2[0].x + d2.x, y: s2[0].y + d2.y};

  if (h1.x < 0 || h1.x >= 20 || h1.y < 2 || h1.y >= 15) isGameOver = 1;
  if (h2.x < 0 || h2.x >= 20 || h2.y < 2 || h2.y >= 15) isGameOver = 1;

  for (let p of s1) {
    if (p.x === h1.x && p.y === h1.y) isGameOver = 1;
    if (p.x === h2.x && p.y === h2.y) isGameOver = 1;
  }

  for (let p of s2) {
    if (p.x === h1.x && p.y === h1.y) isGameOver = 1;
    if (p.x === h2.x && p.y === h2.y) isGameOver = 1;
  }

  if (h1.x === h2.x && h1.y === h2.y) isGameOver = 1;

  if (!isGameOver) {
    s1.unshift(h1);
    if (h1.x === food.x && h1.y === food.y) {
      sc1 += 10;
      spawnFood();
    } else {
      s1.pop();
    }

    s2.unshift(h2);
    if (h2.x === food.x && h2.y === food.y) {
      sc2 += 10;
      spawnFood();
    } else {
      s2.pop();
    }
  }

  let parts = ['S', food.x, food.y, sc1, sc2, isGameOver, s1.length];
  for (let p of s1) parts.push(p.x, p.y);
  parts.push(s2.length);
  for (let p of s2) parts.push(p.x, p.y);

  let payload = parts.join(' ');
  broadcast(payload);
}

function broadcast(msg) {
  if (p1 && p1.readyState === WebSocket.OPEN) p1.send(msg);
  if (p2 && p2.readyState === WebSocket.OPEN) p2.send(msg);
}

wss.on('connection', (ws) => {
  let role = 0;
  if (!p1) {
    p1 = ws;
    role = 1;
    ws.send('R1');
  } else if (!p2) {
    p2 = ws;
    role = 2;
    ws.send('R2');
    resetGame();
  } else {
    ws.close();
    return;
  }

  ws.on('message', (msg) => {
    let m = msg.toString().trim();
    if (role === 1) {
      if (m === 'U' && d1.y === 0) nd1 = {x: 0, y: -1};
      if (m === 'D' && d1.y === 0) nd1 = {x: 0, y: 1};
      if (m === 'L' && d1.x === 0) nd1 = {x: -1, y: 0};
      if (m === 'R' && d1.x === 0) nd1 = {x: 1, y: 0};
    } else if (role === 2) {
      if (m === 'U' && d2.y === 0) nd2 = {x: 0, y: -1};
      if (m === 'D' && d2.y === 0) nd2 = {x: 0, y: 1};
      if (m === 'L' && d2.x === 0) nd2 = {x: -1, y: 0};
      if (m === 'R' && d2.x === 0) nd2 = {x: 1, y: 0};
    }
  });

  ws.on('close', () => {
    if (ws === p1) p1 = null;
    if (ws === p2) p2 = null;
    isGameOver = 1;
  });
});

setInterval(gameTick, 150);

const PORT = process.env.PORT || 10000;
server.listen(PORT);
