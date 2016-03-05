var express = require('express')
, app = express()
, bodyParser = require('body-parser')
, path=require("path")
, morgan = require('morgan')
, config = require('konfu')
, methodOverride = require('method-override')
//var Parse=require ("parse");



// configuration ===============================================================
app.use(express.static(__dirname + '/public'));
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({'extended': 'true'}));
app.use(bodyParser.json());


var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));




app.validate = require('./validate');
require('./apis/flights_apis.js')(app);

app.use(function (err, req, res, next) {
    console.error(err);
    console.error(err.stack);
    next(err);
});




app.use(function(req, res) {
    res.send(404)
});
// START THE SERVER
// =============================================================================
var port = process.env.PORT || 1337;
app.listen(port, function() {
    console.log('Flights search app running on port ' + port + '.');
});
