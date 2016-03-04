"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var Parse = require('parse/node').Parse;
var gcm = require('node-gcm');
var cryptoUtils = require('./cryptoUtils');

var GCMTimeToLiveMax = 4 * 7 * 24 * 60 * 60; // GCM allows a max of 4 weeks
var GCMRegistrationTokensMax = 1000;

function GCM(args) {
  if ((typeof args === 'undefined' ? 'undefined' : _typeof(args)) !== 'object' || !args.apiKey) {
    throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED, 'GCM Configuration is invalid');
  }
  this.sender = new gcm.Sender(args.apiKey);
}

/**
 * Send gcm request.
 * @param {Object} data The data we need to send, the format is the same with api request body
 * @param {Array} devices A array of devices
 * @returns {Object} A promise which is resolved after we get results from gcm
 */
GCM.prototype.send = function (data, devices) {
  var _this = this;

  var pushId = cryptoUtils.newObjectId();
  var timeStamp = Date.now();
  var expirationTime = undefined;
  // We handle the expiration_time convertion in push.js, so expiration_time is a valid date
  // in Unix epoch time in milliseconds here
  if (data['expiration_time']) {
    expirationTime = data['expiration_time'];
  }
  // Generate gcm payload
  var gcmPayload = generateGCMPayload(data.data, pushId, timeStamp, expirationTime);
  // Make and send gcm request
  var message = new gcm.Message(gcmPayload);

  var sendPromises = [];
  // For android, we can only have 1000 recepients per send, so we need to slice devices to
  // chunk if necessary
  var chunkDevices = sliceDevices(devices, GCMRegistrationTokensMax);
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    var _loop = function _loop() {
      var chunkDevice = _step.value;

      var sendPromise = new Parse.Promise();
      var registrationTokens = [];
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = chunkDevice[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var device = _step2.value;

          registrationTokens.push(device.deviceToken);
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

      _this.sender.send(message, { registrationTokens: registrationTokens }, 5, function (error, response) {
        // TODO: Use the response from gcm to generate and save push report
        // TODO: If gcm returns some deviceTokens are invalid, set tombstone for the installation
        console.log('GCM request and response %j', {
          request: message,
          response: response
        });
        sendPromise.resolve();
      });
      sendPromises.push(sendPromise);
    };

    for (var _iterator = chunkDevices[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      _loop();
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

  return Parse.Promise.when(sendPromises);
};

/**
 * Generate the gcm payload from the data we get from api request.
 * @param {Object} coreData The data field under api request body
 * @param {String} pushId A random string
 * @param {Number} timeStamp A number whose format is the Unix Epoch
 * @param {Number|undefined} expirationTime A number whose format is the Unix Epoch or undefined
 * @returns {Object} A promise which is resolved after we get results from gcm
 */
function generateGCMPayload(coreData, pushId, timeStamp, expirationTime) {
  var payloadData = {
    'time': new Date(timeStamp).toISOString(),
    'push_id': pushId,
    'data': JSON.stringify(coreData)
  };
  var payload = {
    priority: 'normal',
    data: payloadData
  };
  if (expirationTime) {
    // The timeStamp and expiration is in milliseconds but gcm requires second
    var timeToLive = Math.floor((expirationTime - timeStamp) / 1000);
    if (timeToLive < 0) {
      timeToLive = 0;
    }
    if (timeToLive >= GCMTimeToLiveMax) {
      timeToLive = GCMTimeToLiveMax;
    }
    payload.timeToLive = timeToLive;
  }
  return payload;
}

/**
 * Slice a list of devices to several list of devices with fixed chunk size.
 * @param {Array} devices An array of devices
 * @param {Number} chunkSize The size of the a chunk
 * @returns {Array} An array which contaisn several arries of devices with fixed chunk size
 */
function sliceDevices(devices, chunkSize) {
  var chunkDevices = [];
  while (devices.length > 0) {
    chunkDevices.push(devices.splice(0, chunkSize));
  }
  return chunkDevices;
}

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  GCM.generateGCMPayload = generateGCMPayload;
  GCM.sliceDevices = sliceDevices;
}
module.exports = GCM;