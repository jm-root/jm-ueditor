import express from 'express'
import ueditor from './ueditor'

export default (opts = {}, app) => {
  let _router = express.Router()
  _router.use(ueditor(opts))

  let self = app
  self.on('open', function () {
    if (self.servers.http.middle) self.servers.http.middle.use(_router)
  })

  return {}
}
