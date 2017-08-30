'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {
  var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var router = _express2.default.Router();
  var prefix = opts.prefix || '';

  var handle = function handle(req, res, next) {
    var root = req.query.root || req.body.root || '';
    root || (root = '/');
    root[0] === '/' || (root = '/' + root);
    var rootUri = '/ueditor' + root;
    var imgUri = rootUri + '/image/';
    var videoUri = rootUri + '/video/';
    var fileUri = rootUri + '/file/';
    var action = req.query.action || req.body.action;
    if (action === 'uploadimage' || action === 'uploadscrawl') {
      res.ue_up(imgUri);
    } else if (action === 'catchimage') {
      res.ue_catchimage(imgUri);
    } else if (action === 'uploadvideo') {
      res.ue_up(videoUri);
    } else if (action === 'uploadfile') {
      res.ue_up(fileUri);
    } else if (action === 'listimage') {
      res.ue_list(imgUri);
    } else if (action === 'listfile') {
      res.ue_list(fileUri);
    } else {
      res.send(_ueditor2.default);
    }
  };
  router.use(prefix, ueditor(_path2.default.join(__dirname, '../uploads'), handle));
  return router;
};

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _busboy = require('busboy');

var _busboy2 = _interopRequireDefault(_busboy);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _nodeSnowflake = require('node-snowflake');

var _nodeSnowflake2 = _interopRequireDefault(_nodeSnowflake);

var _eventproxy = require('eventproxy');

var _eventproxy2 = _interopRequireDefault(_eventproxy);

var _wget = require('wget');

var _wget2 = _interopRequireDefault(_wget);

var _ueditor = require('../config/ueditor.json');

var _ueditor2 = _interopRequireDefault(_ueditor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var snowflake = _nodeSnowflake2.default.Snowflake;

var ueditor = function ueditor(rootDir, handle) {
  return function (req, res, next) {
    var _respond = respond(rootDir, handle);
    _respond(req, res, next);
  };
};
var respond = function respond(rootDir, callback) {
  return function (req, res, next) {
    var action = req.query.action;
    if (action === 'config') {
      callback(req, res, next);
    } else if (action === 'listimage' || action === 'listfile') {
      res.ue_list = function (listUri) {
        var i = 0;
        var list = [];
        var size = req.query.size;
        var start = req.query.start;
        var idx = 0;
        _fs2.default.readdir(rootDir + listUri, function (err, files) {
          if (err) return res.json({ state: 'ERROR' });
          var total = files.length;
          var filetype = 'jpg, jpeg, png, gif, ico, bmp';
          for (var x in files) {
            var file = files[x];
            var tmplist = file.split('.');
            var _filetype = tmplist[tmplist.length - 1];
            if (action === 'listfile' || filetype.indexOf(_filetype.toLowerCase()) >= 0) {
              if (idx < start) {
                idx++;
              } else {
                var temp = {};
                if (listUri === '/') {
                  temp.url = listUri + file;
                } else {
                  temp.url = listUri + '/' + file;
                }
                list[i] = temp;
                i++;
              }
            }
            if (i === size) break;
          }

          res.json({
            'state': 'SUCCESS',
            'list': list,
            'start': start,
            'total': total
          });
        });
      };
      callback(req, res, next);
    } else if (action === 'uploadscrawl') {
      var imageBuffer = new Buffer(req.body.upfile, 'base64');
      var name = snowflake.nextId() + '.png';
      res.ue_up = function (uri) {
        var dest = _path2.default.join(rootDir, uri, name);
        _fsExtra2.default.ensureFile(dest, function (err) {
          var r = {
            'url': uri + name,
            'original': name
          };
          if (err) {
            r.state = 'ERROR';
            res.json(r);
          } else {
            _fsExtra2.default.writeFile(dest, imageBuffer, function (err) {
              if (err) {
                r.state = 'ERROR';
              } else {
                r.state = 'SUCCESS';
              }
              res.json(r);
            });
          }
        });
      };
      callback(req, res, next);
    } else if (action === 'uploadimage' || action === 'uploadvideo' || action === 'uploadfile') {
      var busboy = new _busboy2.default({
        headers: req.headers
      });

      busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        req.ueditor = {};
        req.ueditor.fieldname = fieldname;
        req.ueditor.file = file;
        req.ueditor.filename = filename;
        req.ueditor.encoding = encoding;
        req.ueditor.mimetype = mimetype;
        var tmpdir = _path2.default.join(_os2.default.tmpDir(), _path2.default.basename(filename));
        file.pipe(_fs2.default.createWriteStream(tmpdir));

        file.on('end', function () {
          callback(req, res, next);
        });

        res.ue_up = function (uri) {
          var name = snowflake.nextId() + _path2.default.extname(tmpdir);
          var opts = {};
          if (action === 'uploadfile' || action === 'uploadvideo') {
            name = filename;
            opts.clobber = true;
          }
          var dest = _path2.default.join(rootDir, uri, name);

          _fsExtra2.default.move(tmpdir, dest, opts, function (err) {
            if (err) return res.json({ state: 'ERROR' });
            res.json({
              'url': uri + name,
              'title': req.body.pictitle,
              'original': filename,
              'state': 'SUCCESS'
            });
          });
        };
      });
      req.pipe(busboy);
    } else if (action === 'catchimage') {
      res.ue_catchimage = function (uri) {
        var source = req.body.source;
        var ep = new _eventproxy2.default();
        ep.after('got_file', source.length, function (list) {
          res.json({
            'list': list,
            'state': 'SUCCESS'
          });
          console.info(list);
        });

        _fsExtra2.default.ensureDirSync(_path2.default.join(rootDir, uri));
        source.forEach(function (src) {
          var name = snowflake.nextId() + _path2.default.extname(src);
          var dest = _path2.default.join(rootDir, uri, name);

          var r = {
            url: uri + name,
            source: src
          };

          var download = _wget2.default.download(src, dest);
          download.on('error', function (err) {
            ep.emit('got_file', r);
            console.log(err);
          });
          download.on('end', function (output) {
            r.state = 'SUCCESS';
            ep.emit('got_file', r);
          });
        });
      };
      callback(req, res, next);
    } else {
      callback(req, res, next);
    }
  };
};

module.exports = exports['default'];