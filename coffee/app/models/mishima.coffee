MishimaImage = Backbone.Model.extend({
  get_stream: () ->
    []
})

MishimaVideo = Backbone.Model.extend({
  get_stream: () ->
    []
})

MishimaStream = Backbone.Collection({
  initialize: () ->
    stream =  []
    MishimaImage.get_stream.each((image) ->
      return item.to_json
    )
    MishimaVideo.get_stream.each((item) ->
      return item.to_json
    )
})
