angular.module('flightsService', [])

    .factory('Flights', ['$http',function($http) {

        return {
            get_flights : function() {
                return $http.get('/api/flights/list');
            }
        }
    }]);