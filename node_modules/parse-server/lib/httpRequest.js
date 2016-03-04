'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var request = require("request"),
    Parse = require('parse/node').Parse;

var encodeBody = function encodeBody(body) {
  var headers = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if ((typeof body === 'undefined' ? 'undefined' : _typeof(body)) !== 'object') {
    return body;
  }
  var contentTypeKeys = Object.keys(headers).filter(function (key) {
    return key.match(/content-type/i) != null;
  });

  if (contentTypeKeys.length == 1) {
    var contentType = contentTypeKeys[0];
    if (headers[contentType].match(/application\/json/i)) {
      body = JSON.stringify(body);
    } else if (headers[contentType].match(/application\/x-www-form-urlencoded/i)) {
      body = Object.keys(body).map(function (key) {
        return key + '=' + encodeURIComponent(body[key]);
      }).join("&");
    }
  }
  return body;
};

module.exports = function (options) {
  var promise = new Parse.Promise();
  var callbacks = {
    success: options.success,
    error: options.error
  };
  delete options.success;
  delete options.error;
  delete options.uri; // not supported
  options.body = encodeBody(options.body, options.headers);
  // set follow redirects to false by default
  options.followRedirect = options.followRedirects == true;

  request(options, function (error, response, body) {
    var httpResponse = {};
    httpResponse.status = response.statusCode;
    httpResponse.headers = response.headers;
    httpResponse.buffer = new Buffer(response.body);
    httpResponse.cookies = response.headers["set-cookie"];
    httpResponse.text = response.body;
    try {
      httpResponse.data = JSON.parse(response.body);
    } catch (e) {}
    // Consider <200 && >= 400 as errors
    if (error || httpResponse.status < 200 || httpResponse.status >= 400) {
      if (callbacks.error) {
        callbacks.error(httpResponse);
      }
      return promise.reject(httpResponse);
    } else {
      if (callbacks.success) {
        callbacks.success(httpResponse);
      }
      return promise.resolve(httpResponse);
    }
  });
  return promise;
};

module.exports.encodeBody = encodeBody;