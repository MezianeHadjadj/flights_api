'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PushRouter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _PushController = require('../Controllers/PushController');

var _PushController2 = _interopRequireDefault(_PushController);

var _PromiseRouter2 = require('../PromiseRouter');

var _PromiseRouter3 = _interopRequireDefault(_PromiseRouter2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PushRouter = exports.PushRouter = function (_PromiseRouter) {
  _inherits(PushRouter, _PromiseRouter);

  function PushRouter() {
    _classCallCheck(this, PushRouter);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(PushRouter).apply(this, arguments));
  }

  _createClass(PushRouter, [{
    key: 'mountRoutes',
    value: function mountRoutes() {
      var _this2 = this;

      this.route("POST", "/push", function (req) {
        return _this2.handlePOST(req);
      });
    }

    /**
     * Check whether the api call has master key or not.
     * @param {Object} request A request object
     */

  }, {
    key: 'handlePOST',
    value: function handlePOST(req) {
      // TODO: move to middlewares when support for Promise middlewares
      PushRouter.validateMasterKey(req);

      var pushController = req.config.pushController;
      if (!pushController) {
        throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED, 'Push controller is not set');
      }

      var where = PushRouter.getQueryCondition(req);

      pushController.sendPush(req.body, where, req.config, req.auth);
      return Promise.resolve({
        response: {
          'result': true
        }
      });
    }

    /**
    * Get query condition from the request body.
    * @param {Object} request A request object
    * @returns {Object} The query condition, the where field in a query api call
    */

  }], [{
    key: 'validateMasterKey',
    value: function validateMasterKey(req) {
      if (req.info.masterKey !== req.config.masterKey) {
        throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED, 'Master key is invalid, you should only use master key to send push');
      }
    }
  }, {
    key: 'getQueryCondition',
    value: function getQueryCondition(req) {
      var body = req.body || {};
      var hasWhere = typeof body.where !== 'undefined';
      var hasChannels = typeof body.channels !== 'undefined';

      var where;
      if (hasWhere && hasChannels) {
        throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED, 'Channels and query can not be set at the same time.');
      } else if (hasWhere) {
        where = body.where;
      } else if (hasChannels) {
        where = {
          "channels": {
            "$in": body.channels
          }
        };
      } else {
        throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED, 'Channels and query should be set at least one.');
      }
      return where;
    }
  }]);

  return PushRouter;
}(_PromiseRouter3.default);

exports.default = PushRouter;