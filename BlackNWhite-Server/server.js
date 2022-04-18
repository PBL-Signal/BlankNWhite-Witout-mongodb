const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyPaser = require('body-parser');

const mongoose = require('mongoose');
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const options = {
    cors: true,
    origin: ['http://localhost:5000/blacknwhite/'],
};
const io = socketio(server, options);


const redis = require('redis')

const redisInfo = {
   host : '127.0.0.1',
   port : 6379,
   db : 0, // Redis에서 사용하는 DB 번호
}

const client = redis.createClient(redisInfo);
client.connect();

// Redis test 
client.set("key", "value", redis.print);
client.get("key", redis.print);

require('./io-handler')(io);

app.use(cors());
app.use(bodyPaser.json());
app.use(bodyPaser.urlencoded({extended: false}));
app.use(express.json());


server.listen(process.argv[2]);
console.log(process.argv[2] +' Server Started!! ');


