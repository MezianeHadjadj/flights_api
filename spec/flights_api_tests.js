var request = require("request");
var app_file = require("../index.js")
var base_url = "http://localhost:1337/"
var flights_apis=require("../apis/flights_apis.js");

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

    });
});
