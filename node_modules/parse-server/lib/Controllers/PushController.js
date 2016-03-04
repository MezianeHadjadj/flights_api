'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PushController = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _node = require('parse/node');

var _PromiseRouter = require('../PromiseRouter');

var _PromiseRouter2 = _interopRequireDefault(_PromiseRouter);

var _rest = require('../rest');

var _rest2 = _interopRequireDefault(_rest);

var _AdaptableController2 = require('./AdaptableController');

var _AdaptableController3 = _interopRequireDefault(_AdaptableController2);

var _PushAdapter = require('../Adapters/Push/PushAdapter');

var _deepcopy = require('deepcopy');

var _deepcopy2 = _interopRequireDefault(_deepcopy);

var _features = require('../features');

var _features2 = _interopRequireDefault(_features);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var FEATURE_NAME = 'push';
var UNSUPPORTED_BADGE_KEY = "unsupported";

var PushController = exports.PushController = function (_AdaptableController) {
  _inherits(PushController, _AdaptableController);

  function PushController() {
    _classCallCheck(this, PushController);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(PushController).apply(this, arguments));
  }

  _createClass(PushController, [{
    key: 'setFeature',
    value: function setFeature() {
      _features2.default.setFeature(FEATURE_NAME, this.adapter.feature || {});
    }

    /**
     * Check whether the deviceType parameter in qury condition is valid or not.
     * @param {Object} where A query condition
     * @param {Array} validPushTypes An array of valid push types(string)
     */

  }, {
    key: 'sendPush',
    value: function sendPush() {
      var body = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      var where = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var config = arguments[2];
      var auth = arguments[3];

      var pushAdapter = this.adapter;
      if (!pushAdapter) {
        throw new _node.Parse.Error(_node.Parse.Error.PUSH_MISCONFIGURED, 'Push adapter is not available');
      }
      PushController.validateMasterKey(auth);
      PushController.validatePushType(where, pushAdapter.getValidPushTypes());
      // Replace the expiration_time with a valid Unix epoch milliseconds time
      body['expiration_time'] = PushController.getExpirationTime(body);
      // TODO: If the req can pass the checking, we return immediately instead of waiting
      // pushes to be sent. We probably change this behaviour in the future.
      var badgeUpdate = Promise.resolve();

      if (body.badge) {
        var op;

        (function () {
          op = {};

          if (body.badge == "Increment") {
            op = { '$inc': { 'badge': 1 } };
          } else if (Number(body.badge)) {
            op = { '$set': { 'badge': body.badge } };
          } else {
            throw "Invalid value for badge, expected number or 'Increment'";
          }
          var updateWhere = (0, _deepcopy2.default)(where);

          // Only on iOS!
          updateWhere.deviceType = 'ios';

          // TODO: @nlutsenko replace with better thing
          badgeUpdate = config.database.rawCollection("_Installation").then(function (coll) {
            return coll.update(updateWhere, op, { multi: true });
          });
        })();
      }

      return badgeUpdate.then(function () {
        return _rest2.default.find(config, auth, '_Installation', where);
      }).then(function (response) {
        if (body.badge && body.badge == "Increment") {
          var _ret2 = function () {
            // Collect the badges to reduce the # of calls
            var badgeInstallationsMap = response.results.reduce(function (map, installation) {
              var badge = installation.badge;
              if (installation.deviceType != "ios") {
                badge = UNSUPPORTED_BADGE_KEY;
              }
              map[badge] = map[badge] || [];
              map[badge].push(installation);
              return map;
            }, {});

            // Map the on the badges count and return the send result
            var promises = Object.keys(badgeInstallationsMap).map(function (badge) {
              var payload = (0, _deepcopy2.default)(body);
              if (badge == UNSUPPORTED_BADGE_KEY) {
                delete payload.badge;
              } else {
                payload.badge = parseInt(badge);
              }
              return pushAdapter.send(payload, badgeInstallationsMap[badge]);
            });
            return {
              v: Promise.all(promises)
            };
          }();

          if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
        }
        return pushAdapter.send(body, response.results);
      });
    }

    /**
     * Get expiration time from the request body.
     * @param {Object} request A request object
     * @returns {Number|undefined} The expiration time if it exists in the request
     */

  }, {
    key: 'expectedAdapterType',
    value: function expectedAdapterType() {
      return _PushAdapter.PushAdapter;
    }
  }], [{
    key: 'validatePushType',
    value: function validatePushType() {
      var where = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      var validPushTypes = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

      var deviceTypeField = where.deviceType || {};
      var deviceTypes = [];
      if (typeof deviceTypeField === 'string') {
        deviceTypes.push(deviceTypeField);
      } else if (typeof deviceTypeField['$in'] === 'array') {
        deviceTypes.concat(deviceTypeField['$in']);
      }
      for (var i = 0; i < deviceTypes.length; i++) {
        var deviceType = deviceTypes[i];
        if (validPushTypes.indexOf(deviceType) < 0) {
          throw new _node.Parse.Error(_node.Parse.Error.PUSH_MISCONFIGURED, deviceType + ' is not supported push type.');
        }
      }
    }

    /**
     * Check whether the api call has master key or not.
     * @param {Object} request A request object
     */

  }, {
    key: 'validateMasterKey',
    value: function validateMasterKey() {
      var auth = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      if (!auth.isMaster) {
        throw new _node.Parse.Error(_node.Parse.Error.PUSH_MISCONFIGURED, 'Master key is invalid, you should only use master key to send push');
      }
    }
  }, {
    key: 'getExpirationTime',
    value: function getExpirationTime() {
      var body = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var hasExpirationTime = !!body['expiration_time'];
      if (!hasExpirationTime) {
        return;
      }
      var expirationTimeParam = body['expiration_time'];
      var expirationTime;
      if (typeof expirationTimeParam === 'number') {
        expirationTime = new Date(expirationTimeParam * 1000);
      } else if (typeof expirationTimeParam === 'string') {
        expirationTime = new Date(expirationTimeParam);
      } else {
        throw new _node.Parse.Error(_node.Parse.Error.PUSH_MISCONFIGURED, body['expiration_time'] + ' is not valid time.');
      }
      // Check expirationTime is valid or not, if it is not valid, expirationTime is NaN
      if (!isFinite(expirationTime)) {
        throw new _node.Parse.Error(_node.Parse.Error.PUSH_MISCONFIGURED, body['expiration_time'] + ' is not valid time.');
      }
      return expirationTime.valueOf();
    }
  }]);

  return PushController;
}(_AdaptableController3.default);

;

exports.default = PushController;