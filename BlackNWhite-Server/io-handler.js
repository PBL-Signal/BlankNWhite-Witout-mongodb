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
        roomPin : "27031",
        team : "White",
        attackCard : [
            { activity : true, level : 1, time : 2, pita : 1 },
            { activity : false, level : 1, time : 2, pita : 1 },
            { activity : true, level : 1, time : 2, pita : 1 },
            { activity : true, level : 1, time : 2, pita : 1 },
            { activity : true, level : 1, time : 4, pita : 3 },
            { activity : true, level : 1, time : 4, pita : 3 },
            { activity : true, level : 1, time : 3, pita : 2 },
            { activity : true, level : 1, time : 6, pita : 4 },
            { activity : true, level : 1, time : 3, pita : 2 },
            { activity : true, level : 1, time : 3, pita : 2 },
            { activity : true, level : 1, time : 3, pita : 2 },
            { activity : true, level : 1, time : 9, pita : 5 },
            { activity : true, level : 1, time : 9, pita : 5 }
        ]
    };

    
    // func.SaveAttackList(dbTest);
    

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

                var roomJson = JSON.stringify(room_data);
                console.log('check : ', roomJson);
                socket.emit('room permission',roomJson);
            });  


        });
        

        // [CreateRoom]
        socket.on("createRoom", (room) =>{
            console.log('[socket-createRoom] 호출됨, 받은 room 정보: ', room);

            room['manager'] = socket.nickname;
            room['creationDate'] = nowDate();
            room['roomPin'] = randomN();

            
            console.log('수정 후 room INFO ', room);
            func.InsertRoom(room);

            rooms[room.roomPin] = { 
                numUsers : 0,
                users : [],
                manager :  room.manager
            }

            console.log("[createRoom] rooms 딕셔너리 : " , rooms);
            console.log("succesCreateRoom room.roomPin.toString() : " , room.roomPin.toString());
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

        socket.on('add user', (data) => {
            // console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', data.nickname, "data : ", data, 'room : ', data.room );
            console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, "data : ", data, 'room : ', data.room );

            if (addedUser) return;

            // socket.nickname = data.nickname;
            var room = data.room;
            socket.room = data.room;
            
        //    // 방 매니저가 아닌 경우에 rooms 리스트에 접속한 사용자 추가 (명수, 유저리스트)
        //    if (data.nickname != data.manager)
        //    {
        //        ++rooms[room].numUsers;
        //        rooms[room].users.push(socket.nickname); 
        //    }

        //    console.log("[add user *] : " + socket.nickname  + " room : " + rooms[room]);

            socket.join(room);
            addedUser = true;

        //    // Room 정보 전달 
        //    func.loadRoom(data.room).then(function (room){
        //        console.log('[socket-loadRoom] room:',room);
        //        socket.emit('loadRoom',room);
        //        console.log('룸 정보 전송 완료');
        //    });


            // 사용자 로그인 알림
        //    io.in(room).emit('login', {
        //        numUsers: rooms[room].numUsers,
        //        users : rooms[room].users
        //    });

            
            // 새 사용자 입장 알림 
        //    gameserver.in(room).emit('user joined', {
        //        nickname: socket.nickname,
        //        numUsers: rooms[room].numUsers,
        //        users : rooms[room].users
        //    });

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
            console.log("gmaePlayer >> ", gamePlayer);

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
        socket.on("Penetration Test", function(){

            func.loadAttackList("27031").then(function (attackList){
                console.log('[socket-loadAttackList] attak list[0] : ', attackList);
                console.log('[socket-loadAttackList] attak list[0] : ', attackList[0]);
                
                var AttackTableJson = JSON.stringify(attackList[0]);

                console.log('[socket-loadAttackList] attak list : ', AttackTableJson);
                socket.emit("Attack List", AttackTableJson);
            });
        });

        socket.on("Click Response", function(data){
            console.log("Click Response jsonStr : ", data);
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

