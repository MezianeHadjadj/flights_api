angular.module('flightsService', [])

    .factory('Flights', ['$http',function($http) {

        return {
            get_flights : function(flight_request) {
                return $http.post('/api/flights/list', flight_request);
            }
        }
    }]);