'use strict';

// schemas.js

var express = require('express'),
    Parse = require('parse/node').Parse,
    PromiseRouter = require('./PromiseRouter'),
    Schema = require('./Schema');

var router = new PromiseRouter();

function masterKeyRequiredResponse() {
  return Promise.resolve({
    status: 401,
    response: { error: 'master key not specified' }
  });
}

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
  if (!req.auth.isMaster) {
    return masterKeyRequiredResponse();
  }
  return req.config.database.collection('_SCHEMA').then(function (coll) {
    return coll.find({}).toArray();
  }).then(function (schemas) {
    return { response: {
        results: schemas.map(mongoSchemaToSchemaAPIResponse)
      } };
  });
}

function getOneSchema(req) {
  if (!req.auth.isMaster) {
    return masterKeyRequiredResponse();
  }
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
  if (!req.auth.isMaster) {
    return masterKeyRequiredResponse();
  }
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
  if (!req.auth.isMaster) {
    return masterKeyRequiredResponse();
  }

  if (req.body.className && req.body.className != req.params.className) {
    return classNameMismatchResponse(req.body.className, req.params.className);
  }

  var submittedFields = req.body.fields || {};
  var className = req.params.className;

  return req.config.database.loadSchema().then(function (schema) {
    if (!schema.data[className]) {
      return Promise.resolve({
        status: 400,
        response: {
          code: Parse.Error.INVALID_CLASS_NAME,
          error: 'class ' + req.params.className + ' does not exist'
        }
      });
    }
    var existingFields = schema.data[className];

    for (var submittedFieldName in submittedFields) {
      if (existingFields[submittedFieldName] && submittedFields[submittedFieldName].__op !== 'Delete') {
        return Promise.resolve({
          status: 400,
          response: {
            code: 255,
            error: 'field ' + submittedFieldName + ' exists, cannot update'
          }
        });
      }

      if (!existingFields[submittedFieldName] && submittedFields[submittedFieldName].__op === 'Delete') {
        return Promise.resolve({
          status: 400,
          response: {
            code: 255,
            error: 'field ' + submittedFieldName + ' does not exist, cannot delete'
          }
        });
      }
    }

    var newSchema = Schema.buildMergedSchemaObject(existingFields, submittedFields);
    var mongoObject = Schema.mongoSchemaFromFieldsAndClassName(newSchema, className);
    if (!mongoObject.result) {
      return Promise.resolve({
        status: 400,
        response: mongoObject
      });
    }

    // Finally we have checked to make sure the request is valid and we can start deleting fields.
    // Do all deletions first, then a single save to _SCHEMA collection to handle all additions.
    var deletionPromises = [];
    Object.keys(submittedFields).forEach(function (submittedFieldName) {
      if (submittedFields[submittedFieldName].__op === 'Delete') {
        var promise = req.config.database.connect().then(function () {
          return schema.deleteField(submittedFieldName, className, req.config.database.db, req.config.database.collectionPrefix);
        });
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
var removeJoinTables = function removeJoinTables(database, prefix, mongoSchema) {
  return Promise.all(Object.keys(mongoSchema).filter(function (field) {
    return mongoSchema[field].startsWith('relation<');
  }).map(function (field) {
    var joinCollectionName = prefix + '_Join:' + field + ':' + mongoSchema._id;
    return new Promise(function (resolve, reject) {
      database.dropCollection(joinCollectionName, function (err, results) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }));
};

function deleteSchema(req) {
  if (!req.auth.isMaster) {
    return masterKeyRequiredResponse();
  }

  if (!Schema.classNameIsValid(req.params.className)) {
    return Promise.resolve({
      status: 400,
      response: {
        code: Parse.Error.INVALID_CLASS_NAME,
        error: Schema.invalidClassNameMessage(req.params.className)
      }
    });
  }

  return req.config.database.collection(req.params.className).then(function (coll) {
    return new Promise(function (resolve, reject) {
      coll.count(function (err, count) {
        if (err) {
          reject(err);
        } else if (count > 0) {
          resolve({
            status: 400,
            response: {
              code: 255,
              error: 'class ' + req.params.className + ' not empty, contains ' + count + ' objects, cannot drop schema'
            }
          });
        } else {
          coll.drop(function (err, reply) {
            if (err) {
              reject(err);
            } else {
              // We've dropped the collection now, so delete the item from _SCHEMA
              // and clear the _Join collections
              req.config.database.collection('_SCHEMA').then(function (coll) {
                return new Promise(function (resolve, reject) {
                  coll.findAndRemove({ _id: req.params.className }, [], function (err, doc) {
                    if (err) {
                      reject(err);
                    } else if (doc.value === null) {
                      //tried to delete non-existant class
                      resolve({ response: {} });
                    } else {
                      removeJoinTables(req.config.database.db, req.config.database.collectionPrefix, doc.value).then(resolve, reject);
                    }
                  });
                });
              }).then(resolve.bind(undefined, { response: {} }), reject);
            }
          });
        }
      });
    });
  }).catch(function (error) {
    if (error.message == 'ns not found') {
      // If they try to delete a non-existant class, thats fine, just let them.
      return Promise.resolve({ response: {} });
    } else {
      return Promise.reject(error);
    }
  });
}

router.route('GET', '/schemas', getAllSchemas);
router.route('GET', '/schemas/:className', getOneSchema);
router.route('POST', '/schemas', createSchema);
router.route('POST', '/schemas/:className', createSchema);
router.route('PUT', '/schemas/:className', modifySchema);
router.route('DELETE', '/schemas/:className', deleteSchema);

module.exports = router;