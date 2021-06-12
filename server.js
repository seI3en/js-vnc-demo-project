var rfb = require('rfb2'),
  port = 8090,
  express = require('express'),
  http = require('http'),  
  Png = require('fast-png'),
  clients = [];

function createRfbConnection(config, socket) {
  var r = rfb.createConnection({
    host: config.host,
    port: config.port,
    password: config.password
  });
  addEventHandlers(r, socket);
  setInterval(function(){ r.requestUpdate(false, 0, 0, r.width, r.height); }, 200);
  return r;
}

function addEventHandlers(r, socket) {
  r.on('connect', function () {
    socket.emit('init', {
      width: r.width,
      height: r.height
    });
    clients.push({
      socket: socket,
      rfb: r
    });
  });
  r.on('rect', function (rect) {
    handleFrame(socket, rect, r);
  });
}

function handleFrame(socket, rect, r) {
  var rgb = Buffer.alloc(rect.width * rect.height * 4),
    offset = 0;

  for (var i = 0; i < rect.data.length; i += 4) {
    rgb[offset] = rect.data[i + 2];
    offset += 1;
    rgb[offset] = rect.data[i + 1];
    offset += 1;
    rgb[offset] = rect.data[i];
    offset += 1;
    rgb[offset] = rect.data[i + 3];
    offset += 1;
  }
  var image = {width: rect.width, height: rect.height, data: rgb};
  image = Png.encode(image);
  socket.emit('frame', {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    image: Buffer.from(image, 'binary').toString('base64')
  });
}

function disconnectClient(socket) {
  clients.forEach(function (pair) {
    if (pair.socket === socket) {
      pair.rfb.end();
    }
  });
  clients = clients.filter(function (pair) {
    return pair.socket === socket;
  });
}

var app = express();
var server = http.createServer(app);
app.use(express.static(__dirname + '/static/'));
server.listen(port);
var socketio = require('socket.io')(server);

socketio.sockets.on('connection', function (socket) {
  socket.on('init', function (config) {
    var r = createRfbConnection(config, socket);
    socket.on('mouse', function (evnt) {
      r.pointerEvent(evnt.x, evnt.y, evnt.button);
    });
    socket.on('keyboard', function (evnt) {
      r.keyEvent(evnt.keyCode, evnt.isDown);
    });
    socket.on('disconnect', function () {
      disconnectClient(socket);
    });
  });
});

console.log('Listening on port', port);
