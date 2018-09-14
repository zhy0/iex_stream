const url = 'https://ws-api.iextrading.com/1.0/last';
const Influx = require('influx');
const socket = require('socket.io-client')(url);
const Queue = require('better-queue');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console()
    ]
});

const influx = new Influx.InfluxDB({
    host: 'influxdb',
    database: 'trades',
    schema: [
        {
            measurement: 'trades',
            fields: {
                price: Influx.FieldType.FLOAT,
                size: Influx.FieldType.INTEGER,
            },
            tags: ['symbol']
        }
    ]
});

function insert(data, cb) {
    influx.writePoints(data);
    cb(null, result);
}

var q = new Queue(insert, {
    batchSize: 500,
    batchDelay: 5000,
    batchDelayTimeout: 1000
});

influx.getDatabaseNames()
    .catch(error => {
        logger.error(error);
        process.exit(1);
    })
    .then(names => {
        if (!names.includes('trades')) {
            return influx.createDatabase('trades');
        }
    })
    .then(() => {
        socket.on('connect', () => {
            socket.emit('subscribe', 'firehose');
        });

        socket.on('message', message => {
            var obj = JSON.parse(message);
            if (obj.time != 0 && obj.size != 0) {
                q.push({
                    measurement: 'trades',
                    tags: { symbol: obj.symbol },
                    fields: {
                        price: obj.price,
                        size: obj.size,
                    },
                    timestamp: new Date(obj.time)
                });
            }
        });
    });
