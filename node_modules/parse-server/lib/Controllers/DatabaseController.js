'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

// A database adapter that works with data exported from the hosted
// Parse database.

var mongodb = require('mongodb');
var Parse = require('parse/node').Parse;

var Schema = require('./../Schema');
var transform = require('./../transform');

// options can contain:
//   collectionPrefix: the string to put in front of every collection name.
function DatabaseController(adapter) {
  var _ref = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var collectionPrefix = _ref.collectionPrefix;

  this.adapter = adapter;

  this.collectionPrefix = collectionPrefix;

  // We don't want a mutable this.schema, because then you could have
  // one request that uses different schemas for different parts of
  // it. Instead, use loadSchema to get a schema.
  this.schemaPromise = null;

  this.connect();
}

// Connects to the database. Returns a promise that resolves when the
// connection is successful.
DatabaseController.prototype.connect = function () {
  return this.adapter.connect();
};

// Returns a promise for a Mongo collection.
// Generally just for internal use.
DatabaseController.prototype.collection = function (className) {
  if (!Schema.classNameIsValid(className)) {
    throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, 'invalid className: ' + className);
  }
  return this.rawCollection(className);
};

DatabaseController.prototype.adaptiveCollection = function (className) {
  return this.adapter.adaptiveCollection(this.collectionPrefix + className);
};

DatabaseController.prototype.collectionExists = function (className) {
  return this.adapter.collectionExists(this.collectionPrefix + className);
};

DatabaseController.prototype.rawCollection = function (className) {
  return this.adapter.collection(this.collectionPrefix + className);
};

DatabaseController.prototype.dropCollection = function (className) {
  return this.adapter.dropCollection(this.collectionPrefix + className);
};

function returnsTrue() {
  return true;
}

// Returns a promise for a schema object.
// If we are provided a acceptor, then we run it on the schema.
// If the schema isn't accepted, we reload it at most once.
DatabaseController.prototype.loadSchema = function () {
  var _this = this;

  var acceptor = arguments.length <= 0 || arguments[0] === undefined ? returnsTrue : arguments[0];


  if (!this.schemaPromise) {
    this.schemaPromise = this.collection('_SCHEMA').then(function (coll) {
      delete _this.schemaPromise;
      return Schema.load(coll);
    });
    return this.schemaPromise;
  }

  return this.schemaPromise.then(function (schema) {
    if (acceptor(schema)) {
      return schema;
    }
    _this.schemaPromise = _this.collection('_SCHEMA').then(function (coll) {
      delete _this.schemaPromise;
      return Schema.load(coll);
    });
    return _this.schemaPromise;
  });
};

// Returns a promise for the classname that is related to the given
// classname through the key.
// TODO: make this not in the DatabaseController interface
DatabaseController.prototype.redirectClassNameForKey = function (className, key) {
  return this.loadSchema().then(function (schema) {
    var t = schema.getExpectedType(className, key);
    var match = t.match(/^relation<(.*)>$/);
    if (match) {
      return match[1];
    } else {
      return className;
    }
  });
};

// Uses the schema to validate the object (REST API format).
// Returns a promise that resolves to the new schema.
// This does not update this.schema, because in a situation like a
// batch request, that could confuse other users of the schema.
DatabaseController.prototype.validateObject = function (className, object, query) {
  return this.loadSchema().then(function (schema) {
    return schema.validateObject(className, object, query);
  });
};

// Like transform.untransformObject but you need to provide a className.
// Filters out any data that shouldn't be on this REST-formatted object.
DatabaseController.prototype.untransformObject = function (schema, isMaster, aclGroup, className, mongoObject) {
  var object = transform.untransformObject(schema, className, mongoObject);

  if (className !== '_User') {
    return object;
  }

  if (isMaster || aclGroup.indexOf(object.objectId) > -1) {
    return object;
  }

  delete object.authData;
  delete object.sessionToken;
  return object;
};

// Runs an update on the database.
// Returns a promise for an object with the new values for field
// modifications that don't know their results ahead of time, like
// 'increment'.
// Options:
//   acl:  a list of strings. If the object to be updated has an ACL,
//         one of the provided strings must provide the caller with
//         write permissions.
DatabaseController.prototype.update = function (className, query, update, options) {
  var _this2 = this;

  var acceptor = function acceptor(schema) {
    return schema.hasKeys(className, Object.keys(query));
  };
  var isMaster = !('acl' in options);
  var aclGroup = options.acl || [];
  var mongoUpdate, schema;
  return this.loadSchema(acceptor).then(function (s) {
    schema = s;
    if (!isMaster) {
      return schema.validatePermission(className, aclGroup, 'update');
    }
    return Promise.resolve();
  }).then(function () {
    return _this2.handleRelationUpdates(className, query.objectId, update);
  }).then(function () {
    return _this2.adaptiveCollection(className);
  }).then(function (collection) {
    var mongoWhere = transform.transformWhere(schema, className, query);
    if (options.acl) {
      var writePerms = [{ _wperm: { '$exists': false } }];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = options.acl[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var entry = _step.value;

          writePerms.push({ _wperm: { '$in': [entry] } });
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

      mongoWhere = { '$and': [mongoWhere, { '$or': writePerms }] };
    }
    mongoUpdate = transform.transformUpdate(schema, className, update);
    return collection.findOneAndUpdate(mongoWhere, mongoUpdate);
  }).then(function (result) {
    if (!result) {
      return Promise.reject(new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Object not found.'));
    }

    var response = {};
    var inc = mongoUpdate['$inc'];
    if (inc) {
      Object.keys(inc).forEach(function (key) {
        response[key] = result[key];
      });
    }
    return response;
  });
};

// Processes relation-updating operations from a REST-format update.
// Returns a promise that resolves successfully when these are
// processed.
// This mutates update.
DatabaseController.prototype.handleRelationUpdates = function (className, objectId, update) {
  var _this3 = this;

  var pending = [];
  var deleteMe = [];
  objectId = update.objectId || objectId;

  var process = function process(op, key) {
    if (!op) {
      return;
    }
    if (op.__op == 'AddRelation') {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = op.objects[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var object = _step2.value;

          pending.push(_this3.addRelation(key, className, objectId, object.objectId));
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      deleteMe.push(key);
    }

    if (op.__op == 'RemoveRelation') {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = op.objects[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var object = _step3.value;

          pending.push(_this3.removeRelation(key, className, objectId, object.objectId));
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      deleteMe.push(key);
    }

    if (op.__op == 'Batch') {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = op.ops[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var x = _step4.value;

          process(x, key);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }
  };

  for (var key in update) {
    process(update[key], key);
  }
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = deleteMe[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var key = _step5.value;

      delete update[key];
    }
  } catch (err) {
    _didIteratorError5 = true;
    _iteratorError5 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion5 && _iterator5.return) {
        _iterator5.return();
      }
    } finally {
      if (_didIteratorError5) {
        throw _iteratorError5;
      }
    }
  }

  return Promise.all(pending);
};

// Adds a relation.
// Returns a promise that resolves successfully iff the add was successful.
DatabaseController.prototype.addRelation = function (key, fromClassName, fromId, toId) {
  var doc = {
    relatedId: toId,
    owningId: fromId
  };
  var className = '_Join:' + key + ':' + fromClassName;
  return this.collection(className).then(function (coll) {
    return coll.update(doc, doc, { upsert: true });
  });
};

// Removes a relation.
// Returns a promise that resolves successfully iff the remove was
// successful.
DatabaseController.prototype.removeRelation = function (key, fromClassName, fromId, toId) {
  var doc = {
    relatedId: toId,
    owningId: fromId
  };
  var className = '_Join:' + key + ':' + fromClassName;
  return this.collection(className).then(function (coll) {
    return coll.remove(doc);
  });
};

// Removes objects matches this query from the database.
// Returns a promise that resolves successfully iff the object was
// deleted.
// Options:
//   acl:  a list of strings. If the object to be updated has an ACL,
//         one of the provided strings must provide the caller with
//         write permissions.
DatabaseController.prototype.destroy = function (className, query) {
  var _this4 = this;

  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var isMaster = !('acl' in options);
  var aclGroup = options.acl || [];

  var schema;
  return this.loadSchema().then(function (s) {
    schema = s;
    if (!isMaster) {
      return schema.validatePermission(className, aclGroup, 'delete');
    }
    return Promise.resolve();
  }).then(function () {

    return _this4.collection(className);
  }).then(function (coll) {
    var mongoWhere = transform.transformWhere(schema, className, query);

    if (options.acl) {
      var writePerms = [{ _wperm: { '$exists': false } }];
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;
      var _iteratorError6 = undefined;

      try {
        for (var _iterator6 = options.acl[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
          var entry = _step6.value;

          writePerms.push({ _wperm: { '$in': [entry] } });
        }
      } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion6 && _iterator6.return) {
            _iterator6.return();
          }
        } finally {
          if (_didIteratorError6) {
            throw _iteratorError6;
          }
        }
      }

      mongoWhere = { '$and': [mongoWhere, { '$or': writePerms }] };
    }

    return coll.remove(mongoWhere);
  }).then(function (resp) {
    //Check _Session to avoid changing password failed without any session.
    if (resp.result.n === 0 && className !== "_Session") {
      return Promise.reject(new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Object not found.'));
    }
  }, function (error) {
    throw error;
  });
};

// Inserts an object into the database.
// Returns a promise that resolves successfully iff the object saved.
DatabaseController.prototype.create = function (className, object, options) {
  var _this5 = this;

  var schema;
  var isMaster = !('acl' in options);
  var aclGroup = options.acl || [];

  return this.loadSchema().then(function (s) {
    schema = s;
    if (!isMaster) {
      return schema.validatePermission(className, aclGroup, 'create');
    }
    return Promise.resolve();
  }).then(function () {

    return _this5.handleRelationUpdates(className, null, object);
  }).then(function () {
    return _this5.collection(className);
  }).then(function (coll) {
    var mongoObject = transform.transformCreate(schema, className, object);
    return coll.insert([mongoObject]);
  });
};

// Runs a mongo query on the database.
// This should only be used for testing - use 'find' for normal code
// to avoid Mongo-format dependencies.
// Returns a promise that resolves to a list of items.
DatabaseController.prototype.mongoFind = function (className, query) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  return this.adaptiveCollection(className).then(function (collection) {
    return collection.find(query, options);
  });
};

// Deletes everything in the database matching the current collectionPrefix
// Won't delete collections in the system namespace
// Returns a promise.
DatabaseController.prototype.deleteEverything = function () {
  this.schemaPromise = null;

  return this.adapter.collectionsContaining(this.collectionPrefix).then(function (collections) {
    var promises = collections.map(function (collection) {
      return collection.drop();
    });
    return Promise.all(promises);
  });
};

// Finds the keys in a query. Returns a Set. REST format only
function keysForQuery(query) {
  var sublist = query['$and'] || query['$or'];
  if (sublist) {
    var answer = sublist.reduce(function (memo, subquery) {
      return memo.concat(keysForQuery(subquery));
    }, []);

    return new Set(answer);
  }

  return new Set(Object.keys(query));
}

// Returns a promise for a list of related ids given an owning id.
// className here is the owning className.
DatabaseController.prototype.relatedIds = function (className, key, owningId) {
  return this.adaptiveCollection(joinTableName(className, key)).then(function (coll) {
    return coll.find({ owningId: owningId });
  }).then(function (results) {
    return results.map(function (r) {
      return r.relatedId;
    });
  });
};

// Returns a promise for a list of owning ids given some related ids.
// className here is the owning className.
DatabaseController.prototype.owningIds = function (className, key, relatedIds) {
  return this.adaptiveCollection(joinTableName(className, key)).then(function (coll) {
    return coll.find({ relatedId: { '$in': relatedIds } });
  }).then(function (results) {
    return results.map(function (r) {
      return r.owningId;
    });
  });
};

// Modifies query so that it no longer has $in on relation fields, or
// equal-to-pointer constraints on relation fields.
// Returns a promise that resolves when query is mutated
DatabaseController.prototype.reduceInRelation = function (className, query, schema) {
  var _this6 = this;

  // Search for an in-relation or equal-to-relation
  // Make it sequential for now, not sure of paralleization side effects
  if (query['$or']) {
    var ors = query['$or'];
    return Promise.all(ors.map(function (aQuery, index) {
      return _this6.reduceInRelation(className, aQuery, schema).then(function (aQuery) {
        query['$or'][index] = aQuery;
      });
    }));
  }

  var promises = Object.keys(query).map(function (key) {
    if (query[key] && (query[key]['$in'] || query[key].__type == 'Pointer')) {
      var t = schema.getExpectedType(className, key);
      var match = t ? t.match(/^relation<(.*)>$/) : false;
      if (!match) {
        return Promise.resolve(query);
      }
      var relatedClassName = match[1];
      var relatedIds = undefined;
      if (query[key]['$in']) {
        relatedIds = query[key]['$in'].map(function (r) {
          return r.objectId;
        });
      } else {
        relatedIds = [query[key].objectId];
      }
      return _this6.owningIds(className, key, relatedIds).then(function (ids) {
        delete query[key];
        _this6.addInObjectIdsIds(ids, query);
        return Promise.resolve(query);
      });
    }
    return Promise.resolve(query);
  });

  return Promise.all(promises).then(function () {
    return Promise.resolve(query);
  });
};

// Modifies query so that it no longer has $relatedTo
// Returns a promise that resolves when query is mutated
DatabaseController.prototype.reduceRelationKeys = function (className, query) {
  var _this7 = this;

  if (query['$or']) {
    return Promise.all(query['$or'].map(function (aQuery) {
      return _this7.reduceRelationKeys(className, aQuery);
    }));
  }

  var relatedTo = query['$relatedTo'];
  if (relatedTo) {
    return this.relatedIds(relatedTo.object.className, relatedTo.key, relatedTo.object.objectId).then(function (ids) {
      delete query['$relatedTo'];
      _this7.addInObjectIdsIds(ids, query);
      return _this7.reduceRelationKeys(className, query);
    });
  }
};

DatabaseController.prototype.addInObjectIdsIds = function (ids, query) {
  if (typeof query.objectId == 'string') {
    query.objectId = { '$in': [query.objectId] };
  }
  query.objectId = query.objectId || {};
  var queryIn = [].concat(query.objectId['$in'] || [], ids || []);
  // make a set and spread to remove duplicates
  query.objectId = { '$in': [].concat(_toConsumableArray(new Set(queryIn))) };
  return query;
};

// Runs a query on the database.
// Returns a promise that resolves to a list of items.
// Options:
//   skip    number of results to skip.
//   limit   limit to this number of results.
//   sort    an object where keys are the fields to sort by.
//           the value is +1 for ascending, -1 for descending.
//   count   run a count instead of returning results.
//   acl     restrict this operation with an ACL for the provided array
//           of user objectIds and roles. acl: null means no user.
//           when this field is not present, don't do anything regarding ACLs.
// TODO: make userIds not needed here. The db adapter shouldn't know
// anything about users, ideally. Then, improve the format of the ACL
// arg to work like the others.
DatabaseController.prototype.find = function (className, query) {
  var _this8 = this;

  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var mongoOptions = {};
  if (options.skip) {
    mongoOptions.skip = options.skip;
  }
  if (options.limit) {
    mongoOptions.limit = options.limit;
  }

  var isMaster = !('acl' in options);
  var aclGroup = options.acl || [];
  var acceptor = function acceptor(schema) {
    return schema.hasKeys(className, keysForQuery(query));
  };
  var schema;
  return this.loadSchema(acceptor).then(function (s) {
    schema = s;
    if (options.sort) {
      mongoOptions.sort = {};
      for (var key in options.sort) {
        var mongoKey = transform.transformKey(schema, className, key);
        mongoOptions.sort[mongoKey] = options.sort[key];
      }
    }

    if (!isMaster) {
      var op = 'find';
      var k = Object.keys(query);
      if (k.length == 1 && typeof query.objectId == 'string') {
        op = 'get';
      }
      return schema.validatePermission(className, aclGroup, op);
    }
    return Promise.resolve();
  }).then(function () {
    return _this8.reduceRelationKeys(className, query);
  }).then(function () {
    return _this8.reduceInRelation(className, query, schema);
  }).then(function () {
    return _this8.adaptiveCollection(className);
  }).then(function (collection) {
    var mongoWhere = transform.transformWhere(schema, className, query);
    if (!isMaster) {
      var orParts = [{ "_rperm": { "$exists": false } }, { "_rperm": { "$in": ["*"] } }];
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = aclGroup[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var acl = _step7.value;

          orParts.push({ "_rperm": { "$in": [acl] } });
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }

      mongoWhere = { '$and': [mongoWhere, { '$or': orParts }] };
    }
    if (options.count) {
      delete mongoOptions.limit;
      return collection.count(mongoWhere, mongoOptions);
    } else {
      return collection.find(mongoWhere, mongoOptions).then(function (mongoResults) {
        return mongoResults.map(function (r) {
          return _this8.untransformObject(schema, isMaster, aclGroup, className, r);
        });
      });
    }
  });
};

function joinTableName(className, key) {
  return '_Join:' + key + ':' + className;
}

module.exports = DatabaseController;