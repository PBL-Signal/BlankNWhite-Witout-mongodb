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

require('./io-handler')(io);

app.use(cors());
app.use(bodyPaser.json());
app.use(bodyPaser.urlencoded({extended: false}));
app.use(express.json());


server.listen(process.argv[2]);
console.log(process.argv[2] +' Server Started!! ');


