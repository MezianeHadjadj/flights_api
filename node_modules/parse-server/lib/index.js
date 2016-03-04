'use strict';

require('babel-polyfill');

var _cache = require('./cache');

var _cache2 = _interopRequireDefault(_cache);

var _Config = require('./Config');

var _Config2 = _interopRequireDefault(_Config);

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _ParsePushAdapter = require('./Adapters/Push/ParsePushAdapter');

var _ParsePushAdapter2 = _interopRequireDefault(_ParsePushAdapter);

var _PromiseRouter = require('./PromiseRouter');

var _PromiseRouter2 = _interopRequireDefault(_PromiseRouter);

var _requiredParameter = require('./requiredParameter');

var _requiredParameter2 = _interopRequireDefault(_requiredParameter);

var _AnalyticsRouter = require('./Routers/AnalyticsRouter');

var _ClassesRouter = require('./Routers/ClassesRouter');

var _FeaturesRouter = require('./Routers/FeaturesRouter');

var _FileLoggerAdapter = require('./Adapters/Logger/FileLoggerAdapter');

var _FilesController = require('./Controllers/FilesController');

var _FilesRouter = require('./Routers/FilesRouter');

var _FunctionsRouter = require('./Routers/FunctionsRouter');

var _GlobalConfigRouter = require('./Routers/GlobalConfigRouter');

var _GridStoreAdapter = require('./Adapters/Files/GridStoreAdapter');

var _HooksController = require('./Controllers/HooksController');

var _HooksRouter = require('./Routers/HooksRouter');

var _IAPValidationRouter = require('./Routers/IAPValidationRouter');

var _InstallationsRouter = require('./Routers/InstallationsRouter');

var _AdapterLoader = require('./Adapters/AdapterLoader');

var _LoggerController = require('./Controllers/LoggerController');

var _LogsRouter = require('./Routers/LogsRouter');

var _PublicAPIRouter = require('./Routers/PublicAPIRouter');

var _PushController = require('./Controllers/PushController');

var _PushRouter = require('./Routers/PushRouter');

var _cryptoUtils = require('./cryptoUtils');

var _RolesRouter = require('./Routers/RolesRouter');

var _S3Adapter = require('./Adapters/Files/S3Adapter');

var _SchemasRouter = require('./Routers/SchemasRouter');

var _SessionsRouter = require('./Routers/SessionsRouter');

var _features = require('./features');

var _UserController = require('./Controllers/UserController');

var _UsersRouter = require('./Routers/UsersRouter');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var batch = require('./batch'),
    bodyParser = require('body-parser'),
    DatabaseAdapter = require('./DatabaseAdapter'),
    express = require('express'),
    middlewares = require('./middlewares'),
    multer = require('multer'),
    Parse = require('parse/node').Parse;

//import passwordReset           from './passwordReset';
// ParseServer - open-source compatible API Server for Parse apps

// Mutate the Parse object to add the Cloud Code handlers
addParseCloud();

// ParseServer works like a constructor of an express app.
// The args that we understand are:
// "databaseAdapter": a class like DatabaseController providing create, find,
//                    update, and delete
// "filesAdapter": a class like GridStoreAdapter providing create, get,
//                 and delete
// "loggerAdapter": a class like FileLoggerAdapter providing info, error,
//                 and query
// "databaseURI": a uri like mongodb://localhost:27017/dbname to tell us
//          what database this Parse API connects to.
// "cloud": relative location to cloud code to require, or a function
//          that is given an instance of Parse as a parameter.  Use this instance of Parse
//          to register your cloud code hooks and functions.
// "appId": the application id to host
// "masterKey": the master key for requests to this app
// "facebookAppIds": an array of valid Facebook Application IDs, required
//                   if using Facebook login
// "collectionPrefix": optional prefix for database collection names
// "fileKey": optional key from Parse dashboard for supporting older files
//            hosted by Parse
// "clientKey": optional key from Parse dashboard
// "dotNetKey": optional key from Parse dashboard
// "restAPIKey": optional key from Parse dashboard
// "javascriptKey": optional key from Parse dashboard
// "push": optional key from configure push

function ParseServer(_ref) {
  var _ref$appId = _ref.appId;
  var appId = _ref$appId === undefined ? (0, _requiredParameter2.default)('You must provide an appId!') : _ref$appId;
  var _ref$masterKey = _ref.masterKey;
  var masterKey = _ref$masterKey === undefined ? (0, _requiredParameter2.default)('You must provide a masterKey!') : _ref$masterKey;
  var appName = _ref.appName;
  var databaseAdapter = _ref.databaseAdapter;
  var filesAdapter = _ref.filesAdapter;
  var push = _ref.push;
  var loggerAdapter = _ref.loggerAdapter;
  var _ref$databaseURI = _ref.databaseURI;
  var databaseURI = _ref$databaseURI === undefined ? DatabaseAdapter.defaultDatabaseURI : _ref$databaseURI;
  var cloud = _ref.cloud;
  var _ref$collectionPrefix = _ref.collectionPrefix;
  var collectionPrefix = _ref$collectionPrefix === undefined ? '' : _ref$collectionPrefix;
  var clientKey = _ref.clientKey;
  var javascriptKey = _ref.javascriptKey;
  var dotNetKey = _ref.dotNetKey;
  var restAPIKey = _ref.restAPIKey;
  var _ref$fileKey = _ref.fileKey;
  var fileKey = _ref$fileKey === undefined ? 'invalid-file-key' : _ref$fileKey;
  var _ref$facebookAppIds = _ref.facebookAppIds;
  var facebookAppIds = _ref$facebookAppIds === undefined ? [] : _ref$facebookAppIds;
  var _ref$enableAnonymousU = _ref.enableAnonymousUsers;
  var enableAnonymousUsers = _ref$enableAnonymousU === undefined ? true : _ref$enableAnonymousU;
  var _ref$allowClientClass = _ref.allowClientClassCreation;
  var allowClientClassCreation = _ref$allowClientClass === undefined ? true : _ref$allowClientClass;
  var _ref$oauth = _ref.oauth;
  var oauth = _ref$oauth === undefined ? {} : _ref$oauth;
  var _ref$serverURL = _ref.serverURL;
  var serverURL = _ref$serverURL === undefined ? (0, _requiredParameter2.default)('You must provide a serverURL!') : _ref$serverURL;
  var _ref$maxUploadSize = _ref.maxUploadSize;
  var maxUploadSize = _ref$maxUploadSize === undefined ? '20mb' : _ref$maxUploadSize;
  var _ref$verifyUserEmails = _ref.verifyUserEmails;
  var verifyUserEmails = _ref$verifyUserEmails === undefined ? false : _ref$verifyUserEmails;
  var emailAdapter = _ref.emailAdapter;
  var publicServerURL = _ref.publicServerURL;
  var _ref$customPages = _ref.customPages;
  var customPages = _ref$customPages === undefined ? {
    invalidLink: undefined,
    verifyEmailSuccess: undefined,
    choosePassword: undefined,
    passwordResetSuccess: undefined
  } : _ref$customPages;

  (0, _features.setFeature)('serverVersion', _package2.default.version);
  // Initialize the node client SDK automatically
  Parse.initialize(appId, javascriptKey || 'unused', masterKey);
  Parse.serverURL = serverURL;

  if (databaseAdapter) {
    DatabaseAdapter.setAdapter(databaseAdapter);
  }

  if (databaseURI) {
    DatabaseAdapter.setAppDatabaseURI(appId, databaseURI);
  }

  if (cloud) {
    addParseCloud();
    if (typeof cloud === 'function') {
      cloud(Parse);
    } else if (typeof cloud === 'string') {
      require(cloud);
    } else {
      throw "argument 'cloud' must either be a string or a function";
    }
  }

  var filesControllerAdapter = (0, _AdapterLoader.loadAdapter)(filesAdapter, function () {
    return new _GridStoreAdapter.GridStoreAdapter(databaseURI);
  });
  var pushControllerAdapter = (0, _AdapterLoader.loadAdapter)(push, _ParsePushAdapter2.default);
  var loggerControllerAdapter = (0, _AdapterLoader.loadAdapter)(loggerAdapter, _FileLoggerAdapter.FileLoggerAdapter);
  var emailControllerAdapter = (0, _AdapterLoader.loadAdapter)(emailAdapter);
  // We pass the options and the base class for the adatper,
  // Note that passing an instance would work too
  var filesController = new _FilesController.FilesController(filesControllerAdapter, appId);
  var pushController = new _PushController.PushController(pushControllerAdapter, appId);
  var loggerController = new _LoggerController.LoggerController(loggerControllerAdapter, appId);
  var hooksController = new _HooksController.HooksController(appId, collectionPrefix);
  var userController = new _UserController.UserController(emailControllerAdapter, appId, { verifyUserEmails: verifyUserEmails });

  _cache2.default.apps.set(appId, {
    masterKey: masterKey,
    serverURL: serverURL,
    collectionPrefix: collectionPrefix,
    clientKey: clientKey,
    javascriptKey: javascriptKey,
    dotNetKey: dotNetKey,
    restAPIKey: restAPIKey,
    fileKey: fileKey,
    facebookAppIds: facebookAppIds,
    filesController: filesController,
    pushController: pushController,
    loggerController: loggerController,
    hooksController: hooksController,
    userController: userController,
    verifyUserEmails: verifyUserEmails,
    enableAnonymousUsers: enableAnonymousUsers,
    allowClientClassCreation: allowClientClassCreation,
    oauth: oauth,
    appName: appName,
    publicServerURL: publicServerURL,
    customPages: customPages
  });

  // To maintain compatibility. TODO: Remove in some version that breaks backwards compatability
  if (process.env.FACEBOOK_APP_ID) {
    _cache2.default.apps.get(appId)['facebookAppIds'].push(process.env.FACEBOOK_APP_ID);
  }

  _Config2.default.validate(_cache2.default.apps.get(appId));

  // This app serves the Parse API directly.
  // It's the equivalent of https://api.parse.com/1 in the hosted Parse API.
  var api = express();
  //api.use("/apps", express.static(__dirname + "/public"));
  // File handling needs to be before default middlewares are applied
  api.use('/', new _FilesRouter.FilesRouter().getExpressRouter({
    maxUploadSize: maxUploadSize
  }));

  api.use('/', bodyParser.urlencoded({ extended: false }), new _PublicAPIRouter.PublicAPIRouter().expressApp());

  // TODO: separate this from the regular ParseServer object
  if (process.env.TESTING == 1) {
    api.use('/', require('./testing-routes').router);
  }

  api.use(bodyParser.json({ 'type': '*/*', limit: maxUploadSize }));
  api.use(middlewares.allowCrossDomain);
  api.use(middlewares.allowMethodOverride);
  api.use(middlewares.handleParseHeaders);

  var routers = [new _ClassesRouter.ClassesRouter(), new _UsersRouter.UsersRouter(), new _SessionsRouter.SessionsRouter(), new _RolesRouter.RolesRouter(), new _AnalyticsRouter.AnalyticsRouter(), new _InstallationsRouter.InstallationsRouter(), new _FunctionsRouter.FunctionsRouter(), new _SchemasRouter.SchemasRouter(), new _PushRouter.PushRouter(), new _LogsRouter.LogsRouter(), new _IAPValidationRouter.IAPValidationRouter(), new _FeaturesRouter.FeaturesRouter()];

  if (process.env.PARSE_EXPERIMENTAL_CONFIG_ENABLED || process.env.TESTING) {
    routers.push(new _GlobalConfigRouter.GlobalConfigRouter());
  }

  if (process.env.PARSE_EXPERIMENTAL_HOOKS_ENABLED || process.env.TESTING) {
    routers.push(new _HooksRouter.HooksRouter());
  }

  var routes = routers.reduce(function (memo, router) {
    return memo.concat(router.routes);
  }, []);

  var appRouter = new _PromiseRouter2.default(routes);

  batch.mountOnto(appRouter);

  api.use(appRouter.expressApp());

  api.use(middlewares.handleParseErrors);

  process.on('uncaughtException', function (err) {
    if (err.code === "EADDRINUSE") {
      // user-friendly message for this common error
      console.log('Unable to listen on port ' + err.port + '. The port is already in use.');
      process.exit(0);
    } else {
      throw err;
    }
  });
  hooksController.load();

  return api;
}

function addParseCloud() {
  var ParseCloud = require("./cloud-code/Parse.Cloud");
  Object.assign(Parse.Cloud, ParseCloud);
  global.Parse = Parse;
}

module.exports = {
  ParseServer: ParseServer,
  S3Adapter: _S3Adapter.S3Adapter
};