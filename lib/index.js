'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _ueditor = require('./ueditor');

var _ueditor2 = _interopRequireDefault(_ueditor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var app = arguments[1];

  var _router = _express2.default.Router();
  _router.use((0, _ueditor2.default)(opts));

  var self = app;
  self.on('open', function () {
    if (self.servers.http.middle) self.servers.http.middle.use(_router);
  });

  return {};
};

module.exports = exports['default'];