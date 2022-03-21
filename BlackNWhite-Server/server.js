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


/*
///===== Mongo DB ====
// 1. 모듈 가져오기 (맨 위에 있음)
const Quiz = require('./schemas/quiz');
// 2. testDB 세팅
//mongoose.connect('mongodb://root:root@localhost:27017/nodejs');  // 포트번호 뒤에 nodejs는 사용할 DB 이름
mongoose.connect('mongodb://localhost:27017/nodejs'); // 포트번호 뒤에 nodejs는 사용할 DB 이름 (현재는 nodejs DB를 사용)
// 3. 연결된 DB 사용
var db = mongoose.connection;
// 4. 연결 실패
db.on('error', function(){
    console.log('Connection Failed!');
});
// 5. 연결 성공
db.once('open', function() {
    console.log('Connected!');
});
*/


