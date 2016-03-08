angular.module('flightsController', [])

    .controller('mainController', ['$scope','$http','Flights', function($scope, $http, Flights) {
        $scope.loading=false;
        $scope.results={};
        $scope.get_flights = function() {
            console.log("request:"+JSON.stringify($scope.request));
            $scope.loading=true;
            Flights.get_flights($scope.request)
                .success(function(results) {
                    console.log( results);
                    $scope.loading=false;
                    if(!("trips" in results) ){
                        alert("Sorry, there are no result matching your search request.");
                    }else if(!("tripOption" in results.trips)) {
                        alert("Sorry, there are no result matching your search request.");
                    }
                    console.log(results.trips.tripOption);
                    $scope.results=results;
                })
                .error(function(err){
                    $scope.loading=false;
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
