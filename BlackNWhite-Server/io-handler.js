const url = require('url');
const async = require('async');
const func = require('./server_functions/db_func');
const { Socket } = require('dgram');
const { stringify } = require('querystring');

const Redis = require("ioredis"); 
const redisClient = new Redis();
const { RedisSessionStore } = require("./sessionStore");
const sessionStore = new RedisSessionStore(redisClient);

const crypto = require("crypto");
const randomId = () => crypto.randomBytes(8).toString("hex");

module.exports = (io) => {
    
    var gameserver = io.of("blacknwhite");
 
    var rooms ={};  // 여러 방 정보를 저장하는 딕셔너리
    var userPlacement ={}; // # WaitingRoom TeamChange 및 UI 배치 관련 정보 저장
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

            sessionStore.saveSession("socket.sessionID", {
                userID: "random123",
                username: "socket.username",
                connected: true
            });
              
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

            rooms[room.roomPin] = { 
                numTotalUsers : 0,
                numBlackUsers : 0,
                numWhiteUsers : 0,
                users : {},  //{socket.id : { socket: socket.id, nickname: socket.nickname, team: evenNumPlayer, status: 0, color: rand_Color}}
                manager :  room.manager,
            }

            userPlacement[room.roomPin] ={
                blackPlacement : [4,3,2,1], // Unity 자리 위치 할당 관리 큐
                whitePlacement : [4,3,2,1],
                toBlackUsers : [], // teamChange 대기 큐(사용자 고유 id 저장)
                toWhiteUsers:  []
            }

            console.log("[createRoom] rooms 딕셔너리 : " , rooms);
            console.log("[createRoom] userPlacement Info : " , userPlacement);
            console.log("succesCreateRoom room.roomPin.toString() : " , room.roomPin.toString());

            socket.room = room.roomPin;
            console.log("socket.room : ", socket.room);

            socket.emit('succesCreateRoom', {
                roomPin: room.roomPin.toString()
            });
        
        });



        // [WaitingRoom] 
        let addedUser = false; // added 유저 경우 

        // [WaitingRoom] UI player 대응 컴포넌트 idx 할당
        function PlaceUser(team){
            // ++rooms[socket.room].numTotalUsers; // 여기서 쓰면 안될 것 같음
            
            if(!team){ //false(0)면 black  
                // ++rooms[socket.room].numBlackUsers  ;
                console.log("userPlacement blackPlacement.length" , userPlacement[socket.room].blackPlacement);
                return userPlacement[socket.room].blackPlacement.pop();
            }else{
                // ++rooms[socket.room].numWhiteUsers ;
                console.log("userPlacement whitePlacement.length" , userPlacement[socket.room].whitePlacement);
                return userPlacement[socket.room].whitePlacement.pop();
            }
        }

        // [WaitingRoom] UI player 대응 컴포넌트 idx 제거
        function DeplaceUser(prevTeam, idx){
            console.log("DeplaceUser idx ! : " ,idx , "team : " , prevTeam);

            if(!prevTeam){ // false(0) 면 black팀
                // blackPlayerIdx.Enqueue(idx);
                userPlacement[socket.room].blackPlacement.push(idx);
                console.log("$$DeplaceUser blackPlacement.length" ,userPlacement[socket.room].blackPlacement);
            }else{
                // whitePlayerIdx.Enqueue(idx);
                userPlacement[socket.room].whitePlacement.push(idx);
                console.log("$$DeplaceUser whitePlacement.length" , userPlacement[socket.room].whitePlacement);
            }
        }

        // [WaitingRoom] 팀 배정
        function SetTeam(){
            console.log("SetTeam room: " ,socket.room, rooms[socket.room].numBlackUsers, rooms[socket.room].numWhiteUsers);
            
            ++rooms[socket.room].numTotalUsers;
            if (rooms[socket.room].numBlackUsers > rooms[socket.room].numWhiteUsers){
                ++rooms[socket.room].numWhiteUsers ;
                return true
            }else{
                ++rooms[socket.room].numBlackUsers  ;
                return false
            }
            
        }


        // [WaitingRoom] 사용자 첫 입장 시 'add user' emit 
        socket.on('add user', () => {
        
            console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, 'room : ', socket.room );

            if (addedUser) return;

            var room = socket.room;
  
            // 1. users에 저장(닉네임 : 팀 정보)
            const rand_Color = Math.floor(Math.random() * 12);
       
            // 2. blackUsers/whiteUsers에 저장 (playerInfo 저장)
            var team = SetTeam();
            let playerInfo = { socket: socket.id, nickname: socket.nickname, team: team, status: 0, color: rand_Color, place : PlaceUser(team) };
            console.log("PlayersInfo : ", playerInfo);

            rooms[room].users[socket.id] = playerInfo;     // evenNumPlayer는 팀 정보

            // if (team){
            //     // 1(true)이면 white팀 팀 
            //     ++rooms[room].numWhiteUsers ;
            // }else{
            //     // 0(false) 이면 black 팀 
            //     ++rooms[room].numBlackUsers  ;
            // }
            // ++rooms[room].numTotalUsers;

            console.log("[add user *] rooms[room].users : ", rooms[room].users);
            console.log("[add user *] rooms[room].numBlackUsers : ", rooms[room].numBlackUsers);
            console.log("[add user *] rooms[room].numWhiteUsers : ", rooms[room].numWhiteUsers);
            // console.log("[add user *]  blackUsers: " + rooms[room].blackUsers + " whiteUsers : " + rooms[room].whiteUsers);

            console.log("#### blackPlacement" , userPlacement[socket.room].blackPlacement);
            console.log("#### whitePlacement" , userPlacement[socket.room].whitePlacement);



        //    // 다음 플레이어 black과 white 팀 입장 구분을 위해 둠
        //     if (evenNumPlayer == false){
        //         evenNumPlayer = true;
        //     } else {
        //         evenNumPlayer = false;
        //     }

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
            };
            var roomJson = JSON.stringify(room_data);

            console.log('check roomJson : ', roomJson);
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

            console.log('check playerJson : ', playerJson);
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
            var prevPlace = playerInfo.place;

            // 2. status 상황에 따라 행동 다르게
            // 0이면 teamChange Off
            if (changeStatus == 0){     
                // 2-1. 수정한 내용 client들에게 뿌리기
                var playerJson = JSON.stringify(playerInfo);
                console.log('check : ', playerJson);
                socket.broadcast.to(socket.room).emit('updateUI', playerJson);
            }
            // 2이면 teamChange On
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

                if ((prevTeam == true && rooms[socket.room].numBlackUsers <4) || (prevTeam == false && rooms[socket.room].numWhiteUsers <4))
                {

        
                    
                    // 1. room의 사용자 team 정보 바꾸기
                    // playerInfo.team = false;
                    console.log("[case1] PlayersInfo : ", playerInfo);
                    rooms[socket.room].users[socket.id].team = !prevTeam;
                    rooms[socket.room].users[socket.id].status = 0; 

                    // UI 위치 할당
                    DeplaceUser(prevTeam, prevPlace);
                    rooms[socket.room].users[socket.id].place = PlaceUser(!prevTeam);
                 
                    if(prevTeam){ // white팀이면
                        -- rooms[socket.room].numWhiteUsers ; 
                        ++ rooms[socket.room].numBlackUsers ; 
                    }else{
                        // black팀이면
                        ++ rooms[socket.room].numWhiteUsers ; 
                        -- rooms[socket.room].numBlackUsers ; 
                    }


                    console.log("####!! blackPlacement" , userPlacement[socket.room].blackPlacement);
                    console.log("####!! whitePlacement" , userPlacement[socket.room].whitePlacement);

                    // 2. 바뀐 정보 클라쪽에 보내기
                    var changeInfo = { 
                        type : 1,
                        // player1 : playerInfo, // 이전 
                        player1 : rooms[socket.room].users[socket.id]  // 수정 후
                    };

                    var teamChangeInfo = JSON.stringify(changeInfo);
                    console.log('check : ', teamChangeInfo);
                    io.sockets.in(socket.room).emit('updateTeamChange',teamChangeInfo);



                    // // 1. room의 사용자 team 정보 바꾸기
                    // // playerInfo.team = false;
                    // console.log("[case1-1] PlayersInfo : ", playerInfo);
                    // rooms[socket.room].users[socket.id].team = false;
                    // rooms[socket.room].users[socket.id].status = 0; 

                    // // UI 위치 할당
                    // DeplaceUser(prevTeam, prevPlace);
                    // rooms[socket.room].users[socket.id].place = PlaceUser(false);
                    // -- rooms[socket.room].numWhiteUsers ; 
                    // ++ rooms[socket.room].numBlackUsers ; 

                    // // 2. 바뀐 정보 클라쪽에 보내기
                    // var teamChangeStatus = JSON.stringify(playerInfo);
                    // console.log('check : ', teamChangeStatus);
                    // io.sockets.in(socket.room).emit('updateTeamChange',teamChangeStatus);
                }

                // // 경우 1-2 : 현재 black 팀 -> white 가능한지 확인
                // if (prevTeam == false && rooms[socket.room].numWhiteUsers <4)
                // {

                //     // 1. room의 사용자 team 정보 바꾸기
                //     // playerInfo.team = true;
                //     console.log("[case1-2] PlayersInfo : ", playerInfo);
                //     rooms[socket.room].users[socket.id].team = true;
                //     rooms[socket.room].users[socket.id].status = 0;

                //     // UI 위치 할당
                //     DeplaceUser(prevTeam, prevPlace);
                //     rooms[socket.room].users[socket.id].place = PlaceUser(true);
                //     ++ rooms[socket.room].numWhiteUsers ; 
                //     -- rooms[socket.room].numBlackUsers ; 

                //     // 2. 바뀐 정보 클라쪽에 보내기
                //     var teamChangeStatus = JSON.stringify(playerInfo);
                //     console.log('check : ', teamChangeStatus);
                //     io.sockets.in(socket.room).emit('updateTeamChange',teamChangeStatus);
                // }


                // 경우 2 : full 상태라 1:1로 팀 change를 해야되는 상황 
                // 과정 1 : 대기열 큐에 ADD
                else if (rooms[socket.room].numWhiteUsers >= 4 || rooms[socket.room].numBlackUsers >= 4) // 꽉 찬 상황이면 queue에 저장 (조정 : if문 걍 없애도 될듯)
                {

                     // 1. 대기열에 저장 
                    if (prevTeam == false){ // 현재 black이니까 white 팀으로 변경하고자 함
                        userPlacement[socket.room].toWhiteUsers.push(socket.id);
                    }
                    else{ // 현재 white이니까 black 팀으로 변경하고자 함
                        userPlacement[socket.room].toBlackUsers.push(socket.id);
                    }

                    // 2. 매칭 하기
                    if (userPlacement[socket.room].toBlackUsers.length > 0 && userPlacement[socket.room].toWhiteUsers.length > 0 ){
                        var matchPlayer1Id = userPlacement[socket.room].toBlackUsers.shift();
                        var matchPlayer2Id = userPlacement[socket.room].toWhiteUsers.shift();
                        // var matchPlayerId = userPlacement[room.roomPin].toWhiteUsers.Dequeue();

                        var matchPlayer1 = rooms[socket.room].users[matchPlayer1Id];
                        var matchPlayer2 = rooms[socket.room].users[matchPlayer2Id];


                        // 3. 변수 바꾸기 (numWhite, toBlackUsers, playerInfo)
                        console.log('변경전 rooms[socket.room].users[matchPlayer1Id] : ', matchPlayer1);
                        console.log('변경전 rooms[socket.room].users[matchPlayer2Id] : ', matchPlayer2);
                    
                        // 2) place & team 변경
                        DeplaceUser(matchPlayer1.team, matchPlayer1.place);
                        DeplaceUser(matchPlayer2.team, matchPlayer2.place);

                        matchPlayer1.team = !matchPlayer1.team
                        matchPlayer2.team = !matchPlayer2.team

                        matchPlayer1.place = PlaceUser(matchPlayer1.team);
                        matchPlayer2.place = PlaceUser(matchPlayer2.team);

                        // 3) 변경사항 저장
                        rooms[socket.room].users[matchPlayer1Id] = matchPlayer1;
                        rooms[socket.room].users[matchPlayer2Id] = matchPlayer2;

                        console.log('변경후 rooms[socket.room].users[matchPlayer1Id] : ', rooms[socket.room].users[matchPlayer1Id]);
                        console.log('변경후 rooms[socket.room].users[matchPlayer2Id] : ', rooms[socket.room].users[matchPlayer2Id]);


                        var changeInfo = { 
                            type : 2,
                            player1 : rooms[socket.room].users[matchPlayer1Id], // player1
                            player2 : rooms[socket.room].users[matchPlayer2Id]   // player2
                        };

                        var teamChangeInfo = JSON.stringify(changeInfo);
                        console.log('check : ', teamChangeInfo);
                        io.sockets.in(socket.room).emit('updateTeamChange',teamChangeInfo);
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


        // 회사 몰락 여부 확인 (현제 test로 하드코딩 하여 추후 json에서 가져와 수정해야 함)
        socket.on('On Main Map', function() {
            // let comapny_abandonStatus = {companyA: true, companyB: false, companyC: false, companyD: false, companyE: false};
            let comapny_abandonStatus = [true, false, false, false, false];
            // var companyStatusJson = JSON.stringify(comapny_abandonStatus);
            console.log("jsonStringify : ", comapny_abandonStatus.toString());
            socket.emit('Company Status', comapny_abandonStatus);


        })
        
        // 회사 차단 인원 확인 (현제 test로 하드코딩 하여 추후 json에서 가져와 수정해야 함)
        socket.on('On Monitoring', function() {
            // let comapny_abandonStatus = {companyA: true, companyB: false, companyC: false, companyD: false, companyE: false};
            let company_blockedNum = 2;
            // var companyStatusJson = JSON.stringify(comapny_abandonStatus);
            socket.emit('Blocked Num', company_blockedNum);


        })


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

