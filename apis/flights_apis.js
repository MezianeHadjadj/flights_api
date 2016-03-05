var config = require('konfu');
module.exports = exports = function(app) {
    app.post('/api/flights/list', exports.list)
  //  app.get('/api/flights/list/:add', exports.list)
}
exports.list =  function (req, res) {
       if (!req.app.validate(req.body, 'flight_validate', res)) return

    var params={
        request: {
            passengers: {
                adultCount: 2
            },
            slice: [
                {
                    origin: "NYC",
                    destination: "LGA",
                    date: "2016-03-11"
                }
            ],
            solutions: 1
        }
    };

    var request = require('request');
    request.post({
        headers: {'content-type' : 'application/json'},
        url: config.QPX_URL+'?key='+config.API_KEY,
        body: JSON.stringify(params)

    }, function(error, response, body){
        console.log("body:"+body);
        res.json(body);
    });




};

