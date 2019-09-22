var express = require('express');
var router = express.Router();
let ModemHelper = require('../models/ModemHelper');

router.get('/status', function (req, res) {
    ModemHelper.getModemInfo(1)
        .then(
            data => renderPage(data, "OK", res),
            ([message, status]) => renderPage(message, status, res));
});

router.get('/status/:num', function (req, res) {
    ModemHelper.getModemInfo(req.params.num)
        .then(
            data => renderPage(data, "OK", res),
            ([message, status]) => renderPage(message, status, res));
});

router.get('/rebootModem', function (req, res) {
    ModemHelper.doReboot(1)
        .then(([message, status]) => renderPage(message, status, res));
});

router.get('/rebootModem/:num', function (req, res) {
    ModemHelper.doReboot(req.params.num)
        .then(([message, status]) => renderPage(message, status, res));
});

router.get('/toggleNetworkMode/:num', function (req, res) {
    ModemHelper.toggleNetworkMode(req.params.num)
        .then(([data, workMode, ip]) => renderPage(data, "OK", res, workMode, ip), data => renderPage(data, "ВСЕ ПЛОХО!", res));
});

let renderPage = function (message, status, res, workMode, ip) {
    if (workMode && ip) {
        res.render('index', {message: message, status: status, workMode: workMode, ip: ip});
    } else {
        res.render('index', {message: message, status: status});
    }
};

module.exports = router;
