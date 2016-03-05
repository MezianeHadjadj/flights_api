

module.exports = exports = function(app) {
    app.get('/api/flights/list', exports.list)
}



exports.list =  function (req, res) {
    console.log(JSON.stringify(req.body));
       if (!req.app.validate(req.body, 'flight_validate', res)) return
    res.json({"flights":"results"});

};

