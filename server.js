const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

const wss = new WebSocket.Server({ server });

const rooms = {};

function generateId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function createRoomState() {
  return {
    p1: null,
    p2: null,
    name1: '',
    name2: '',
    s1: [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}],
    d1: {x: 1, y: 0},
    nd1: {x: 1, y: 0},
    sc1: 0,
    s2: [{x: 14, y: 12}, {x: 15, y: 12}, {x: 16, y: 12}],
    d2: {x: -1, y: 0},
    nd2: {x: -1, y: 0},
    sc2: 0,
    food: {x: 10, y: 8},
    isGameOver: 0,
    interval: null
  };
}

function resetGame(room) {
  room.s1 = [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}];
  room.d1 = {x: 1, y: 0};
  room.nd1 = {x: 1, y: 0};
  room.sc1 = 0;
  room.s2 = [{x: 14, y: 12}, {x: 15, y: 12}, {x: 16, y: 12}];
  room.d2 = {x: -1, y: 0};
  room.nd2 = {x: -1, y: 0};
  room.sc2 = 0;
  room.food = {x: 10, y: 8};
  room.isGameOver = 0;
}

function spawnFood(room) {
  room.food.x = Math.floor(Math.random() * 20);
  room.food.y = Math.floor(Math.random() * 13) + 2;
}

function gameTick(roomId) {
  const room = rooms[roomId];
  if (!room || !room.p1 || !room.p2) return;
  if (room.isGameOver) return;

  room.d1 = room.nd1;
  room.d2 = room.nd2;

  let h1 = {x: room.s1[0].x + room.d1.x, y: room.s1[0].y + room.d1.y};
  let h2 = {x: room.s2[0].x + room.d2.x, y: room.s2[0].y + room.d2.y};

  if (h1.x < 0 || h1.x >= 20 || h1.y < 2 || h1.y >= 15) room.isGameOver = 1;
  if (h2.x < 0 || h2.x >= 20 || h2.y < 2 || h2.y >= 15) room.isGameOver = 1;

  for (let p of room.s1) {
    if (p.x === h1.x && p.y === h1.y) room.isGameOver = 1;
    if (p.x === h2.x && p.y === h2.y) room.isGameOver = 1;
  }

  for (let p of room.s2) {
    if (p.x === h1.x && p.y === h1.y) room.isGameOver = 1;
    if (p.x === h2.x && p.y === h2.y) room.isGameOver = 1;
  }

  if (h1.x === h2.x && h1.y === h2.y) room.isGameOver = 1;

  if (!room.isGameOver) {
    room.s1.unshift(h1);
    if (h1.x === room.food.x && h1.y === room.food.y) {
      room.sc1 += 10;
      spawnFood(room);
    } else {
      room.s1.pop();
    }

    room.s2.unshift(h2);
    if (h2.x === room.food.x && h2.y === room.food.y) {
      room.sc2 += 10;
      spawnFood(room);
    } else {
      room.s2.pop();
    }
  }

  let parts = ['S', room.food.x, room.food.y, room.sc1, room.sc2, room.isGameOver, room.s1.length];
  for (let p of room.s1) parts.push(p.x, p.y);
  parts.push(room.s2.length);
  for (let p of room.s2) parts.push(p.x, p.y);

  let payload = parts.join(' ');
  broadcast(room, payload);
}

function broadcast(room, msg) {
  if (room.p1 && room.p1.readyState === WebSocket.OPEN) room.p1.send(msg);
  if (room.p2 && room.p2.readyState === WebSocket.OPEN) room.p2.send(msg);
}

function sendRoomList(ws) {
  let list = ['ROOMS'];
  for (let rId in rooms) {
    if (!rooms[rId].p2) {
      list.push(rId);
    }
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(list.join(' '));
  }
}

wss.on('connection', (ws) => {
  ws.playerName = "P" + Math.floor(100 + Math.random() * 900);
  ws.currentRoom = null;
  ws.role = 0;

  sendRoomList(ws);

  ws.on('message', (msg) => {
    let m = msg.toString().trim();
    let parts = m.split(' ');
    let cmd = parts[0];

    if (cmd === 'LIST') {
      sendRoomList(ws);
    } else if (cmd === 'CREATE') {
      let rId = generateId();
      rooms[rId] = createRoomState();
      rooms[rId].p1 = ws;
      rooms[rId].name1 = ws.playerName;
      ws.currentRoom = rId;
      ws.role = 1;
      ws.send('JOINED ' + rId + ' 1 ' + ws.playerName);
      rooms[rId].interval = setInterval(() => gameTick(rId), 150);
    } else if (cmd === 'JOIN') {
      let rId = parts[1];
      if (rooms[rId] && !rooms[rId].p2) {
        rooms[rId].p2 = ws;
        rooms[rId].name2 = ws.playerName;
        ws.currentRoom = rId;
        ws.role = 2;
        ws.send('JOINED ' + rId + ' 2 ' + ws.playerName);
        resetGame(rooms[rId]);
      } else {
        ws.send('ERROR_FULL');
      }
    } else if (ws.currentRoom && rooms[ws.currentRoom]) {
      let room = rooms[ws.currentRoom];
      if (ws.role === 1) {
        if (m === 'U' && room.d1.y === 0) room.nd1 = {x: 0, y: -1};
        if (m === 'D' && room.d1.y === 0) room.nd1 = {x: 0, y: 1};
        if (m === 'L' && room.d1.x === 0) room.nd1 = {x: -1, y: 0};
        if (m === 'R' && room.d1.x === 0) room.nd1 = {x: 1, y: 0};
      } else if (ws.role === 2) {
        if (m === 'U' && room.d2.y === 0) room.nd2 = {x: 0, y: -1};
        if (m === 'D' && room.d2.y === 0) room.nd2 = {x: 0, y: 1};
        if (m === 'L' && room.d2.x === 0) room.nd2 = {x: -1, y: 0};
        if (m === 'R' && room.d2.x === 0) room.nd2 = {x: 1, y: 0};
      }
    }
  });

  ws.on('close', () => {
    if (ws.currentRoom && rooms[ws.currentRoom]) {
      let room = rooms[ws.currentRoom];
      if (room.interval) clearInterval(room.interval);
      delete rooms[ws.currentRoom];
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT);
