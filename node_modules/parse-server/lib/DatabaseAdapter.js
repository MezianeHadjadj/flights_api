'use strict';

var _DatabaseController = require('./Controllers/DatabaseController');

var _DatabaseController2 = _interopRequireDefault(_DatabaseController);

var _MongoStorageAdapter = require('./Adapters/Storage/Mongo/MongoStorageAdapter');

var _MongoStorageAdapter2 = _interopRequireDefault(_MongoStorageAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**  weak */
// Database Adapter
//
// Allows you to change the underlying database.
//
// Adapter classes must implement the following methods:
// * a constructor with signature (connectionString, optionsObject)
// * connect()
// * loadSchema()
// * create(className, object)
// * find(className, query, options)
// * update(className, query, update, options)
// * destroy(className, query, options)
// * This list is incomplete and the database process is not fully modularized.
//
// Default is MongoStorageAdapter.

var DefaultDatabaseURI = 'mongodb://localhost:27017/parse';

var adapter = _MongoStorageAdapter2.default;
var dbConnections = {};
var databaseURI = DefaultDatabaseURI;
var appDatabaseURIs = {};

function setAdapter(databaseAdapter) {
  adapter = databaseAdapter;
}

function setDatabaseURI(uri) {
  databaseURI = uri;
}

function setAppDatabaseURI(appId, uri) {
  appDatabaseURIs[appId] = uri;
}

//Used by tests
function clearDatabaseURIs() {
  appDatabaseURIs = {};
  dbConnections = {};
}

function getDatabaseConnection(appId, collectionPrefix) {
  if (dbConnections[appId]) {
    return dbConnections[appId];
  }

  var dbURI = appDatabaseURIs[appId] ? appDatabaseURIs[appId] : databaseURI;

  var storageAdapter = new adapter(dbURI);
  dbConnections[appId] = new _DatabaseController2.default(storageAdapter, {
    collectionPrefix: collectionPrefix
  });
  return dbConnections[appId];
}

module.exports = {
  dbConnections: dbConnections,
  getDatabaseConnection: getDatabaseConnection,
  setAdapter: setAdapter,
  setDatabaseURI: setDatabaseURI,
  setAppDatabaseURI: setAppDatabaseURI,
  clearDatabaseURIs: clearDatabaseURIs,
  defaultDatabaseURI: databaseURI
};