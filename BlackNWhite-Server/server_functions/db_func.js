const mongoose = require('mongoose');
const Room = require("../schemas/room");
const AttackList = require("../schemas/attackList");
const Area = require("../schemas/area");
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


// waitingRoom _ 방 정보 불러오기
func.loadRoom= function(roomPin){
    console.log('[db_func] loadRoom 함수 호출, roomPin : ', roomPin);
 
    return new Promise((resolve)=>{
        Room.find({roomPin: roomPin}, function(error, room){
            console.log('--- loadRoom ---');
            if(error){
                console.log(error);
            }else{
                resolve(room);
            }
        });
    });
}

// attack List db 저장
func.SaveAttackList = function(data){
    console.log('SaveAttackList 함수 호출');

    var newList = new AttackList(data);
    newList.save(function(error, data){
        if(error){
            console.log(error);
        }else{
            console.log('New AttackList Saved!');
        }
    });
}

// attack List 상태 불러오기
func.loadAttackList = function(loadInfo){    // loadInfo = {roomPin : "12345", teamName : teamName};
    console.log('[db_func] loadAttackList 함수 호출, settings : ', loadInfo.roomPin);
 
    return new Promise((resolve)=>{
        AttackList.find({roomPin: loadInfo.roomPin, team: loadInfo.teamName}, function(error, attackList){
            console.log('--- Read Attack List ---');
            if(error){
                console.log(error);
            }else{
                resolve(attackList[0]);
            }
        });
    });
}

func.upgradeAttackLevel = function(data){     // data = { roomPin : roomPin, beforeAttackLevel : beforeAttackLevel, newAttackLevel : newAttackLevel }
    console.log('[db_func] updateAttackLevel 함수 호출, settings : ', data);

    return new Promise((resolve)=>{
        AttackList.update({roomPin: data.roomPin, team: data.teamName, attackCard: data.beforeAttackLevel}, {'attackCard.$': data.newAttackLevel}, function(error, attackList){
            if(error){
                console.log(error);
          
            }else{
                console.log('[Attack List] Upgrade Attack Level Success');
                resolve(attackList);
            }
        });
    });
}


// Area 생성 함수 - 게임 시작 시 1번 실행
func.InsertArea = function(){
    console.log('InsertArea 함수 호출');

    
    const CorpArray = ["회사A", "회사B", "회사C", "회사D", "회사E"];
    const AreaArray = ["Area_DMZ", "Area_Interal", "Area_Sec"];

    var areaData;
    // i는 회사 수, j는 회사 별 영역 수
    for(var i=0; i<5; i++){
        for(var j=0; j<3; j++){
            areaData = {
                Corp : CorpArray[i],
                area : AreaArray[j],
                level : 0,
                vuln : parseInt(Math.random() * 4)
            };
            console.log(areaData);

            var newArea = new Area(areaData);
            newArea.save(function(error, data){
                if(error){
                    console.log(error);
                }else{
                    console.log('New Area Saved!');
                }
            });
        }
    }
}

// 전체 영역 정보 read
func.SelectCrop = function(corp){
    return new Promise((resolve)=>{
        Area.find({Corp: corp}, function(error, data){
            if(error){
                console.log(error);
          
            }else{
                resolve(data);
            }
        });
    });    
}

// 필요한 영역 정보 중 level만 read
func.SelectAreaLevel = function(corp, area){
    return new Promise((resolve)=>{
        Area.findOne({Corp: corp, area: area}, {_id: 0, level: 1}, function(error, data){
            if(error){
                console.log(error);
          
            }else{
                resolve(data);
            }
        });
    });    
}

// 필요한 영역 정보 중 vuln만 read
func.SelectAreaVuln = function(corp, area){
    return new Promise((resolve)=>{
        Area.findOne({Corp: corp, area: area}, {_id: 0, area: 1, vuln: 1}, function(error, data){
            if(error){
                console.log(error);
          
            }else{
                resolve(data);
            }
        });
    });    
}

// Area 정보 수정
func.UpdateArea = function(corp, area, data){
    console.log('[Area] UpdateArea 함수 호출');
    Area.updateOne({Corp: corp, area: area}, {$set: data}, function(error, data){
        if(error){
            console.log(error);
      
        }else{
            console.log('[Area] UpdateArea Success');
        }
    });
}

module.exports = func;
