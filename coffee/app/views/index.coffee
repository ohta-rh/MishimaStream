ctx = null
draw = null
IndexView = Backbone.View.extend({
  el: $("#canvas"),
  initialize: ->
    ctx = this.el.getContext('2d')
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 10
    ctx.strokeStyle = '#fff'
    draw = false
    @socket = io.connect("http://192.168.0.118:3004")
    @socket.on("connect");
    @socket.on("startdraw", this.startDraw);
    @socket.on("drawing", this.drawing);
    @socket.on("enddraw", this.endDraw);
    true
  events: {
    "mousedown": "emit1",
    "mousemove": "emit2",
    "mouseup": "emit3"
  }
  emit1: (event) ->
    @socket.emit("emit1", {x:event.layerX, y:event.layerY})
  emit2: (event) ->
    @socket.emit("emit2", {x:event.layerX, y:event.layerY})
  emit3: (event) ->
    @socket.emit("emit3", {})

  startDraw: (event) ->
    ctx.beginPath()
    ctx.moveTo(event.x, event.y)
    draw = true
  drawing: (event) ->
    if draw
      ctx.lineTo(event.x, event.y)
      ctx.stroke()
  endDraw: (event) ->
    if draw
      ctx.closePath()
      draw = false
  hoge: () ->
    alert('hoge')
})
view = new IndexView()
