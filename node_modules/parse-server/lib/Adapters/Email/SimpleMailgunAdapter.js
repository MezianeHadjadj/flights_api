'use strict';

var _mailgunJs = require('mailgun-js');

var _mailgunJs2 = _interopRequireDefault(_mailgunJs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SimpleMailgunAdapter = function SimpleMailgunAdapter(mailgunOptions) {
	if (!mailgunOptions || !mailgunOptions.apiKey || !mailgunOptions.domain) {
		throw 'SimpleMailgunAdapter requires an API Key and domain.';
	}
	var mailgun = (0, _mailgunJs2.default)(mailgunOptions);

	var sendMail = function sendMail(_ref) {
		var to = _ref.to;
		var subject = _ref.subject;
		var text = _ref.text;

		var data = {
			from: mailgunOptions.fromAddress,
			to: to,
			subject: subject,
			text: text
		};

		return new Promise(function (resolve, reject) {
			mailgun.messages().send(data, function (err, body) {
				if (typeof err !== 'undefined') {
					reject(err);
				}
				resolve(body);
			});
		});
	};

	return Object.freeze({
		sendMail: sendMail
	});
};

module.exports = SimpleMailgunAdapter;