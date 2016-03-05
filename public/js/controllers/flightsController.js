angular.module('flightsController', [])

    .controller('mainController', ['$scope','$http','Flights', function($scope, $http, Flights) {

        $scope.get_flights = function() {
            Flights.get_flights($scope.formData)
                .success(function(data) {
                    console.log(data)
                })
                .error(function(err){
                    if (err["message"]="Request is invalid"){
                        alert("Please put a valide request :)");
                    }
                });
        };
    }]);
