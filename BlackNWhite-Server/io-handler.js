const url = require('url');
const async = require('async');
const func = require('./server_functions/db_func');
const { Socket } = require('dgram');
const { stringify } = require('querystring');

module.exports = (io) => {
    
    var gameserver = io.of("blacknwhite");
 
    var rooms ={};  // 여러 방 정보를 저장하는 딕셔너리
    var waitingQueue ={}; // 방 별로 관리되는 waiting queue
    let Players = [];
    let gamePlayer = {};
    let evenNumPlayer = false;
    let numPlayer = 1;

    
    
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


        // [MainHome] pin 번호 입력받아 현재 활성화된 방인지 검증함
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
        

        // [CreateRoom] 새 방을 만듦
        socket.on("createRoom", (room) =>{
            console.log('[socket-createRoom] 호출됨, 받은 room 정보 (maxPlayer): ', room);

            room['manager'] = socket.nickname;
            room['creationDate'] = nowDate();
            room['roomPin'] = randomN();

            
            console.log('수정 후 room INFO ', room);
            func.InsertRoom(room);

            // rooms[room.roomPin] = { 
            //     numUsers : 0,
            //     users : {},  //{socket.id : value팀정보}
            //     manager :  room.manager,
            //     blackUsers : [], // [ {}, ... ,] - {}는  playerInfo = { team: evenNumPlayer, readyStatus: false, teamStatus: false, color: rand_Color};
            //     whiteUsers : [] // 굳이 black/white 따로 구분한 이유는 unity에서 컴포넌트 연결 쉽고 빠르게 하기 위함
            // }

            rooms[room.roomPin] = { 
                numTotalUsers : 0,
                numBlackUsers : 0,
                numWhiteUsers : 0,
                users : {},  //{socket.id : { socket: socket.id, nickname: socket.nickname, team: evenNumPlayer, status: 0, color: rand_Color}}
                manager :  room.manager,
            }

            // waitingQueue[room.roomPin] ={
            //     toBlackUsers : [], // 사용자 고유 id(socket.id 저장) 
            //     toWhiteUsers: []
            // }

            waitingQueue[room.roomPin] ={
                toBlackUsers : [],  // 사용자 고유 id(socket.id 저장) 
                toWhiteUsers:  []
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

        // [WaitingRoom] 사용자 첫 입장 시 'add user' emit 
        socket.on('add user', () => {
            // console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', data.nickname, "data : ", data, 'room : ', data.room );
            // console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, "data : ", data, 'room : ', data.room );
            console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, 'room : ', socket.room );

            if (addedUser) return;

            var room = socket.room;
  
            // 룸 정보 수정
            // 새새 코드 
            // 1. users에 저장(닉네임 : 팀 정보)
            const rand_Color = Math.floor(Math.random() * 12);
       

            // 2. blackUsers/whiteUsers에 저장 (playerInfo 저장)
            let playerInfo = { socket: socket.id, nickname: socket.nickname, team: evenNumPlayer, status: 0, color: rand_Color};
            console.log("PlayersInfo : ", playerInfo);

            rooms[room].users[socket.id] = playerInfo;     // evenNumPlayer는 팀 정보

            if (evenNumPlayer){
                // 1(true)이면 white팀 팀 
                ++rooms[room].numWhiteUsers ;
            }else{
                // 0(false) 이면 black 팀 
                ++rooms[room].numBlackUsers  ;
            }
            ++rooms[room].numTotalUsers;

            console.log("[add user *] rooms[room].users : ", rooms[room].users);
            console.log("[add user *] rooms[room].numBlackUsers : ", rooms[room].numBlackUsers);
            console.log("[add user *] rooms[room].numWhiteUsers : ", rooms[room].numWhiteUsers);
            // console.log("[add user *]  blackUsers: " + rooms[room].blackUsers + " whiteUsers : " + rooms[room].whiteUsers);


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
                users : rooms[room].users
                // blackUsers : rooms[room].blackUsers,
                // whiteUsers : rooms[room].whiteUsers,
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
        //     io.sockets.in(room).emit('user joined', {
        //        nickname: socket.nickname,
        //        numUsers: rooms[room].numUsers,
        //        users : rooms[room].users
        //    });
            var playerJson = JSON.stringify(playerInfo);
        //    io.sockets.in(room).emit('user joined', playerJson);
           socket.broadcast.to(room).emit('user joined', playerJson);

        });
        

        // 새 코드
        // [WaitingRoom] status 변경 시 
        socket.on('changeReadyStatus',  (newStatus) =>{
            console.log('changeReadyStatus status : ', newStatus);
            
            // 1. 사용자 정보 수정 
            var playerInfo = rooms[socket.room].users[socket.id]; 
            playerInfo.status = newStatus;
            //console.log("PlayersInfo : ", playerInfo);

            rooms[socket.room].users[socket.id] = playerInfo;     // evenNumPlayer는 팀 정보
            //console.log("수정후! : ",  rooms[socket.room].users[socket.id]);

            // 2. 수정한 내용 client들에게 뿌리기
            var playerJson = JSON.stringify(playerInfo);

            console.log('check : ', playerJson);
            io.sockets.in(socket.room).emit('updateUI',playerJson);

        });

        // [WaitingRoom] profile 변경 시 
        socket.on('changeProfileColor',  (colorIndex) =>{
            console.log('changeProfileColor colorIndex : ', colorIndex);
            
            // 1. 사용자 정보 수정 
            var playerInfo = rooms[socket.room].users[socket.id]; 
            playerInfo.color = colorIndex;
            console.log("PlayersInfo : ", playerInfo);

            rooms[socket.room].users[socket.id] = playerInfo;     // evenNumPlayer는 팀 정보
            console.log("수정후! : ",  rooms[socket.room].users[socket.id]);

            // 2. 수정한 내용 client들에게 뿌리기
            var playerJson = JSON.stringify(playerInfo);

             console.log('check : ', playerJson);
            // io.sockets.in(socket.room).emit('updateUI',playerJson);
            socket.broadcast.to(socket.room).emit('updateUI', playerJson);

        });  



        // [WaitingRoom] teamChange 변경 시 
        socket.on('changeTeamStatus',  (changeStatus) =>{
            console.log('!!!!changeTeamStatus changeStatus : ', changeStatus);

            
             // 1. 사용자 정보 수정 
             var playerInfo = rooms[socket.room].users[socket.id]; 
             playerInfo.status = changeStatus;
             console.log("PlayersInfo : ", playerInfo);
 
             rooms[socket.room].users[socket.id] = playerInfo;     // evenNumPlayer는 팀 정보
             console.log("수정후! : ",  rooms[socket.room].users[socket.id]);
            

            var prevTeam = playerInfo.team; // 팀 바꾸기 전 현재 사용자 팀 정보

            // 2. status 상황에 따라 행동 다르게
            if (changeStatus == 0){     // 0이면 teamChange Off
                // 2-1. 수정한 내용 client들에게 뿌리기
                var playerJson = JSON.stringify(playerInfo);
                console.log('check : ', playerJson);
                socket.broadcast.to(socket.room).emit('updateUI', playerJson);
            }
            else if(changeStatus == 2){
                /*
                경우 2가지 : 
                    - 경우 1 : 다른 팀의 자리가 있어서 바로 변경 가능
                    - 경우 2 : full 상태라 1:1로 팀 change를 해야되는 상황 
                ! 추가 처리 사항 !
                    - 입장 시 random시 evenNumPlayer 따른 팀 자동 선택 변수 제어해야 될 듯
                */

                // 경우 1-1 : 현재 white 팀 -> black 가능한지 확인
                console.log("@rooms[socket.room].numBlackUsers : ", rooms[socket.room].numBlackUsers);
                console.log("@rooms[socket.room].numWhiteUsers : ", rooms[socket.room].numWhiteUsers);
                if (prevTeam == true && rooms[socket.room].numBlackUsers <4)
                {

                    // 1. room의 사용자 team 정보 바꾸기
                    // playerInfo.team = false;
                    console.log("[case1-1] PlayersInfo : ", playerInfo);
                    rooms[socket.room].users[socket.id].team = false;
                    rooms[socket.room].users[socket.id].status = 0; 
                    -- rooms[socket.room].numWhiteUsers ; 
                    ++ rooms[socket.room].numBlackUsers ; 

                    // 2. 바뀐 정보 클라쪽에 보내기
                    var teamChangeStatus = JSON.stringify(playerInfo);
                    console.log('check : ', teamChangeStatus);
                    io.sockets.in(socket.room).emit('updateTeamChange',teamChangeStatus);
                }

                // 경우 1-2 : 현재 black 팀 -> white 가능한지 확인
                if (prevTeam == false && rooms[socket.room].numWhiteUsers <4)
                {

                    // 1. room의 사용자 team 정보 바꾸기
                    // playerInfo.team = true;
                    console.log("[case1-2] PlayersInfo : ", playerInfo);
                    rooms[socket.room].users[socket.id].team = true;
                    rooms[socket.room].users[socket.id].status = 0;
                    ++ rooms[socket.room].numWhiteUsers ; 
                    -- rooms[socket.room].numBlackUsers ; 

                    // 2. 바뀐 정보 클라쪽에 보내기
                    var teamChangeStatus = JSON.stringify(playerInfo);
                    console.log('check : ', teamChangeStatus);
                    io.sockets.in(socket.room).emit('updateTeamChange',teamChangeStatus);
                }


                // 경우 2 : full 상태라 1:1로 팀 change를 해야되는 상황 
                // 과정 1 : 대기열 큐에 ADD
                if (rooms[socket.room].numWhiteUsers >= 4 && rooms[socket.room].numBlackUsers >= 4) // 꽉 찬 상황이면 queue에 저장 (조정 : if문 걍 없애도 될듯)
                {

                     // 1. 대기열에 저장 
                    if (prevTeam == false){ // 현재 black이니까 white 팀으로 변경하고자 함
                        waitingQueue[socket.room].toWhiteUsers.push(socket.id);
                    }
                    else{ // 현재 white이니까 black 팀으로 변경하고자 함
                        waitingQueue[socket.room].toBlackUsers.push(socket.id);
                    }

                     // 2. 매칭 하기
                    if (waitingQueue[socket.room].toBlackUsers.length > 0 && waitingQueue[socket.room].toWhiteUsers.length > 0 ){
                        var matchPlayer1Id = waitingQueue[socket.room].toBlackUsers.shift();
                        var matchPlayer2Id = waitingQueue[socket.room].toWhiteUsers.shift();
                        // var matchPlayerId = waitingQueue[room.roomPin].toWhiteUsers.Dequeue();

                        // 3. 변수 바꾸기 (numWhite, toBlackUsers, playerInfo)
                        console.log('변경전 rooms[socket.room].users[matchPlayer1Id] : ', rooms[socket.room].users[matchPlayer1Id].team);
                        console.log('변경전 rooms[socket.room].users[matchPlayer2Id] : ', rooms[socket.room].users[matchPlayer2Id].team);
                        rooms[socket.room].users[matchPlayer1Id].filter((user) => user.team = !user.team );
                        rooms[socket.room].users[matchPlayer2Id].filter((user) => user.team = !user.team );
                    


                        console.log('변경후 rooms[socket.room].users[matchPlayer1Id] : ', rooms[socket.room].users[matchPlayer1Id].team);
                        console.log('변경후 rooms[socket.room].users[matchPlayer2Id] : ', rooms[socket.room].users[matchPlayer2Id].team);
                    }
                }
            }
            
        });  

        // 게임 시작시 해당 룸의 사용자 정보 넘김
        socket.on('Game Start',  () =>{
            let dbTest = {
                roomPin : socket.room,
                team : true,
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
            func.SaveAttackList(dbTest);

            dbTest = {
                roomPin : socket.room,
                team : false,
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
            func.SaveAttackList(dbTest);

            // 영역 관련 DB 생성
            var sectionDB = {
                roomPin : socket.room,
                sectionInfo : []
            }
            func.InsertSection(sectionDB);

            var room_data = { 
                room : socket.room,
                users : rooms[socket.room].users
            };
            var roomJson = JSON.stringify(room_data);

            console.log('check : ', roomJson);
            io.sockets.in(socket.room).emit('onGameStart',roomJson);
        });
        
        // 무력화 test
        socket.on('TestNeutralization', function() {
            console.log("[On] TestNeutralization");
            console.log("[Emit] OnNeutralization");
            // io.sockets.in(socket.room).emit('OnNeutralization');
            var test = { 
                test : test
            };
            var testJson = JSON.stringify(test);
            socket.emit('OnNeutralization', testJson);
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
        
        // socket.on('changeStatus', function(jsonStr) {
        //     let changePlayerInfo = JSON.parse(jsonStr);        
    
        //     console.log('new Player info Jsong string : ', jsonStr);
        //     console.log('new Player info gamePlayer : ', changePlayerInfo);

        //     let playerNum = changePlayerInfo["playerNum"];
        //     let ready = (changePlayerInfo["readyStatus"] == 'True') ? true : false;
        //     let teamChange = (changePlayerInfo["teamStatus"] == 'True') ? true : false;

        //     gamePlayer.player[playerNum]["readyStatus"] = ready;
        //     gamePlayer.player[playerNum]["teamStatus"] = teamChange;

        //     console.log("new josn file : ", gamePlayer);

        //     var PlayersJson = JSON.stringify(gamePlayer);
        //     console.log("jsonStringify : ", PlayersJson.toString());
        //     socket.emit('PlayersData', PlayersJson);
        // });

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
            var loadInfo = {roomPin : socket.room, teamName : teamName};
            console.log("loadInfo json : ", loadInfo);

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
            let roomPin = socket.room;
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
        // ## [Section] 영역 클릭 시 
        socket.on('Section_Name', (data) => {
            console.log('[Section - Click Section] Click Area Info  : ', data);
            data = JSON.parse(data);

            var PIN = socket.room;
            console.log("[Section - Click Section] PIN : ", PIN);

            var corp = data.Corp;
            var areaName = data.area;

            // 해당 영역의 레벨을 DB에서 read
            func.SelectSectionLevel(PIN, corp, areaName).then(function (arr){
                var specific = arr[0];
                var index = arr[1];
                console.log("[SelectSectionLevel] before level >> ", specific[0].sectionInfo[index]);
                var selectedSectionInfo = specific[0].sectionInfo[index];
                //selectedSectionInfo = JSON.parse(selectedSectionInfo);
                var newLevel = {Corp: selectedSectionInfo.Corp, area: selectedSectionInfo.area, level: selectedSectionInfo.level+1, vuln: selectedSectionInfo.vuln};
                console.log("[SelectSectionLevel] after level >> ", newLevel);

                // 레벨 수정(1증가)
                func.UpdateSection(PIN, corp, areaName, selectedSectionInfo, newLevel);   
                var area_level = areaName + "-" + (selectedSectionInfo.level+1);
                socket.emit('New_Level', area_level.toString());
            });
        });

        // ## [Section] 구조도 페이지 시작 시
        socket.on('Section_Start', (cropName) => {
            console.log('[Section] Corp_Name  : ', cropName);
            var PIN = socket.room;
            console.log("[Section] PIN : ", PIN);

            func.SelectCrop(PIN, cropName).then(function (data){
               // console.log("[Section] Corp data >> ", data);

                for(var i=0; i<data.length; i++){
                    // console.log("[Section] sectionInfo-detail", data[i]);
                    socket.emit('Area_Start_Emit', JSON.stringify(data[i]));
                    
                }
            });
        });

        // ## [Vuln] 영역 클릭 시 
        socket.on('Get_Vuln', (data) => {
            console.log('[Vuln] Click Area_Name  : ', data);
            data = JSON.parse(data);
            var PIN = socket.room;
            var corp = data.Corp;
            var area = data.area;
            // 해당 영역의 취약점을 DB에서 read
            func.SelectSectionVuln(PIN, corp, area).then(function (data){
                socket.emit('Area_Vuln', data.area, data.vuln);
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

