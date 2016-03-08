var config = require('konfu');
module.exports = exports = function(app) {
    app.post('/api/flights/list', exports.list)
}
exports.list =  function (req, res) {
       if (!req.app.validate(req.body, 'flight_validate', res)) return
    var params={
        request: {
            passengers: {
                adultCount: req.body.adult_passengers
            },
            slice: [
                {
                    origin: req.body.origin,
                    destination: req.body.destination,
                    date: req.body.start_date,
                    maxStops: req.body.max_stops
                }
            ],
            maxPrice: req.body.max_price_currency + req.body.max_price,
            solutions: 1
        }
    };


    var request = require('request');
    request.post({
        headers: {'content-type' : 'application/json'},
        url: config.QPX_URL+'?key='+config.API_KEY,
        body: JSON.stringify(params)

    }, function(error, response, body){
        //console.log("error:"+error);
        //console.log("response:"+response);
        //console.log("body:"+body);
        res.json(JSON.parse(body));
    });

};

