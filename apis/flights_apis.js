var config = require('konfu');
module.exports = exports = function(app) {
    app.post('/api/flights/list', exports.list)
  //  app.get('/api/flights/list/:add', exports.list)
}
exports.list =  function (req, res) {
        console.log(req.body);
     //  if (!req.app.validate(req.body, 'flight_validate', res)) return
    var params={
        request: {
            passengers: {
                adultCount: req.body.adult_passengers
            },
            slice: [
                {
                    origin: req.body.origin,
                    destination: req.body.destination,
                 //   date: req.body.start_date.substring(0,10),
                    maxStops: req.body.max_stops
                }
            ],
            maxPrice: req.body.max_price_currency + req.body.max_price,
            solutions: 1
        }
    };
    var params_test={
        "request": {
            "passengers": {
                "adultCount": 2
            },
            "slice": [
                {
                    "origin": "NYC",
                    "destination": "LGA",
                    "date": "2016-03-11",
                    "maxStops": 4
                }
            ],
            solutions: 1
        }
    };

    var request = require('request');
    request.post({
        headers: {'content-type' : 'application/json'},
        url: config.QPX_URL+'?key='+config.API_KEY,
        body: JSON.stringify(params_test)

    }, function(error, response, body){
        console.log("error:"+error);
        res.json(JSON.parse(body));
    });

};

