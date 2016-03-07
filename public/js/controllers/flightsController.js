angular.module('flightsController', [])

    .controller('mainController', ['$scope','$http','Flights', function($scope, $http, Flights) {
        $scope.request = {
            "start_date": "2016-03-07",
            "return_date":"2016-03-17",
            "adult_passengers":2,
            "origin": "NYC",
            "destination":"LGA",
            "max_stops": 1,
            "max_price": 1000
        };
        $scope.get_flights = function() {
            console.log("request:"+JSON.stringify($scope.request));

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
