'use strict';

var _PromiseRouter = require('./PromiseRouter');

var _PromiseRouter2 = _interopRequireDefault(_PromiseRouter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// global_config.js

var Parse = require('parse/node').Parse;

var router = new _PromiseRouter2.default();

function getGlobalConfig(req) {
  return req.config.database.rawCollection('_GlobalConfig').then(function (coll) {
    return coll.findOne({ '_id': 1 });
  }).then(function (globalConfig) {
    return { response: { params: globalConfig.params } };
  }).catch(function () {
    return {
      status: 404,
      response: {
        code: Parse.Error.INVALID_KEY_NAME,
        error: 'config does not exist'
      }
    };
  });
}

function updateGlobalConfig(req) {
  if (!req.auth.isMaster) {
    return Promise.resolve({
      status: 401,
      response: { error: 'unauthorized' }
    });
  }

  return req.config.database.rawCollection('_GlobalConfig').then(function (coll) {
    return coll.findOneAndUpdate({ _id: 1 }, { $set: req.body });
  }).then(function (response) {
    return { response: { result: true } };
  }).catch(function () {
    return {
      status: 404,
      response: {
        code: Parse.Error.INVALID_KEY_NAME,
        error: 'config cannot be updated'
      }
    };
  });
}

router.route('GET', '/config', getGlobalConfig);
router.route('PUT', '/config', updateGlobalConfig);

module.exports = router;