'use strict';

// These methods handle the 'classes' routes.
// Methods of the form 'handleX' return promises and are intended to
// be used with the PromiseRouter.

var Parse = require('parse/node').Parse,
    PromiseRouter = require('./PromiseRouter'),
    rest = require('./rest');

var router = new PromiseRouter();

// Returns a promise that resolves to a {response} object.
function handleFind(req) {
  var body = Object.assign(req.body, req.query);
  var options = {};
  if (body.skip) {
    options.skip = Number(body.skip);
  }
  if (body.limit) {
    options.limit = Number(body.limit);
  }
  if (body.order) {
    options.order = String(body.order);
  }
  if (body.count) {
    options.count = true;
  }
  if (typeof body.keys == 'string') {
    options.keys = body.keys;
  }
  if (body.include) {
    options.include = String(body.include);
  }
  if (body.redirectClassNameForKey) {
    options.redirectClassNameForKey = String(body.redirectClassNameForKey);
  }

  if (typeof body.where === 'string') {
    body.where = JSON.parse(body.where);
  }

  return rest.find(req.config, req.auth, req.params.className, body.where, options).then(function (response) {
    if (response && response.results) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = response.results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var result = _step.value;

          if (result.sessionToken) {
            result.sessionToken = req.info.sessionToken || result.sessionToken;
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

      response.results.sessionToken;
    }
    return { response: response };
  });
}

// Returns a promise for a {status, response, location} object.
function handleCreate(req) {
  return rest.create(req.config, req.auth, req.params.className, req.body);
}

// Returns a promise for a {response} object.
function handleGet(req) {
  return rest.find(req.config, req.auth, req.params.className, { objectId: req.params.objectId }).then(function (response) {
    if (!response.results || response.results.length == 0) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
    } else {
      return { response: response.results[0] };
    }
  });
}

// Returns a promise for a {response} object.
function handleDelete(req) {
  return rest.del(req.config, req.auth, req.params.className, req.params.objectId).then(function () {
    return { response: {} };
  });
}

// Returns a promise for a {response} object.
function handleUpdate(req) {
  return rest.update(req.config, req.auth, req.params.className, req.params.objectId, req.body).then(function (response) {
    return { response: response };
  });
}

router.route('GET', '/classes/:className', handleFind);
router.route('POST', '/classes/:className', handleCreate);
router.route('GET', '/classes/:className/:objectId', handleGet);
router.route('DELETE', '/classes/:className/:objectId', handleDelete);
router.route('PUT', '/classes/:className/:objectId', handleUpdate);

module.exports = router;