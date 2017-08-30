import express from 'express'
import path from 'path'
import Busboy from 'busboy'
import fs from 'fs'
import fse from 'fs-extra'
import os from 'os'
import Snowflake from 'node-snowflake'
import EventProxy from 'eventproxy'
import wget from 'wget'
import ueditorConfig from '../config/ueditor.json'

let snowflake = Snowflake.Snowflake

let ueditor = function (rootDir, handle) {
  return function (req, res, next) {
    let _respond = respond(rootDir, handle)
    _respond(req, res, next)
  }
}
let respond = function (rootDir, callback) {
  return function (req, res, next) {
    let action = req.query.action
    if (action === 'config') {
      callback(req, res, next)
    } else if (action === 'listimage' || action === 'listfile') {
      res.ue_list = function (listUri) {
        let i = 0
        let list = []
        let size = req.query.size
        let start = req.query.start
        let idx = 0
        fs.readdir(rootDir + listUri, function (err, files) {
          if (err) return res.json({state: 'ERROR'})
          let total = files.length
          let filetype = 'jpg, jpeg, png, gif, ico, bmp'
          for (let x in files) {
            let file = files[x]
            let tmplist = file.split('.')
            let _filetype = tmplist[tmplist.length - 1]
            if (action === 'listfile' || filetype.indexOf(_filetype.toLowerCase()) >= 0) {
              if (idx < start) {
                idx++
              } else {
                let temp = {}
                if (listUri === '/') {
                  temp.url = listUri + file
                } else {
                  temp.url = listUri + '/' + file
                }
                list[i] = (temp)
                i++
              }
            }
            if (i === size) break
          }

          res.json({
            'state': 'SUCCESS',
            'list': list,
            'start': start,
            'total': total
          })
        })
      }
      callback(req, res, next)
    } else if (action === 'uploadscrawl') {
      let imageBuffer = new Buffer(req.body.upfile, 'base64')
      let name = snowflake.nextId() + '.png'
      res.ue_up = function (uri) {
        let dest = path.join(rootDir, uri, name)
        fse.ensureFile(dest, function (err) {
          let r = {
            'url': uri + name,
            'original': name
          }
          if (err) {
            r.state = 'ERROR'
            res.json(r)
          } else {
            fse.writeFile(dest, imageBuffer, function (err) {
              if (err) {
                r.state = 'ERROR'
              } else {
                r.state = 'SUCCESS'
              }
              res.json(r)
            })
          }
        })
      }
      callback(req, res, next)
    } else if (action === 'uploadimage' || action === 'uploadvideo' || action === 'uploadfile') {
      let busboy = new Busboy({
        headers: req.headers
      })

      busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        req.ueditor = {}
        req.ueditor.fieldname = fieldname
        req.ueditor.file = file
        req.ueditor.filename = filename
        req.ueditor.encoding = encoding
        req.ueditor.mimetype = mimetype
        let tmpdir = path.join(os.tmpDir(), path.basename(filename))
        file.pipe(fs.createWriteStream(tmpdir))

        file.on('end', function () {
          callback(req, res, next)
        })

        res.ue_up = function (uri) {
          let name = snowflake.nextId() + path.extname(tmpdir)
          let opts = {}
          if (action === 'uploadfile' || action === 'uploadvideo') {
            name = filename
            opts.clobber = true
          }
          let dest = path.join(rootDir, uri, name)

          fse.move(tmpdir, dest, opts, function (err) {
            if (err) return res.json({state: 'ERROR'})
            res.json({
              'url': uri + name,
              'title': req.body.pictitle,
              'original': filename,
              'state': 'SUCCESS'
            })
          })
        }
      })
      req.pipe(busboy)
    } else if (action === 'catchimage') {
      res.ue_catchimage = function (uri) {
        let source = req.body.source
        let ep = new EventProxy()
        ep.after('got_file', source.length, function (list) {
          res.json({
            'list': list,
            'state': 'SUCCESS'
          })
          console.info(list)
        })

        fse.ensureDirSync(path.join(rootDir, uri))
        source.forEach(function (src) {
          let name = snowflake.nextId() + path.extname(src)
          let dest = path.join(rootDir, uri, name)

          let r = {
            url: uri + name,
            source: src
          }

          let download = wget.download(src, dest)
          download.on('error', function (err) {
            ep.emit('got_file', r)
            console.log(err)
          })
          download.on('end', function (output) {
            r.state = 'SUCCESS'
            ep.emit('got_file', r)
          })
        })
      }
      callback(req, res, next)
    } else {
      callback(req, res, next)
    }
  }
}

export default function (opts = {}) {
  let router = express.Router()
  let prefix = opts.prefix || ''

  let handle = function (req, res, next) {
    let root = req.query.root || req.body.root || ''
    root || (root = '/')
    root[0] === '/' || (root = '/' + root)
    let rootUri = '/ueditor' + root
    let imgUri = rootUri + '/image/'
    let videoUri = rootUri + '/video/'
    let fileUri = rootUri + '/file/'
    let action = req.query.action || req.body.action
    if (action === 'uploadimage' || action === 'uploadscrawl') {
      res.ue_up(imgUri)
    } else if (action === 'catchimage') {
      res.ue_catchimage(imgUri)
    } else if (action === 'uploadvideo') {
      res.ue_up(videoUri)
    } else if (action === 'uploadfile') {
      res.ue_up(fileUri)
    } else if (action === 'listimage') {
      res.ue_list(imgUri)
    } else if (action === 'listfile') {
      res.ue_list(fileUri)
    } else {
      res.send(ueditorConfig)
    }
  }
  router.use(prefix, ueditor(path.join(__dirname, '../uploads'), handle))
  return router
}
