var request = require("request");
var app_file = require("../index.js")
var base_url = "http://localhost:1337/"
var flights_apis=require("../apis/flights_apis.js");

var params_test={};

describe("Test flights apis", function() {
    describe("GET /", function() {
        it("returns status code 200", function(done) {
            request.get(base_url, function(error, response, body) {
                expect(response.statusCode).toBe(200);
                done();
            });
        });
        it("List Api should return always a json object ", function(done) {
            request.get(base_url+"api/flights/list", function(error, response, body) {
                expect(typeof response).toBe('object');
                done();
            });
        });

        it("Test if we get invalid request when we put an empty origin. ", function(done) {
            var params_test={
                //"origin": "NYC",
                "destination": "LGA",
                "start_date": "2016-03-11",
                "adult_passengers": 2,
                "max_stops": 1,
                "max_price": 1000,
                "max_price_currency": "USD"
            };
            request.post({
                headers: {'content-type' : 'application/json'},
                url: base_url+"api/flights/list",
                body: JSON.stringify(params_test)

            }, function(error, response, body){
                //expect('object').toBe('object');
                body=JSON.parse(body)
                expect(body.message ).toBe("Request is invalid");
                expect(body.validation[0].property).toBe("instance.origin");
                expect(body.validation[0].property).toBe("instance.origin");
                expect(body.validation[0].message).toBe("is required");
                done();
            });


        }, 10000);

    });
});
