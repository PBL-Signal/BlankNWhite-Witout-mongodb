const url = require('url');
const async = require('async');
const func = require('./server_functions/db_func');
const { Socket } = require('dgram');
const { stringify } = require('querystring');

module.exports = (io) => {
    
    var gameserver = io.of("blacknwhite");
 
    var rooms ={}; 
    let Players = [];
    let gamePlayer = {};
    let evenNumPlayer = false;
    let numPlayer = 1;

    
    let dbTest = {
        roomPin : "12345",
        team : "Black",
        attackCard : [
            { attackNum : 0, activity : false, level : 0 },
            { attackNum : 1, activity : false, level : 0 },
            { attackNum : 2, activity : false, level : 0 },
            { attackNum : 3, activity : false, level : 0 },
            { attackNum : 4, activity : false, level : 0 },
            { attackNum : 5, activity : false, level : 0 },
            { attackNum : 6, activity : false, level : 0 },
            { attackNum : 7, activity : false, level : 0 },
            { attackNum : 8, activity : false, level : 0 },
            { attackNum : 9, activity : false, level : 0 },
            { attackNum : 10, activity : false, level : 0 },
            { attackNum : 11, activity : false, level : 0 },
            { attackNum : 12, activity : false, level : 0 }
        ]
    };

    
    // func.SaveAttackList(dbTest);
    // func.InsertArea();
    

    io.on('connection', (socket) => {
        console.log("io-handler.js socket connect!!");
        console.log("socketid : "+ socket.id); 
     
        // [StartMain] 닉네임 입력 시 
        socket.on('join', (data) => {
            console.log('[join] data.nickname  : ', data.nickname);
            socket.nickname = data.nickname;
        });


        // [MainHome]
        socket.on("isValidRoom", (room) => {
            console.log('[socket-isValidRoom] room:',room);

            func.IsValidRoom(room).then(function (data){
                console.log('[socket-IsValidRoom-Then] permission:',data, room);

                var room_data = { 
                    permission: data.permission.toString(),
                    manager : data.manager.toString(),
                    room: room
                };

                if (data.permission) {
                    console.log("permission True");
                    socket.room = room;
                    console.log("socket.room : ", socket.room);
                }

                var roomJson = JSON.stringify(room_data);
                console.log('check : ', roomJson);
                socket.emit('room permission',roomJson);
            });  


        });
        

        // [CreateRoom]
        socket.on("createRoom", (room) =>{
            console.log('[socket-createRoom] 호출됨, 받은 room 정보 (maxPlayer): ', room);

            room['manager'] = socket.nickname;
            room['creationDate'] = nowDate();
            room['roomPin'] = randomN();

            
            console.log('수정 후 room INFO ', room);
            func.InsertRoom(room);

            rooms[room.roomPin] = { 
                numUsers : 0,
                users : {},  //{key닉네임: value팀정보}
                manager :  room.manager,
                blackUsers : [], // [ {}, ... ,] - {}는  playerInfo = { team: evenNumPlayer, readyStatus: false, teamStatus: false, color: rand_Color};
                whiteUsers : []
            }

            console.log("[createRoom] rooms 딕셔너리 : " , rooms);
            console.log("succesCreateRoom room.roomPin.toString() : " , room.roomPin.toString());

            // 추가 
            socket.room = room.roomPin;
            console.log("socket.room : ", socket.room);

            socket.emit('succesCreateRoom', {
                roomPin: room.roomPin.toString()
            });
            
            // var room_data = { 
            //     roomPin: room.roomPin.toString()
            // };
            // var roomJson = JSON.stringify(room_data);
            //     console.log('check : ', roomJson);
            //     socket.emit('succesCreateRoom',roomJson);
        });

        // [WaitingRoom] 
        let addedUser = false; // added 유저 경우 

        // 사용자 첫 입장 시 'add user' emit 
        socket.on('add user', () => {
            // console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', data.nickname, "data : ", data, 'room : ', data.room );
            // console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, "data : ", data, 'room : ', data.room );
            console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, 'room : ', socket.room );

            if (addedUser) return;

            var room = socket.room;
  
            // 룸 정보 수정 
            ++rooms[room].numUsers;

            // 새새 코드 
            // 1. users에 저장(닉네임 : 팀 정보)
            const rand_Color = Math.floor(Math.random() * 12);
            rooms[room].users[socket.nickname] = evenNumPlayer;     // evenNumPlayer는 팀 정보


            // 2. blackUsers/whiteUsers에 저장 (playerInfo 저장)
            let playerInfo = { socket: socket.id, nickname: socket.nickname, team: evenNumPlayer, readyStatus: false, teamStatus: false, color: rand_Color};
            console.log("PlayersInfo : ", playerInfo);

            if (evenNumPlayer){
                // 1(true)이면 black 팀 
                rooms[room].blackUsers.push(playerInfo);
            }else{
                // 0(false) 이면 white팀 
                rooms[room].whiteUsers.push(playerInfo);
            }

            console.log("rooms[room].users : ", rooms[room].users);
            console.log("[add user *]  blackUsers: " + rooms[room].blackUsers + " whiteUsers : " + rooms[room].whiteUsers);


           // 다음 플레이어 black과 white 팀 입장 구분을 위해 둠
            if (evenNumPlayer == false){
                evenNumPlayer = true;
            } else {
                evenNumPlayer = false;
            }

            
            // JSON 형식으로 유니티에 데이터 보내기

            // var PlayersJson = JSON.stringify(gamePlayer);
            // console.log("jsonStringify : ", PlayersJson.toString());
            // socket.emit('PlayersData', PlayersJson);

            // 원래 코드 
            socket.join(room);
            addedUser = true;

           // Room 정보 전달 
        //    func.loadRoom(socket.room).then(function (room){
        //         console.log('[socket-loadRoom] room:',room);
        //         socket.emit('loadRoom',room);
        //         console.log('룸 정보 전송 완료');
        //     });

            // 사용자 로그인 알림 (모든 사용자의 정보를 push함) 
              var room_data = { 
                room : room,
                blackUsers : rooms[room].blackUsers,
                whiteUsers : rooms[room].whiteUsers,
            };
            var roomJson = JSON.stringify(room_data);

            console.log('check : ', roomJson);
            io.sockets.in(room).emit('login',roomJson);

        //    io.sockets.in(room).emit('login', {
           
        //        room : room,
        //         blackUsers : rooms[room].blackUsers,
        //         whiteUsers : rooms[room].whiteUsers,
        //    }); 

            
            // 새 사용자가 입장하였음을 다른 사용자들에게 알림 (새로 온 사용자 정보만 push함) 
        //    gameserver.in(room).emit('user joined', {
            io.sockets.in(room).emit('user joined', {
               nickname: socket.nickname,
               numUsers: rooms[room].numUsers,
               users : rooms[room].users
           });

        });
    
           


        ////////////////////////////////////////////////////////////////////////////////////
        // PlayerEnter
        socket.on('PlayerEnter', function() {
            console.log("Players >> ");
            const rand_Color = Math.floor(Math.random() * 12);
            // eval("Players.player" + numPlayer + " = playerInfo")
            let playerOrder = "player" + numPlayer;
            let playerInfo = {playerOrder: playerOrder, socket: socket.id, nickname: socket.nickname, readyStatus: false, teamStatus: false, team: evenNumPlayer, color: rand_Color};
            Players.push(playerInfo);
            gamePlayer.player = Players;
            // Players[Players.length]=playerInfo;
            console.log("PlayersInfo", numPlayer, " >> ", playerInfo);
            console.log("Players >> ", Players);
            console.log("gamePlayer >> ", gamePlayer);

            if (evenNumPlayer == false){
                evenNumPlayer = true;
            } else {
                evenNumPlayer = false;
            }

            numPlayer = numPlayer + 1;
            
            // JSON 형식으로 유니티에 데이터 보내기

            var PlayersJson = JSON.stringify(gamePlayer);
            console.log("jsonStringify : ", PlayersJson.toString());
            socket.emit('PlayersData', PlayersJson);
        });
        
        socket.on('changeStatus', function(jsonStr) {
            let changePlayerInfo = JSON.parse(jsonStr);        
    
            console.log('new Player info Jsong string : ', jsonStr);
            console.log('new Player info gamePlayer : ', changePlayerInfo);

            let playerNum = changePlayerInfo["playerNum"];
            let ready = (changePlayerInfo["readyStatus"] == 'True') ? true : false;
            let teamChange = (changePlayerInfo["teamStatus"] == 'True') ? true : false;

            gamePlayer.player[playerNum]["readyStatus"] = ready;
            gamePlayer.player[playerNum]["teamStatus"] = teamChange;

            console.log("new josn file : ", gamePlayer);

            var PlayersJson = JSON.stringify(gamePlayer);
            console.log("jsonStringify : ", PlayersJson.toString());
            socket.emit('PlayersData', PlayersJson);
        });

        socket.on('changeColor', function(jsonStr) {
            let changePlayerInfo = JSON.parse(jsonStr);

            console.log('new Player info Jsong string : ', jsonStr);
            console.log('new Player info gamePlayer : ', changePlayerInfo);

            let playerNum = changePlayerInfo["playerNum"];
            let colorNum = changePlayerInfo["value"];

            gamePlayer.player[playerNum]["color"] = colorNum;

            console.log("new josn file : ", gamePlayer);

            var PlayersJson = JSON.stringify(gamePlayer);
            console.log("jsonStringify : ", PlayersJson.toString());
            socket.emit('PlayersData', PlayersJson);
        });

        // 게임 카드 리스트 보내기
        socket.on("Load Attack List", function(teamName){
            var loadInfo = {roomPin : "12345", teamName : teamName};

            // 나중에 실제 입력한 pin 번호로 바꾸기!
            func.loadAttackList(loadInfo).then(function (attackList){
                console.log('[socket-loadAttackList] attak list[0] : ', attackList);
                
                var AttackTableJson = JSON.stringify(attackList);

                console.log('[socket-loadAttackList] attak list : ', AttackTableJson);
                socket.emit("Attack List", AttackTableJson);
            });
        });

        socket.on("Click Response", function(data){
            console.log("Click Response jsonStr : ", data);
        });


        socket.on("Click Upgrade Attack", function(jsonStr){
            console.log("Click Upgrade Attacke jsonStr : ", jsonStr);
            let upgradeAttackInfo = JSON.parse(jsonStr);
            console.log('[socket-loadAttackList] upgrade Attack Info : ', upgradeAttackInfo);
            let attackIndex = upgradeAttackInfo["AttackIndex"];
            let roomPin = upgradeAttackInfo["RoomPin"];
            let team = upgradeAttackInfo["team"];
            var loadInfo = {roomPin : roomPin, teamName : team};

            func.loadAttackList(loadInfo).then(function (attackList){
                var attackActivity = attackList["attackCard"][attackIndex]["activity"];
                var attackLevel = attackList["attackCard"][attackIndex]["level"];
                console.log('[socket-loadAttackList] attackList["attackCard"][AttackIndex]["level"] : ', attackLevel);

                var beforeAttackLevel = { attackNum: attackIndex, activity: attackActivity, level: attackLevel };
                var newAttackLevel = { attackNum: attackIndex, activity: true, level: attackLevel+1 };
                var upgradeDataJson = { roomPin : roomPin, teamName: team, beforeAttackLevel : beforeAttackLevel, newAttackLevel : newAttackLevel };
                
                func.upgradeAttackLevel(upgradeDataJson).then(function(updateDBInfo){
                    console.log('[socket-loadAttackList] attackList : ', updateDBInfo);

                    if (updateDBInfo["acknowledged"]){
                        func.loadAttackList(loadInfo).then(function (attackList){
                            console.log('[socket-loadAttackList] attak list[0] : ', attackList);
                            
                            var AttackTableJson = JSON.stringify(attackList);

                            console.log('[socket-loadAttackList] attak list : ', AttackTableJson);
                            socket.emit("Attack List", AttackTableJson);
                        });
                    } else {
                        console.log('upgradeAttackLevel Failed');
                    }
                });

                // socket.emit("Attack List", AttackTableJson);
            });

            // roompin이랑 attack index 번호를 json 형식으로 보낼 것 { roomPin : roomPin, attackIndex : attackIndex }
            

        });


// ===================================================================================================================
        // [Area] 영역 클릭 시 
        socket.on('Area_Name', (areaName) => {
            console.log('[Area] Area_Name  : ', areaName);

            var corp = "회사B"
            // 해당 영역의 레벨을 DB에서 read
            func.SelectAreaField(corp, areaName, "level").then(function (data){
                console.log("[Area] before level >> ", data);
                var newLevel = {level: data.level+1};
                console.log("[Area] after level >> ", newLevel);

                // 레벨 수정(1증가)
                func.UpdateArea(corp, areaName, newLevel);   
                var area_level = areaName + "-" + (data.level+1);
                console.log("Before Split >> ", area_level.toString())
                socket.emit('New_Level', area_level.toString());
            });
        });

        // [Area] 구조도 페이지 시작 시
        socket.on('Area_Start', (cropName) => {
            console.log('[Area] Corp_Name  : ', cropName);
            func.SelectCrop(cropName).then(function (data){
                console.log("[Area] Corp data >> ", data);
                

                for(var i=0; i<data.length; i++){
                    // console.log("[Area] Corp data *********** >> ", data[i]);
                    socket.emit('Area_Start_Emit', JSON.stringify(data[i]));
                    //socket.emit('Area_Start_Emit', data[i]);
                }
                
            });
            
        });
// ===================================================================================================================
        
        socket.on('disconnect', function() {
            console.log('A Player disconnected!!!');
        });
    })

    function randomN(){
        var randomNum = {};
        //0~9까지의 난수
    
        randomNum.random = function(n1, n2) {
            return parseInt(Math.random() * (n2 -n1 +1)) + n1;
        };
    
        var value = "";
        for(var i=0; i<5; i++){
            value += randomNum.random(0,9);
        }
        return value;
        
    };


    function nowDate(){
        var today = new Date();
        var year = today.getFullYear();
        var month = ('0' + (today.getMonth() + 1)).slice(-2);
        var day = ('0' + today.getDate()).slice(-2);
        
        var today = new Date();   
        var hours = ('0' + today.getHours()).slice(-2); 
        var minutes = ('0' + today.getMinutes()).slice(-2);
        var seconds = ('0' + today.getSeconds()).slice(-2); 
        
        var dateString = year + '-' + month  + '-' + day;
        var timeString = hours + ':' + minutes  + ':' + seconds;
    
        var now_date = dateString + " " + timeString;
        return now_date;
    };
}

