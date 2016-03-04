'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.S3Adapter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; // S3Adapter
//
// Stores Parse files in AWS S3.

var _awsSdk = require('aws-sdk');

var AWS = _interopRequireWildcard(_awsSdk);

var _FilesAdapter2 = require('./FilesAdapter');

var _requiredParameter = require('../../requiredParameter');

var _requiredParameter2 = _interopRequireDefault(_requiredParameter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DEFAULT_S3_REGION = "us-east-1";

function parseS3AdapterOptions() {
  for (var _len = arguments.length, options = Array(_len), _key = 0; _key < _len; _key++) {
    options[_key] = arguments[_key];
  }

  if (options.length === 1 && _typeof(options[0]) == "object") {
    return options;
  }

  var additionalOptions = options[3] || {};

  return {
    accessKey: options[0],
    secretKey: options[1],
    bucket: options[2],
    region: additionalOptions.region
  };
}

var S3Adapter = exports.S3Adapter = function (_FilesAdapter) {
  _inherits(S3Adapter, _FilesAdapter);

  // Creates an S3 session.
  // Providing AWS access and secret keys is mandatory
  // Region and bucket will use sane defaults if omitted

  function S3Adapter() {
    var accessKey = arguments.length <= 0 || arguments[0] === undefined ? (0, _requiredParameter2.default)('S3Adapter requires an accessKey') : arguments[0];
    var secretKey = arguments.length <= 1 || arguments[1] === undefined ? (0, _requiredParameter2.default)('S3Adapter requires a secretKey') : arguments[1];
    var bucket = arguments[2];

    var _ref = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

    var _ref$region = _ref.region;
    var region = _ref$region === undefined ? DEFAULT_S3_REGION : _ref$region;
    var _ref$bucketPrefix = _ref.bucketPrefix;
    var bucketPrefix = _ref$bucketPrefix === undefined ? '' : _ref$bucketPrefix;
    var _ref$directAccess = _ref.directAccess;
    var directAccess = _ref$directAccess === undefined ? false : _ref$directAccess;

    _classCallCheck(this, S3Adapter);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(S3Adapter).call(this));

    _this._region = region;
    _this._bucket = bucket;
    _this._bucketPrefix = bucketPrefix;
    _this._directAccess = directAccess;

    var s3Options = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      params: { Bucket: _this._bucket }
    };
    AWS.config._region = _this._region;
    _this._s3Client = new AWS.S3(s3Options);
    _this._hasBucket = false;
    return _this;
  }

  _createClass(S3Adapter, [{
    key: 'createBucket',
    value: function createBucket() {
      var _this2 = this;

      var promise;
      if (this._hasBucket) {
        promise = Promise.resolve();
      } else {
        promise = new Promise(function (resolve, reject) {
          _this2._s3Client.createBucket(function () {
            _this2._hasBucket = true;
            resolve();
          });
        });
      }
      return promise;
    }

    // For a given config object, filename, and data, store a file in S3
    // Returns a promise containing the S3 object creation response

  }, {
    key: 'createFile',
    value: function createFile(config, filename, data, contentType) {
      var _this3 = this;

      var params = {
        Key: this._bucketPrefix + filename,
        Body: data
      };
      if (this._directAccess) {
        params.ACL = "public-read";
      }
      if (contentType) {
        params.ContentType = contentType;
      }
      return this.createBucket().then(function () {
        return new Promise(function (resolve, reject) {
          _this3._s3Client.upload(params, function (err, data) {
            if (err !== null) {
              return reject(err);
            }
            resolve(data);
          });
        });
      });
    }
  }, {
    key: 'deleteFile',
    value: function deleteFile(config, filename) {
      var _this4 = this;

      return this.createBucket().then(function () {
        return new Promise(function (resolve, reject) {
          var params = {
            Key: _this4._bucketPrefix + filename
          };
          _this4._s3Client.deleteObject(params, function (err, data) {
            if (err !== null) {
              return reject(err);
            }
            resolve(data);
          });
        });
      });
    }

    // Search for and return a file if found by filename
    // Returns a promise that succeeds with the buffer result from S3

  }, {
    key: 'getFileData',
    value: function getFileData(config, filename) {
      var _this5 = this;

      var params = { Key: this._bucketPrefix + filename };
      return this.createBucket().then(function () {
        return new Promise(function (resolve, reject) {
          _this5._s3Client.getObject(params, function (err, data) {
            if (err !== null) {
              return reject(err);
            }
            // Something happend here...
            if (data && !data.Body) {
              return reject(data);
            }
            resolve(data.Body);
          });
        });
      });
    }

    // Generates and returns the location of a file stored in S3 for the given request and filename
    // The location is the direct S3 link if the option is set, otherwise we serve the file through parse-server

  }, {
    key: 'getFileLocation',
    value: function getFileLocation(config, filename) {
      if (this._directAccess) {
        return 'https://' + this._bucket + '.s3.amazonaws.com/' + (this._bucketPrefix + filename);
      }
      return config.mount + '/files/' + config.applicationId + '/' + encodeURIComponent(filename);
    }
  }]);

  return S3Adapter;
}(_FilesAdapter2.FilesAdapter);

exports.default = S3Adapter;