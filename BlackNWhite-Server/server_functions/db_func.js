const mongoose = require('mongoose');
const Room = require("../schemas/room");
const express = require("express");
//===== Mongo DB ====
//MongoDB 연결
mongoose.connect('mongodb://localhost:27017/blacknWhite'); // 포트번호 뒤에 nodejs는 사용할 DB 이름 (현재는 nodejs DB를 사용)
var db = mongoose.connection;

// 연결 실패
db.on('error', function(){
    console.log('Connection Failed!');
});
// 연결 성공
db.once('open', function() {
    console.log('DB Connected!');
});

//==============================================================================
func = express();

// 방 생성 함수 
func.InsertRoom = function(roomData){
    console.log('INSERT Room 함수 호출');

    var newRoom = new Room(roomData);
    newRoom.save(function(error, data){
        if(error){
            console.log(error);
        }else{
            console.log('New Room Saved!');
        }
    });
}

// 유효한 방인지 확인하는  함수 
func.IsValidRoom = function(roomPin){
    console.log('IsValidRoom 함수 호출');

    return new Promise((resolve)=>{
        Room.find({roomPin: roomPin}, function(error, room){
            console.log('--- IsValidRoom ---');
            if(error){
                console.log(error);
          
            }else{
                // [ 여기 수정 필요]
                if (room.length != 0){
                    // console.log('room manager!! : ', room[0].manager);
                    resolve({permission : true, manager : room[0].manager });

                } else{
                    resolve({permission : false, manager : '' });
                }
            }
        });
    });
}

module.exports = func;
