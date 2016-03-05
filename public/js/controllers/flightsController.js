angular.module('flightsController', [])

    .controller('mainController', ['$scope','$http','Flights', function($scope, $http, Flights) {

        $scope.get_flights = function() {
            console.log("request:"+$scope.request);
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
                .success(function(data) {
                    console.log(data)
                    $scope.results=JSON.parse(data)
                })
                .error(function(err){
                    if (err["message"]="Request is invalid"){
                        alert("Please put a valide request :)");
                    }
                });
        };
    }]);
