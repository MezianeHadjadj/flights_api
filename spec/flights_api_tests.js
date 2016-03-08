var request = require("request");
var app_file = require("../index.js")
var base_url = "http://localhost:1337/"
var flights_apis=require("../apis/flights_apis.js");

describe("Test Flights apis", function() {
    describe("GET /", function() {
        it("returns status code 200", function(done) {
            request.get(base_url, function(error, response, body) {
                expect(response.statusCode).toBe(200);
                done();
            });
        });

    });
});
