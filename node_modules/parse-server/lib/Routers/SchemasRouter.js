'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SchemasRouter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _PromiseRouter2 = require('../PromiseRouter');

var _PromiseRouter3 = _interopRequireDefault(_PromiseRouter2);

var _middlewares = require('../middlewares');

var middleware = _interopRequireWildcard(_middlewares);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// schemas.js

var express = require('express'),
    Parse = require('parse/node').Parse,
    Schema = require('../Schema');

function classNameMismatchResponse(bodyClass, pathClass) {
  return Promise.resolve({
    status: 400,
    response: {
      code: Parse.Error.INVALID_CLASS_NAME,
      error: 'class name mismatch between ' + bodyClass + ' and ' + pathClass
    }
  });
}

function mongoSchemaAPIResponseFields(schema) {
  var fieldNames = Object.keys(schema).filter(function (key) {
    return key !== '_id' && key !== '_metadata';
  });
  var response = fieldNames.reduce(function (obj, fieldName) {
    obj[fieldName] = Schema.mongoFieldTypeToSchemaAPIType(schema[fieldName]);
    return obj;
  }, {});
  response.ACL = { type: 'ACL' };
  response.createdAt = { type: 'Date' };
  response.updatedAt = { type: 'Date' };
  response.objectId = { type: 'String' };
  return response;
}

function mongoSchemaToSchemaAPIResponse(schema) {
  return {
    className: schema._id,
    fields: mongoSchemaAPIResponseFields(schema)
  };
}

function getAllSchemas(req) {
  return req.config.database.adaptiveCollection('_SCHEMA').then(function (collection) {
    return collection.find({});
  }).then(function (schemas) {
    return schemas.map(mongoSchemaToSchemaAPIResponse);
  }).then(function (schemas) {
    return { response: { results: schemas } };
  });
}

function getOneSchema(req) {
  return req.config.database.collection('_SCHEMA').then(function (coll) {
    return coll.findOne({ '_id': req.params.className });
  }).then(function (schema) {
    return { response: mongoSchemaToSchemaAPIResponse(schema) };
  }).catch(function () {
    return {
      status: 400,
      response: {
        code: 103,
        error: 'class ' + req.params.className + ' does not exist'
      }
    };
  });
}

function createSchema(req) {
  if (req.params.className && req.body.className) {
    if (req.params.className != req.body.className) {
      return classNameMismatchResponse(req.body.className, req.params.className);
    }
  }
  var className = req.params.className || req.body.className;
  if (!className) {
    return Promise.resolve({
      status: 400,
      response: {
        code: 135,
        error: 'POST ' + req.path + ' needs class name'
      }
    });
  }
  return req.config.database.loadSchema().then(function (schema) {
    return schema.addClassIfNotExists(className, req.body.fields);
  }).then(function (result) {
    return { response: mongoSchemaToSchemaAPIResponse(result) };
  }).catch(function (error) {
    return {
      status: 400,
      response: error
    };
  });
}

function modifySchema(req) {
  if (req.body.className && req.body.className != req.params.className) {
    return classNameMismatchResponse(req.body.className, req.params.className);
  }

  var submittedFields = req.body.fields || {};
  var className = req.params.className;

  return req.config.database.loadSchema().then(function (schema) {
    if (!schema.data[className]) {
      throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, 'Class ' + req.params.className + ' does not exist.');
    }

    var existingFields = schema.data[className];
    Object.keys(submittedFields).forEach(function (name) {
      var field = submittedFields[name];
      if (existingFields[name] && field.__op !== 'Delete') {
        throw new Parse.Error(255, 'Field ' + name + ' exists, cannot update.');
      }
      if (!existingFields[name] && field.__op === 'Delete') {
        throw new Parse.Error(255, 'Field ' + name + ' does not exist, cannot delete.');
      }
    });

    var newSchema = Schema.buildMergedSchemaObject(existingFields, submittedFields);
    var mongoObject = Schema.mongoSchemaFromFieldsAndClassName(newSchema, className);
    if (!mongoObject.result) {
      throw new Parse.Error(mongoObject.code, mongoObject.error);
    }

    // Finally we have checked to make sure the request is valid and we can start deleting fields.
    // Do all deletions first, then a single save to _SCHEMA collection to handle all additions.
    var deletionPromises = [];
    Object.keys(submittedFields).forEach(function (submittedFieldName) {
      if (submittedFields[submittedFieldName].__op === 'Delete') {
        var promise = schema.deleteField(submittedFieldName, className, req.config.database);
        deletionPromises.push(promise);
      }
    });

    return Promise.all(deletionPromises).then(function () {
      return new Promise(function (resolve, reject) {
        schema.collection.update({ _id: className }, mongoObject.result, { w: 1 }, function (err, docs) {
          if (err) {
            reject(err);
          }
          resolve({ response: mongoSchemaToSchemaAPIResponse(mongoObject.result) });
        });
      });
    });
  });
}

// A helper function that removes all join tables for a schema. Returns a promise.
var removeJoinTables = function removeJoinTables(database, mongoSchema) {
  return Promise.all(Object.keys(mongoSchema).filter(function (field) {
    return mongoSchema[field].startsWith('relation<');
  }).map(function (field) {
    var collectionName = '_Join:' + field + ':' + mongoSchema._id;
    return database.dropCollection(collectionName);
  }));
};

function deleteSchema(req) {
  if (!Schema.classNameIsValid(req.params.className)) {
    throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, Schema.invalidClassNameMessage(req.params.className));
  }

  return req.config.database.collectionExists(req.params.className).then(function (exist) {
    if (!exist) {
      return Promise.resolve();
    }
    return req.config.database.adaptiveCollection(req.params.className).then(function (collection) {
      return collection.count().then(function (count) {
        if (count > 0) {
          throw new Parse.Error(255, 'Class ' + req.params.className + ' is not empty, contains ' + count + ' objects, cannot drop schema.');
        }
        return collection.drop();
      });
    });
  }).then(function () {
    // We've dropped the collection now, so delete the item from _SCHEMA
    // and clear the _Join collections
    return req.config.database.adaptiveCollection('_SCHEMA').then(function (coll) {
      return coll.findOneAndDelete({ _id: req.params.className });
    }).then(function (document) {
      if (document === null) {
        //tried to delete non-existent class
        return Promise.resolve();
      }
      return removeJoinTables(req.config.database, document);
    });
  }).then(function () {
    // Success
    return { response: {} };
  }, function (error) {
    if (error.message == 'ns not found') {
      // If they try to delete a non-existent class, that's fine, just let them.
      return { response: {} };
    }

    return Promise.reject(error);
  });
}

var SchemasRouter = exports.SchemasRouter = function (_PromiseRouter) {
  _inherits(SchemasRouter, _PromiseRouter);

  function SchemasRouter() {
    _classCallCheck(this, SchemasRouter);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SchemasRouter).apply(this, arguments));
  }

  _createClass(SchemasRouter, [{
    key: 'mountRoutes',
    value: function mountRoutes() {
      this.route('GET', '/schemas', middleware.promiseEnforceMasterKeyAccess, getAllSchemas);
      this.route('GET', '/schemas/:className', middleware.promiseEnforceMasterKeyAccess, getOneSchema);
      this.route('POST', '/schemas', middleware.promiseEnforceMasterKeyAccess, createSchema);
      this.route('POST', '/schemas/:className', middleware.promiseEnforceMasterKeyAccess, createSchema);
      this.route('PUT', '/schemas/:className', middleware.promiseEnforceMasterKeyAccess, modifySchema);
      this.route('DELETE', '/schemas/:className', middleware.promiseEnforceMasterKeyAccess, deleteSchema);
    }
  }]);

  return SchemasRouter;
}(_PromiseRouter3.default);