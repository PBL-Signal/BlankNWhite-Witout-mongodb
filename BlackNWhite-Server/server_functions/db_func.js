const mongoose = require('mongoose');
const Test = require('../schemas/test');
// const Room = require("../schemas/room");
const ObjectId = require('mongodb').ObjectId;


//===== Mongo DB ====
//MongoDB 연결
mongoose.connect('mongodb://localhost:27017/BlackNWhite'); // 포트번호 뒤에 nodejs는 사용할 DB 이름 (현재는 nodejs DB를 사용)
var db = mongoose.connection;

// 연결 실패
db.on('error', function(){
    console.log('Connection Failed!');
});
// 연결 성공
db.once('open', function() {
    console.log('Connected!');
});
