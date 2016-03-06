angular.module('flightsController', [])

    .controller('mainController', ['$scope','$http','Flights', function($scope, $http, Flights) {

        $scope.get_flights = function() {
            console.log("request:"+JSON.stringify($scope.request));
            $scope.flight_request = {
                "start_date": "",
                "return_date":"",
                "adult_passengers":"val",
                "origin": "",
                "destination":"",
                "max_stops": 5,
                "max_price": 2,
                "max_price_currency":""
            };

            Flights.get_flights($scope.request)
                .success(function(results) {
                    console.log( results);
                    console.log(results.trips.tripOption);
                    $scope.results=results;
                })
                .error(function(err){
                    if (err["message"]="Request is invalid"){
                        console.log("err:"+ JSON.stringify(err));
                        var requirments="Requirments: \n";
                        for (ele in err.validation){
                            requirments+= "- " +(err.validation[ele].property).substring(9)+": "+err.validation[ele].message+"\n";
                        }
                        alert("Please put a valid request :). \n \n"+requirments);
                    }
                });
        };
    }]);
