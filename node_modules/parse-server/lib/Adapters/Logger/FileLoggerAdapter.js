'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileLoggerAdapter = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _LoggerAdapter2 = require('./LoggerAdapter');

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _node = require('parse/node');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // Logger
//
// Wrapper around Winston logging library with custom query
//
// expected log entry to be in the shape of:
// {"level":"info","message":"Your Message","timestamp":"2016-02-04T05:59:27.412Z"}
//


var MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;
var CACHE_TIME = 1000 * 60;

var LOGS_FOLDER = './logs/';

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  LOGS_FOLDER = './test_logs/';
}

var currentDate = new Date();

var simpleCache = {
  timestamp: null,
  from: null,
  until: null,
  order: null,
  data: [],
  level: 'info'
};

// returns Date object rounded to nearest day
var _getNearestDay = function _getNearestDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

// returns Date object of previous day
var _getPrevDay = function _getPrevDay(date) {
  return new Date(date - MILLISECONDS_IN_A_DAY);
};

// returns the iso formatted file name
var _getFileName = function _getFileName() {
  return _getNearestDay(currentDate).toISOString();
};

// check for valid cache when both from and util match.
// cache valid for up to 1 minute
var _hasValidCache = function _hasValidCache(from, until, level) {
  if (String(from) === String(simpleCache.from) && String(until) === String(simpleCache.until) && new Date() - simpleCache.timestamp < CACHE_TIME && level === simpleCache.level) {
    return true;
  }
  return false;
};

// renews transports to current date
var _renewTransports = function _renewTransports(_ref) {
  var infoLogger = _ref.infoLogger;
  var errorLogger = _ref.errorLogger;
  var logsFolder = _ref.logsFolder;

  if (infoLogger) {
    infoLogger.add(_winston2.default.transports.File, {
      filename: logsFolder + _getFileName() + '.info',
      name: 'info-file',
      level: 'info'
    });
  }
  if (errorLogger) {
    errorLogger.add(_winston2.default.transports.File, {
      filename: logsFolder + _getFileName() + '.error',
      name: 'error-file',
      level: 'error'
    });
  }
};

// check that log entry has valid time stamp based on query
var _isValidLogEntry = function _isValidLogEntry(from, until, entry) {
  var _entry = JSON.parse(entry),
      timestamp = new Date(_entry.timestamp);
  return timestamp >= from && timestamp <= until ? true : false;
};

// ensure that file name is up to date
var _verifyTransports = function _verifyTransports(_ref2) {
  var infoLogger = _ref2.infoLogger;
  var errorLogger = _ref2.errorLogger;
  var logsFolder = _ref2.logsFolder;

  if (_getNearestDay(currentDate) !== _getNearestDay(new Date())) {
    currentDate = new Date();
    if (infoLogger) {
      infoLogger.remove('info-file');
    }
    if (errorLogger) {
      errorLogger.remove('error-file');
    }
    _renewTransports({ infoLogger: infoLogger, errorLogger: errorLogger, logsFolder: logsFolder });
  }
};

var FileLoggerAdapter = exports.FileLoggerAdapter = function (_LoggerAdapter) {
  _inherits(FileLoggerAdapter, _LoggerAdapter);

  function FileLoggerAdapter() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, FileLoggerAdapter);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(FileLoggerAdapter).call(this));

    _this._logsFolder = options.logsFolder || LOGS_FOLDER;

    // check logs folder exists
    if (!_fs2.default.existsSync(_this._logsFolder)) {
      _fs2.default.mkdirSync(_this._logsFolder);
    }

    _this._errorLogger = new _winston2.default.Logger({
      exitOnError: false,
      transports: [new _winston2.default.transports.File({
        filename: _this._logsFolder + _getFileName() + '.error',
        name: 'error-file',
        level: 'error'
      })]
    });

    _this._infoLogger = new _winston2.default.Logger({
      exitOnError: false,
      transports: [new _winston2.default.transports.File({
        filename: _this._logsFolder + _getFileName() + '.info',
        name: 'info-file',
        level: 'info'
      })]
    });
    return _this;
  }

  _createClass(FileLoggerAdapter, [{
    key: 'info',
    value: function info() {
      _verifyTransports({ infoLogger: this._infoLogger, logsFolder: this._logsFolder });
      return this._infoLogger.info.apply(undefined, arguments);
    }
  }, {
    key: 'error',
    value: function error() {
      _verifyTransports({ errorLogger: this._errorLogger, logsFolder: this._logsFolder });
      return this._errorLogger.error.apply(undefined, arguments);
    }

    // custom query as winston is currently limited

  }, {
    key: 'query',
    value: function query(options, callback) {
      if (!options) {
        options = {};
      }
      // defaults to 7 days prior
      var from = options.from || new Date(Date.now() - 7 * MILLISECONDS_IN_A_DAY);
      var until = options.until || new Date();
      var size = options.size || 10;
      var order = options.order || 'desc';
      var level = options.level || 'info';
      var roundedUntil = _getNearestDay(until);
      var roundedFrom = _getNearestDay(from);

      if (_hasValidCache(roundedFrom, roundedUntil, level)) {
        var _ret = function () {
          var logs = [];
          if (order !== simpleCache.order) {
            // reverse order of data
            simpleCache.data.forEach(function (entry) {
              logs.unshift(entry);
            });
          } else {
            logs = simpleCache.data;
          }
          callback(logs.slice(0, size));
          return {
            v: undefined
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }

      var curDate = roundedUntil;
      var curSize = 0;
      var method = order === 'desc' ? 'push' : 'unshift';
      var files = [];
      var promises = [];

      // current a batch call, all files with valid dates are read
      while (curDate >= from) {
        files[method](this._logsFolder + curDate.toISOString() + '.' + level);
        curDate = _getPrevDay(curDate);
      }

      // read each file and split based on newline char.
      // limitation is message cannot contain newline
      // TODO: strip out delimiter from logged message
      files.forEach(function (file, i) {
        var promise = new _node.Parse.Promise();
        _fs2.default.readFile(file, 'utf8', function (err, data) {
          if (err) {
            promise.resolve([]);
          } else {
            var results = data.split('\n').filter(function (value) {
              return value.trim() !== '';
            });
            promise.resolve(results);
          }
        });
        promises[method](promise);
      });

      _node.Parse.Promise.when(promises).then(function (results) {
        var logs = [];
        results.forEach(function (logEntries, i) {
          logEntries.forEach(function (entry) {
            if (_isValidLogEntry(from, until, entry)) {
              logs[method](JSON.parse(entry));
            }
          });
        });
        simpleCache = {
          timestamp: new Date(),
          from: roundedFrom,
          until: roundedUntil,
          data: logs,
          order: order,
          level: level
        };
        callback(logs.slice(0, size));
      });
    }
  }]);

  return FileLoggerAdapter;
}(_LoggerAdapter2.LoggerAdapter);

exports.default = FileLoggerAdapter;