
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , ejs = require('ejs');

var app = express();
app.configure(function(){
  app.set('port', process.env.PORT || 3004);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);

var server = http.createServer(app);
var socketIO = require("socket.io");

server.listen(app.get('port'));

var io = socketIO.listen(server);

io.sockets.on("connection", function (socket) {
  socket.on("emit1", function (data) {
    io.sockets.emit("startdraw", {x: data.x, y: data.y});
  });
  socket.on("emit2", function (data) {
    io.sockets.emit("drawing", {x: data.x, y: data.y});
  });
  socket.on("emit3", function (data) {
    io.sockets.emit("enddraw", {});
  });
});
