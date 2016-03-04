"use strict";
// ParsePushAdapter is the default implementation of
// PushAdapter, it uses GCM for android push and APNS
// for ios push.

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParsePushAdapter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _PushAdapter2 = require('./PushAdapter');

var _PushAdapter3 = _interopRequireDefault(_PushAdapter2);

var _PushAdapterUtils = require('./PushAdapterUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Parse = require('parse/node').Parse;
var GCM = require('../../GCM');
var APNS = require('../../APNS');

var ParsePushAdapter = exports.ParsePushAdapter = function (_PushAdapter) {
  _inherits(ParsePushAdapter, _PushAdapter);

  function ParsePushAdapter() {
    var pushConfig = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, ParsePushAdapter);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ParsePushAdapter).call(this, pushConfig));

    _this.validPushTypes = ['ios', 'android'];
    _this.senderMap = {};
    // used in PushController for Dashboard Features
    _this.feature = {
      immediatePush: true
    };
    var pushTypes = Object.keys(pushConfig);

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = pushTypes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var pushType = _step.value;

        if (_this.validPushTypes.indexOf(pushType) < 0) {
          throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED, 'Push to ' + pushTypes + ' is not supported');
        }
        switch (pushType) {
          case 'ios':
            _this.senderMap[pushType] = new APNS(pushConfig[pushType]);
            break;
          case 'android':
            _this.senderMap[pushType] = new GCM(pushConfig[pushType]);
            break;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return _this;
  }

  _createClass(ParsePushAdapter, [{
    key: 'getValidPushTypes',
    value: function getValidPushTypes() {
      return this.validPushTypes;
    }
  }, {
    key: 'send',
    value: function send(data, installations) {
      var deviceMap = (0, _PushAdapterUtils.classifyInstallations)(installations, this.validPushTypes);
      var sendPromises = [];
      for (var pushType in deviceMap) {
        var sender = this.senderMap[pushType];
        if (!sender) {
          console.log('Can not find sender for push type %s, %j', pushType, data);
          continue;
        }
        var devices = deviceMap[pushType];
        sendPromises.push(sender.send(data, devices));
      }
      return Parse.Promise.when(sendPromises);
    }
  }], [{
    key: 'classifyInstallations',
    value: function classifyInstallations(installations, validTypes) {
      return (0, _PushAdapterUtils.classifyInstallations)(installations, validTypes);
    }
  }]);

  return ParsePushAdapter;
}(_PushAdapter3.default);

exports.default = ParsePushAdapter;

module.exports = ParsePushAdapter;