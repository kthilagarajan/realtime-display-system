const express = require('express');
const app = express();
const server = require('http').Server(app)
const io = require('socket.io')(server);
const bodyParser = require('body-parser')
const path = require('path');
const _ = require('lodash');
const moment = require('moment');
const Geo = require('geo-nearby');
const jwt = require('jsonwebtoken');
const port = 2020;
const SECRET = "$INDIAN_RAILWAYS_2020$";
const APP_NAME = "RAILWAYS";

const stations = require('./dataset/stations-formatted.json');
const stationCompactSet = Geo.createCompactSet(stations, { id: ['code'], name: ['name'] });
const stationsGeo = new Geo(stationCompactSet, { sorted: true });

const trains = require('./dataset/trains.json');
const schedules = require('./dataset/schedules.json');

let connectedClients = 0;

app.use(bodyParser.json());
app.use('/', express.static(path.join(__dirname, "/static")));
app.get('/ping', (req, res) => {
    res.send('** Indian Railways API **')
});

io.use(function (socket, next) {
    if (socket.handshake.query && socket.handshake.query.token) {
        jwt.verify(socket.handshake.query.token, SECRET, function (err, decoded) {
            if (err) return next(new Error('Authentication error'));
            if (decoded && decoded.app != APP_NAME) {
                return next(new Error('Authentication error'));
            }
            next();
        });
    } else {
        next(new Error('Authentication error'));
    }
})

server.listen(port, () => console.log(`listening on port ${port}!`))

function isVaidUser(req, res, next) {
    let isValid = true;
    if (req.headers.token) {
        let data = jwt.verify(req.headers.token, SECRET);
        if (data && data.app != APP_NAME) {
            isValid = false;
        }
    } else {
        isValid = false;
    }
    if (!isValid) {
        res.status(401).send("Unauthorized");
        return;
    }
    next();
}

app.post('/token', (req, res) => {
    var token = jwt.sign({ app: 'RAILWAYS' }, SECRET);
    let response = {
        status: 200,
        token
    };
    res.send(response)
})

app.post('/stations', isVaidUser, (req, res) => {
    let [lat, long] = [req.body.lat, req.body.long];
    let response = {
        status: 200,
        data: []
    }
    if (lat && long) {
        let stations = stationsGeo.nearBy(lat, long, 25000) // 5 KM
        let data = _.map(stations, (f) => {
            return {
                code: f.i,
                name: f.name
            };
        })
        response.data = _.sortBy(data, "name")
    } else {
        let data = _.map(stations.features, (f) => {
            return {
                code: f.properties.code,
                name: f.properties.name
            };
        });
        response.data = _.sortBy(data, "name")
    }
    res.send(response)
});

app.get('/trains/:code', isVaidUser, (req, res) => {
    let code = req.params.code;
    let response = {
        status: 200,
        data: []
    }
    if (code) {
        let result = (trains.from[code] || []).concat(trains.to[code] || [])
        response.data = _.sortBy(result, "departure");
    } else {
        response.status(404);
    }
    res.send(response)
});

app.post('/:code/train/status', isVaidUser, (req, res) => {
    let code = req.params.code;
    let response = {
        status: 200,
        data: []
    }
    let currentTime = moment().utcOffset("+05:30").format("HH:mm:ss")
    // .format("HH:mm:ss")
    for (let type of ["from", "to"]) {
        let scheduledTrains = trains[type][code] || [];
        for (let t of scheduledTrains) {
            let message = ``
            for (let s of schedules[t.number]) {
                let diff = moment.duration(moment(currentTime, "HH:mm:ss").diff(moment(s.departure, "HH:mm:ss")))
                    .asMinutes()
                message = `At ${s.station_name} [${s.station_code}]`
                let arrivalDiff = moment.duration(moment(currentTime, "HH:mm:ss").diff(moment(s.arrival, "HH:mm:ss")))
                    .asMinutes()
                if (arrivalDiff < 0 && arrivalDiff + 3 < 0) {
                    message = `Upcoming ${s.station_name} [${s.station_code}]`
                }
                if (diff < 0) {
                    break;
                }
            }
            io.sockets.emit(code, {
                trainNo: t.number,
                message
            })
        }
    }
    res.send(response)
});

io.on('connection', client => {
    // console.log(`Connected ${client.id}`)
    connectedClients++;
    console.log("Connected Clients : " + connectedClients)
    client.on('disconnect', () => {
        // console.log(`Disconnected ${client.id}`)
        connectedClients--;
    });
});
