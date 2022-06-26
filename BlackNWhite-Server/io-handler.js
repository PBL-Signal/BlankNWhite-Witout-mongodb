const url = require('url');
const async = require('async');
//const func = require('./server_functions/db_func');
const { Socket } = require('dgram');
const { stringify } = require('querystring');
const config = require('./configure');

const REDIS_PORT = 6380;
const Redis = require("ioredis"); 
const redisClient = new Redis(REDIS_PORT);
const { RedisSessionStore } = require("./sessionStore");
const sessionStore = new RedisSessionStore(redisClient);

const { redisHashTableStore } = require("./redisHashTableStore");
const hashtableStore = new redisHashTableStore(redisClient);

const { RedisJsonStore } = require("./redisJsonStore");
const jsonStore = new RedisJsonStore(redisClient);

const { redisListStore } = require("./redisListStore");
const listStore = new redisListStore(redisClient);

const { RedisRoomStore, InMemoryRoomStore } = require("./roomStore");
const redis_room = new RedisRoomStore(redisClient);

const crypto = require("crypto");
const randomId = () => crypto.randomBytes(8).toString("hex");

const RoomTotalSchema = require("./schemas/roomTotal/RoomTotalSchema");
const BlackTeam = require("./schemas/roomTotal/BlackTeam");
const WhiteTeam = require("./schemas/roomTotal/WhiteTeam");
const BlackUsers = require("./schemas/roomTotal/BlackUsers");
const UserCompanyStatus = require("./schemas/roomTotal/UserCompanyStatus");
const WhiteUsers = require("./schemas/roomTotal/WhiteUsers");
const Company = require("./schemas/roomTotal/Company");
const Section = require("./schemas/roomTotal/Section");
const Progress = require("./schemas/roomTotal/Progress");

module.exports = (io) => {
    
    var gameserver = io.of("blacknwhite");
 
    var rooms ={};  // 여러 방 정보를 저장하는 딕셔너리
    var userPlacement ={}; // # WaitingRoom TeamChange 및 UI 배치 관련 정보 저장
    let Players = [];
    let gamePlayer = {};
    let evenNumPlayer = false;
    let numPlayer = 1;
    let companyNameList = ["companyA", "companyB", "companyC", "companyD", "companyE"]

    let timerId;
    let pitaTimerId;
    
    io.use(async (socket, next) => {
        console.log("io.use");

        const sessionID = socket.handshake.auth.sessionID;
        // 가장 먼저 CONNECTION들어가기 전에 SESSIONID 있는지 확인
        //finding existing session
        const session = await sessionStore.findSession(sessionID);

        if(sessionID){
            socket.sessionID = sessionID;
            socket.userID = session.userID;
            socket.nickname = session.username;
            console.log("io.use 세션 있음", session.userID, sessionID);
            return next();
        }
        // 처음 연결되는 경우 즉, SESSIONID 없으면 
        const username = socket.handshake.auth.username;

        if (!username) {
            return next(new Error("invalid username")); // 새로운 세션 계속 안생기게 해주는 것
            // USERNAME 입력시에만 세션이 만들어짐 
        }
        console.log("io.use 세션 새로 생성", username);
        //create new session
        socket.sessionID = randomId();
        socket.userID = randomId();
        socket.nickname = username;


        // console.log("session 설정 확인 - sessionID", socket.sessionID);
        // console.log("session 설정 확인 - userID", socket.userID);
        // console.log("session 설정 확인 - username", socket.username);
        next();
    });


    io.on('connection', async(socket) => {
        console.log("io-handler.js socket connect!!");
        console.log("socketid : "+ socket.id); 
     
        // console.log("sessionID : "+ socket.sessionID); 
        // console.log("userID : "+ socket.userID); 
 
        console.log("session 설정 확인 - sessionID", socket.sessionID);
        console.log("session 설정 확인 - userID", socket.userID);
        console.log("session 설정 확인 - username", socket.nickname);

        
    
        try{
            await sessionStore.saveSession(socket.sessionID, {
                userID: socket.userID,
                username: socket.nickname,
                connected: true,
            }).catch( 
            function (error) {
            console.log('catch handler', error);
            });

        }catch(error){
            console.log("ERROR! ", error);
        }

        console.log("connect: saveSession");



         // [MainHome] 사용자 정보(session) 확인 
        socket.on('checkSession', () => {
            var session = { 
                sessionID: socket.sessionID,
                userID: socket.userID,
                nickname: socket.nickname,  // 원래는 username임
            };
    
            var sessionJSON= JSON.stringify(session);
            socket.emit("sessionInfo", sessionJSON);
        });




        // [MainHome] pin 번호 입력받아 현재 활성화된 방인지 검증함
        // [MainHome] 오픈 방 클릭시 
        socket.on("isValidRoom", async(room) => {
            console.log('[socket-isValidRoom] room:',room);
            /*
                < 로직 > 
                1. 해당 룸 핀이 있는지 확인
                2. 해당 룸에 들어갈 수 있는지 (full상태 확인)
                3. permission 주기 (socket.room 저장, 방 상태 update 및 cnt ++)
            */
            var room_data = { 
                permission: false
            };

            if(await UpdatePermission(room)){
                console.log("permission True");
                socket.room = room;
                room_data.permission = true;
                console.log("room_data.permission : ", room_data.permission );
            }

            var roomJson = JSON.stringify(room_data);
            console.log('!!check roomJson : ', roomJson);
            socket.emit('room permission',roomJson);

            // 기존 코드 -----------
            // if (await redis_room.IsValidRoom(room)) { 
            //     console.log("permission True");
            //     socket.room = room;
            //     room_data.permission = true;
            //     console.log("room_data.permission : ", room_data.permission );
            // }

            // var roomJson = JSON.stringify(room_data);
            // console.log('!!check roomJson : ', roomJson);
            // socket.emit('room permission',roomJson);
            //----------------------
        });

        // [MainHome] 랜덤 게임 시작 버튼 클릭시
        socket.on("randomGameStart", async() => {
            console.log('[randomGameStart]');
            var roomPin; 
            /*
             - 경우 1 : 공개방 O -> public이고 isnotfull인 방 키 return 
             - 경우 2 : 공개방 X -> 새 공개방 만들고 입장하기 
            */

            // step 0. redis-publicWaitingRoom 상태 확인 

            var publicRoomCnt = await listStore.lenList('publicRoom', 'roomManage');
            console.log("publicRoomCnt : ", publicRoomCnt);


            if(publicRoomCnt > 0){    // <코드 미정>
                // 경우 1
                var publicRoomList = await listStore.rangeList('publicRoom', 0, -1, 'roomManage');
                console.log("! publicRoomList : ", publicRoomList);

                //0~9까지의 난수
                var randomNum = {};
                randomNum.random = function(n1, n2) {
                    return parseInt(Math.random() * (n2 -n1 +1)) + n1;
                };

                var randomRoomIdx = randomNum.random(0,publicRoomCnt-1);
                var roomPin = publicRoomList[randomRoomIdx];
                console.log("@ randomRoomIdx  : ", randomRoomIdx);
                console.log("@ roomPin  : ", roomPin);
                
                socket.room = roomPin;
                console.log("socket.room", socket.room);
                socket.emit('enterPublicRoom');
            }else {
                // 경우 2
                roomPin = await createRoom('public');
                // await initRoom(roomPin);

                console.log("succesCreateRoom roomPin: " , roomPin);
                
            }    
            socket.room = roomPin;
          
            console.log("socket.room", socket.room);
            socket.emit('enterPublicRoom');

        });


        // [MainHome] 룸 리스트 정보 반환 
        socket.on("getPublcRooms", async() => {
            console.log('[getPublcRooms]');
            // <<코드 미정>> 코드 수정 필요
            // 방 pin 번호, 방 인원수 
            // var roomslist = await redis_room.viewRoomList();
            var roomslist = await listStore.rangeList('publicRoom', 0, -1, 'roomManage');
            console.log('[getPublcRooms] roomsList : ', roomslist);
            var publicRooms = []
            for (const room of roomslist){
                // publicRooms[room] = await redis_room.RoomMembers_num(room)
                publicRooms.push({
                    'roomPin' : room.toString(),
                    'userCnt' : (await redis_room.RoomMembers_num(room)).toString()
                });
            }   

            // var publicRoomsJson = JSON.stringify(publicRooms);
            // console.log(">>> publicRoomsJson : ", publicRoomsJson);
            // socket.emit('loadPublicRooms', publicRoomsJson);
        
            console.log(">>> publicRooms : ", publicRooms);
            socket.emit('loadPublicRooms', publicRooms);
        });

        // [CreateRoom] 새 방을 만듦
        socket.on("createRoom", async(room) =>{
            console.log('[socket-createRoom] 호출됨, 받은 room 정보 (maxPlayer): ', room);
            console.log('[socket-createRoom] room.roomType', room.roomType);
            // hashtableStore.storeHashTable("key", {"a":"f", 1:2}, 1, 2);
               
            var roomPin = await createRoom(room.roomType);
            // await initRoom(roomPin);

            console.log("succesCreateRoom roomPin: " , roomPin);
            socket.room = roomPin;


            socket.emit('succesCreateRoom', {
                roomPin: roomPin.toString()
            });
        
        });



        // [WaitingRoom] 
        // let addedUser = false; // added 유저 경우 

        // [WaitingRoom] UI player 대응 컴포넌트 idx 할당
        async function PlaceUser(team){
            console.log("PlaceUser 함수---!");

            var roomPin = socket.room;
            var userPlacementName ;

            if(!team){ //false(0)면 black
                userPlacementName =  'blackPlacement';
            }else{
                userPlacementName =  'whitePlacement';
            } 

            console.log("userPlacementName " , userPlacementName);

            var userPlacement =await hashtableStore.getHashTableFieldValue(roomPin, [userPlacementName], 'roomManage');
            console.log("userPlacement " , userPlacement);
            userPlacement = userPlacement[0].split('');
            // console.log("userPlacement.split() " , userPlacement);
            var place =  userPlacement.pop();

            userPlacement =  userPlacement.join('');
            // console.log("AFTER! userPlacement.join('')" , userPlacement);
            await hashtableStore.updateHashTableField(roomPin, userPlacementName, userPlacement, 'roomManage');


            console.log("[PlaceUser] 반환 team : ", team, " place : ", place); 
          
            return place
        }

        // [WaitingRoom] UI player 대응 컴포넌트 idx 제거
        async function DeplaceUser(prevTeam, idx){
            console.log("DeplaceUser 함수---!");

            var roomPin = socket.room;
            var userPlacementName ;

            if(!prevTeam){ // false(0) 면 black팀
                userPlacementName =  'blackPlacement';
            }else{
                userPlacementName =  'whitePlacement';
            }

            console.log("userPlacementName " , userPlacementName);

            var userPlacement = await hashtableStore.getHashTableFieldValue(roomPin, [userPlacementName], 'roomManage');
            // console.log("userPlacement " , userPlacement);
            userPlacement = userPlacement[0].split('');
            // console.log("userPlacement.split() " , userPlacement);
            userPlacement.push(idx);
            // console.log("$$DeplaceUser  userPlacement : " ,userPlacement);

            userPlacement =  userPlacement.join('');
            // console.log("AFTER! userPlacement.join('')" , userPlacement);
            console.log("check!! ", await hashtableStore.updateHashTableField(roomPin, userPlacementName, userPlacement, 'roomManage'));
        }


        // [WaitingRoom] 사용자 첫 입장 시 'add user' emit 
        socket.on('add user', async() => {
            // console.log("&&&&&&&&&&&&&&&&&& TEAM INFO + ", socket.team);
            io.sockets.emit('Visible AddedSettings'); // actionbar
        
            // console.log('[add user] add user 호출됨 addedUser : ', addedUser, 'user : ', socket.nickname, 'room : ', socket.room );
            console.log('[add user] add user 호출됨 user : ', socket.nickname, 'room : ', socket.room );
            /*
                < 로직 > 
                1. redis에서 room 정보 불러오기
                2. new user를 white/black 배정 및 profile 색 지정 
                3. 2번에서 만든 new user정보 저장(redis_room.addMember) 및 socket.join 
                4. 사용자 로그인 알림 (new user에게 모든 사용자의 정보를 push함) 
                5. new user외의 사용자들에게 new user정보보냄
            */
            // if (addedUser) return;

            var room = socket.room;
        
            // 1. redis에서 room 정보 불러오기
            var roomManageDict = await hashtableStore.getAllHashTable(room, 'roomManage'); // 딕셔너리 형태
            console.log('!!!~~룸정보 roomManage', roomManageDict);

            // 2. new user를 white/black 배정 및 profile 색 지정 
            // 2-1. team배정
            var team;
            if (roomManageDict.blackUserCnt > roomManageDict.whiteUserCnt){
                ++roomManageDict.whiteUserCnt ;
                team = true;
            }else {
                ++roomManageDict.blackUserCnt ;
                team = false;
            }
            
            ++roomManageDict.userCnt; 
            await hashtableStore.storeHashTable(room, roomManageDict, 'roomManage');

            // 만약 현재 방 인원이 꽉 찾으면 list에서 삭제해주기
            if (roomManageDict.userCnt > 7){
                var redisroomKey =  roomManageDict.roomType +'Room';
                listStore.delElementList(redisroomKey, 1, room, 'roomManage');
                console.log("roomManage의 list에서 삭제됨");
            }

            // 2-1. profile 배정
            const rand_Color = Math.floor(Math.random() * 12);
            let playerInfo = { userID: socket.userID, nickname: socket.nickname, team: team, status: 0, color: rand_Color, place : await PlaceUser(team) };
            console.log("PlayersInfo : ", playerInfo);


            // 3. 2번에서 만든 new user정보 저장(redis_room.addMember) 및 socket.join, socket.color
            redis_room.addMember(socket.room, socket.userID, playerInfo);
            socket.team = team;
            socket.color = rand_Color;
            socket.join(room);

            // 4. 사용자 로그인 알림 (new user에게 모든 사용자의 정보를 push함) 
            // 해당 룸의 모든 사용자 정보 가져와 new user 정보 추가 후 update
            var RoomMembersList =  await redis_room.RoomMembers(socket.room);
            var RoomMembersDict = {}
            for (const member of RoomMembersList){
                RoomMembersDict[member] = await redis_room.getMember(room, member);
            }   

            console.log('!!!~~RoomMembersDict', RoomMembersDict);

            
            var room_data = { 
                room : room,
                clientUserID : socket.userID,
                users : RoomMembersDict
            };
            var roomJson = JSON.stringify(room_data);

            console.log('check roomJson : ', roomJson);
            // io.sockets.in(room).emit('login',roomJson); 
            socket.emit('login',roomJson); 
     
            // 5. new user외의 사용자들에게 new user정보 보냄
            socket.broadcast.to(room).emit('user joined', JSON.stringify(playerInfo));

        });
        

    
        // [WaitingRoom] status 변경 시 
        socket.on('changeReadyStatus',  async(newStatus) =>{
            console.log('changeReadyStatus status : ', newStatus);
            
            // 1. 사용자 정보 수정 
            var playerInfo = await redis_room.getMember(socket.room, socket.userID);
            console.log("!PlayersInfo : ", playerInfo);
            playerInfo.status = newStatus;

            await redis_room.updateMember(socket.room, socket.userID, playerInfo);
            // rooms[socket.room].users[socket.id] = playerInfo;     // evenNumPlayer는 팀 정보
            //console.log("수정후! : ",  rooms[socket.room].users[socket.id]);

            // 2. 수정한 내용 client들에게 뿌리기
            var playerJson = JSON.stringify(playerInfo);

            console.log('check playerJson : ', playerJson);
            io.sockets.in(socket.room).emit('updateUI',playerJson);

        });


        // [WaitingRoom] profile 변경 시 
        socket.on('changeProfileColor',  async(colorIndex) =>{
            console.log('changeProfileColor colorIndex : ', colorIndex);
            
            // 1. 사용자 정보 수정 
            var playerInfo = await redis_room.getMember(socket.room, socket.userID);
            playerInfo.color = colorIndex;
            console.log("PlayersInfo : ", playerInfo);

            await redis_room.updateMember(socket.room, socket.userID, playerInfo);
            console.log("수정 저장완료");


            // 2. 수정한 내용 client들에게 뿌리기
            var playerJson = JSON.stringify(playerInfo);

            console.log('check : ', playerJson);
            socket.broadcast.to(socket.room).emit('updateUI', playerJson);

        });  



        // [WaitingRoom] teamChange 변경 시 
        socket.on('changeTeamStatus',  async(changeStatus) =>{
            console.log("_____________________________________________________________________");
            console.log('!!!!changeTeamStatus changeStatus : ', changeStatus);

            // 1. 사용자 정보 수정 
            var playerInfo = await redis_room.getMember(socket.room, socket.userID);
            playerInfo.status = changeStatus;
            console.log("PlayersInfo : ", playerInfo);

            var room = socket.room;
            await redis_room.updateMember(room, socket.userID, playerInfo);// evenNumPlayer는 팀 정보
     

            var prevTeam = playerInfo.team; // 팀 바꾸기 전 현재 사용자 팀 정보
            var prevPlace = playerInfo.place;
            console.log("## prevTeam : ", prevTeam, "  prevPlace : ", prevPlace );

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

                // 0. redis에서 room 정보 불러오기
                // var roomInfoJson =  JSON.parse(await redis_room.getRoomInfo(socket.room));
                // console.log('!!!~~룸정보', roomInfoJson);
                var roomManageDict = await hashtableStore.getAllHashTable(room, 'roomManage'); // 딕셔너리 형태
                console.log('!!!~~룸정보 roomManage', roomManageDict);


                // 경우 1-1 : 현재 white 팀 -> black 가능한지 확인
                console.log("@roomManageDict.blackUserCnt : ", roomManageDict.blackUserCnt);
                console.log("@roomManageDict.whiteUserCnt : ", roomManageDict.whiteUserCnt);

                if ((prevTeam == true &&  roomManageDict.blackUserCnt <4) || (prevTeam == false && roomManageDict.whiteUserCnt <4))
                {                
                    // 1. room의 사용자 team 정보 바꾸기
                    // playerInfo.team = false;
                    console.log("[case1] PlayersInfo : ", playerInfo);
                    playerInfo.team = !prevTeam;
                    socket.team = !prevTeam;;
                    playerInfo.status = 0; 

                    if(prevTeam){ // white팀이면
                        -- roomManageDict.whiteUserCnt ; 
                        ++ roomManageDict.blackUserCnt ; 
                    }else{
                        // black팀이면
                        ++ roomManageDict.whiteUserCnt; 
                        -- roomManageDict.blackUserCnt ; 
                    }
         

                    // 수정사항 REDIS 저장
                    await hashtableStore.storeHashTable(room, roomManageDict, 'roomManage');
  
                    // UI 위치 할당
                    await DeplaceUser(prevTeam, prevPlace);
                    playerInfo.place = await PlaceUser(!prevTeam);
      
                    // 수정사항 REDIS 저장
                    console.log("[찐최종 저장 ] playerInfo : ", playerInfo);
                    await redis_room.updateMember(room, socket.userID, playerInfo);


                    // 2. 바뀐 정보 클라쪽에 보내기
                    var changeInfo = { 
                        type : 1,
                        player1 : playerInfo, // 이전 ->수정 후 v3
                        // player1 : rooms[socket.room].users[socket.id]  // 수정 후
                        // player1 : await redis_room.getMember(socket.room, socket.userID) // 수정 후 v2
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
                //// <<<수정 필요>>
                else if (roomInfoJson.numWhiteUsers >= 4 ||roomInfoJson.numBlackUsers >= 4) // 꽉 찬 상황이면 queue에 저장 (조정 : if문 걍 없애도 될듯)
                {

                    var userPlacement = JSON.parse(await jsonStore.getjson(socket.room))[0];
                     // 1. 대기열에 저장 
                    if (prevTeam == false){ // 현재 black이니까 white 팀으로 변경하고자 함
                        userPlacement.toWhiteUsers.push(socket.id);
                    }
                    else{ // 현재 white이니까 black 팀으로 변경하고자 함
                        userPlacement.toBlackUsers.push(socket.id);
                    }

                    // 2. 매칭 하기
                    if (userPlacementuserPlacement.toBlackUsers.length > 0 && userPlacement.toWhiteUsers.length > 0 ){
                        var matchPlayer1Id = userPlacement.toBlackUsers.shift();
                        var matchPlayer2Id = userPlacement.toWhiteUsers.shift();
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

        // [WaitingRoom] WaitingRoom에서 나갈 시 (홈버튼 클릭)
        socket.on('leaveRoom', async()=> {
            console.log(">>>>> [leaveRoom]!");

            var roomPin = socket.room;
         
            await leaveRoom(socket, roomPin);
        });


        // [WaitingRoom] 게임 스타트 누를 시에 모든 유저에게 전달
        socket.on('Game Start',  async() =>{
            // 사용자 정보 팀 별로 불러오기
            var blackUsersInfo = []; 
            var whiteUsersInfo = [];
            let infoJson = {};
            
            var RoomMembersList =  await redis_room.RoomMembers(socket.room);
            for (const member of RoomMembersList){
                var playerInfo = await redis_room.getMember(socket.room, member);
                if (playerInfo.team == false) {
                    infoJson = {UsersID : playerInfo.userID, UsersProfileColor : playerInfo.color}
                    blackUsersInfo.push(infoJson);
                }
                else {
                    infoJson = {UsersID : playerInfo.userID, UsersProfileColor : playerInfo.color}
                    whiteUsersInfo.push(infoJson);
                }
            }
            console.log("blackUsersInfo 배열 : ", blackUsersInfo);
            console.log("whiteUsersInfo 배열 : ", whiteUsersInfo);
               
            // 게임 관련 Json 생성 (new)
            var roomTotalJson = InitGame(socket.room, blackUsersInfo, whiteUsersInfo);
            
            // monitoringLog 생성
            var monitoringLog = [];
            jsonStore.storejson(monitoringLog, socket.room+":blackLog");
            jsonStore.storejson(monitoringLog, socket.room+":whiteLog");
            // var test = JSON.parse(await jsonStore.getjson(socket.room+":blackLog"))[0];
            // console.log("monitoringLog INIT test >> ", test);

            var monitoringLog2 = {time: "12:34:56", nickname: "test1", targetCompany: "companyA", targetSection: "Area_DMZ", actionType: "monitoring", detail: "dddd 공격을 수행했습니다."};

            // redis에 저징
            jsonStore.storejson(roomTotalJson, socket.room);

            // socket.broadcast.to(socket.room).emit('onGameStart');  //ver0
            io.sockets.in(socket.room).emit('onGameStart'); // ver1/
        });

        //  [WaitingRoom] GameStart로 모든 클라이언트의 on을 받는 함수로 팀별로 room join하여 씬 이동함 
        socket.on('joinTeam', async() => {
            // 팀별로 ROOM 추가 join
            socket.roomTeam = socket.room + socket.team.toString();
            console.log("@@ socket.nickname : " , socket.nickname, " socket.roomTeam  : ",  socket.roomTeam);
            socket.join(socket.roomTeam);

            socket.emit('loadMainGame', socket.team.toString()); //ver3
            // io.sockets.in(socket.room+'false').emit('onBlackGameStart');// ver2
            // io.sockets.in(socket.room+'true').emit('onWhiteGameStart');// ver2
        });


        // [MainGame] 게임 시작시 해당 룸의 사용자 정보 넘김
        socket.on('InitGame',  async() =>{
            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("On Main Map roomTotalJson : ", roomTotalJson);

            let abandonStatusList = [];
            for(let company of companyNameList){
                abandonStatusList.push(roomTotalJson[0][company]["abandonStatus"]);
            }

            var pitaNum;
            let teamProfileJson = {}
            let userId = []
            if (socket.team == true){
                pitaNum = roomTotalJson[0]["whiteTeam"]["total_pita"];
                for (const userID in roomTotalJson[0]["whiteTeam"]["users"]){
                    teamProfileJson[userID] = roomTotalJson[0]["whiteTeam"]["users"][userID]["profileColor"];
                    userId.push(userID);
                }

            } else {
                pitaNum = roomTotalJson[0]["blackTeam"]["total_pita"];
                for (const userID in roomTotalJson[0]["blackTeam"]["users"]){
                    teamProfileJson[userID] = roomTotalJson[0]["blackTeam"]["users"][userID]["profileColor"];
                    userId.push(userID);
                }
            }

            console.log("teamprofileColor 정보 :", teamProfileJson);

            var room_data = { 
                teamName : socket.team,
                pita : pitaNum,
                teamProfileColor : teamProfileJson,
                userID : userId,
                teamNum : userId.length
            };
            var roomJson = JSON.stringify(room_data);


            console.log("Team 정보 :", socket.team);
            console.log("room 정보 :", socket.room);
            console.log("roomJson!! :",roomJson);
            // io.sockets.in(socket.room).emit('MainGameStart', roomJson);
            socket.emit('MainGameStart', roomJson);
            
            console.log("On Main Map abandonStatusList : ", abandonStatusList);
            io.sockets.in(socket.room).emit('Company Status', abandonStatusList);

            // io.sockets.emit('Visible LimitedTime', socket.team.toString()); // actionbar
            console.log("[[[InitGame]] socket.nickname, team : ", socket.nickname, socket.team);
            socket.emit('Visible LimitedTime', socket.team.toString()); // actionbar

            // Timer 시작
            var time = 600; //600=10분 
            var min = "";
            var sec = "";

            // 게임 시간 타이머 
            io.sockets.in(socket.room).emit('Timer START');
            timerId = setInterval(function(){
                min = parseInt(time/60);
                sec = time%60;
                // console.log("TIME : " + min + "분 " + sec + "초");
                time--;
                if(time<=0) {
                    console.log("시간종료!");
                    io.sockets.in(socket.room).emit('Timer END');
                    clearInterval(timerId);
                    clearInterval(pitaTimerId);
                }
            }, 1000);

            // pita 30초 간격으로 100pita 지급
            var pitaIncome = 100; 
            var pitaIncome2 = 80; 
            pitaTimerId = setInterval(async function(){
                const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

                roomTotalJson[0].blackTeam.total_pita += pitaIncome;
                roomTotalJson[0].whiteTeam.total_pita += pitaIncome2;

                var black_total_pita = roomTotalJson[0].blackTeam.total_pita;
                var white_total_pita = roomTotalJson[0].whiteTeam.total_pita;

                await jsonStore.updatejson(roomTotalJson[0], socket.room);

                console.log("!!! black_total_pita : " + black_total_pita + " white_total_pita : " + white_total_pita);
                
                io.sockets.in(socket.room+'false').emit('Update Black Pita', black_total_pita);
                io.sockets.in(socket.room+'true').emit('Update White Pita', white_total_pita);
                // io.sockets.in(socket.room).emit("Load Pita Num", black_total_pita);
    
            }, 10000);


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


        // 무력화 해결 시도 시
        socket.on('Try Non-neutralization', async(room)=> {
            console.log("[On] Solve Neutralization");
          
            //  json 불러와서 해당 영역 회사 경고 초기화 함 
            var roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("JSON!!!",roomTotalJson);
            
            var black_total_pita = roomTotalJson[0].blackTeam.total_pita;
            console.log("blackTeam.total_pita!!!", black_total_pita );

            // 가격화 
            if (black_total_pita - config.UNBLOCK_INFO.pita < 0){
                // 실패시
                console.log("failed");
                socket.emit('Failed Neutralization');
            }
            else{
                console.log("solved");
                // json 변경
                roomTotalJson[0].blackTeam.total_pita = black_total_pita - 100;
                await jsonStore.updatejson(roomTotalJson[0], socket.room);

                // 확인
                var roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
                console.log("UPDATE 후에 JSON!!!",roomTotalJson[0]);
                
                // 성공시 
                socket.emit('Solved Neutralization');
            }

        });

        ////////////////////////////////////////////////////////////////////////////////////
        // PlayerEnter
        // socket.on('PlayerEnter', function() {
        //     console.log("Players >> ");
        //     const rand_Color = Math.floor(Math.random() * 12);
        //     // eval("Players.player" + numPlayer + " = playerInfo")
        //     let playerOrder = "player" + numPlayer;
        //     let playerInfo = {playerOrder: playerOrder, socket: socket.id, nickname: socket.nickname, readyStatus: false, teamStatus: false, team: evenNumPlayer, color: rand_Color};
        //     Players.push(playerInfo);
        //     gamePlayer.player = Players;
        //     // Players[Players.length]=playerInfo;
        //     console.log("PlayersInfo", numPlayer, " >> ", playerInfo);
        //     console.log("Players >> ", Players);
        //     console.log("gamePlayer >> ", gamePlayer);

        //     if (evenNumPlayer == false){
        //         evenNumPlayer = true;
        //     } else {
        //         evenNumPlayer = false;
        //     }

        //     numPlayer = numPlayer + 1;
            
        //     // JSON 형식으로 유니티에 데이터 보내기

        //     var PlayersJson = JSON.stringify(gamePlayer);
        //     console.log("jsonStringify : ", PlayersJson.toString());
        //     socket.emit('PlayersData', PlayersJson);
        // });
        
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

        // socket.on('changeColor', function(jsonStr) {
        //     let changePlayerInfo = JSON.parse(jsonStr);

        //     console.log('new Player info Jsong string : ', jsonStr);
        //     console.log('new Player info gamePlayer : ', changePlayerInfo);

        //     let playerNum = changePlayerInfo["playerNum"];
        //     let colorNum = changePlayerInfo["value"];

        //     gamePlayer.player[playerNum]["color"] = colorNum;

        //     console.log("new josn file : ", gamePlayer);

        //     var PlayersJson = JSON.stringify(gamePlayer);
        //     console.log("jsonStringify : ", PlayersJson.toString());
        //     socket.emit('PlayersData', PlayersJson);
        // });


        ////////////////////////////////////////////////////////////////////////////////////
        // 회사 선택 후 사용자들에게 위치 알리기
        socket.on("Select Company", async(CompanyName) => {
            
            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("Select Company CompanyIndex : ", CompanyName);

            let teamLocations = {};

            if (socket.team == true) {
                roomTotalJson[0]["whiteTeam"]["users"][socket.userID]["currentLocation"] = CompanyName;
                for (const userID in roomTotalJson[0]["whiteTeam"]["users"]){
                    teamLocations[userID] = roomTotalJson[0]["whiteTeam"]["users"][userID]["currentLocation"];
                }
            } else {
                roomTotalJson[0]["blackTeam"]["users"][socket.userID]["currentLocation"] = CompanyName;
                for (const userID in roomTotalJson[0]["blackTeam"]["users"]){
                    teamLocations[userID] = roomTotalJson[0]["blackTeam"]["users"][userID]["currentLocation"];
                }
            }


            let teamLocationsJson = JSON.stringify(teamLocations);
            console.log("teamLocationsJson : ", teamLocationsJson);
            socket.to(socket.room).emit("Load User Location", teamLocationsJson);
            socket.emit("Load User Location", teamLocationsJson);

            await jsonStore.updatejson(roomTotalJson[0], socket.room);
            roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

        });


        socket.on("Back to MainMap", async() => {
            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

            let teamLocations = {};

            if (socket.team == true) {
                roomTotalJson[0]["whiteTeam"]["users"][socket.userID]["currentLocation"] = "";
                for (const userID in roomTotalJson[0]["whiteTeam"]["users"]){
                    teamLocations[userID] = roomTotalJson[0]["whiteTeam"]["users"][userID]["currentLocation"];
                }
            } else {
                roomTotalJson[0]["blackTeam"]["users"][socket.userID]["currentLocation"] = "";
                for (const userID in roomTotalJson[0]["blackTeam"]["users"]){
                    teamLocations[userID] = roomTotalJson[0]["blackTeam"]["users"][userID]["currentLocation"];
                }
            }


            let teamLocationsJson = JSON.stringify(teamLocations);
            console.log("teamLocationsJson : ", teamLocationsJson);
            socket.to(socket.room).emit("Load User Location", teamLocationsJson);
            socket.emit("Load User Location", teamLocationsJson);

            await jsonStore.updatejson(roomTotalJson[0], socket.room);
            roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
        });


        // 게임 카드 리스트 보내기
        socket.on("Load Card List", async(teamData) => {            
            let teamDataJson = JSON.parse(teamData);

            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("Load card list teamData : ", teamDataJson);
            let returnArray;

            if (socket.team == true) {
                returnArray = roomTotalJson[0][teamDataJson.companyName]["penetrationTestingLV"];
            } else {
                returnArray = roomTotalJson[0][teamDataJson.companyName]["attackLV"];
            }

            let returnValue = returnArray;
            console.log("load card list return value : ", returnValue);

            socket.to(socket.room).emit("Card List", returnValue);
            socket.emit("Card List", returnValue);
        });

        // 게임 카드 리스트 보내기
        socket.on("Load Attack Step", async(teamData) => {            
            let teamDataJson = JSON.parse(teamData);

            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("Load card list teamData : ", teamDataJson);

            if (socket.team == true){  // white 팀 response step
                console.log("Load Attack Step - sectino", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]);
                console.log("load response list : ", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["response"]["progress"]);
                console.log("load response step : ", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["responseStep"]);

                let responseProgress = []
                for(var i in roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["response"]["progress"]){
                    console.log("responseIndex : ", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["response"]["progress"][i]);
                    responseProgress.push(Number(Object.keys(roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["response"]["progress"][i])));
                }

                console.log("responseProgress : ", responseProgress)

                socket.to(socket.room).emit("Load Response List", responseProgress);
                socket.emit("Load Response List", responseProgress);

                socket.to(socket.room).emit("Response Step", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["responseStep"] - 1);
                socket.emit("Response Step", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["responseStep"] - 1);
            } else {  // black 팀 attack step
                let step = roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]["attackStep"];
                console.log("roomTotalJson[0][teamDataJson.companyName]['sections'][teamDataJson.sectionIndex]", roomTotalJson[0][teamDataJson.companyName]["sections"][teamDataJson.sectionIndex]);

                console.log("load attack step : ", step);

                socket.to(socket.room).emit("Attack Step", step);
                socket.emit("Attack Step", step);
            }
        });

        // 공격을 수행하였을 때 결과 처리 및 total pita 정보 보내기
        socket.on("Click Attack", async(attackData) => {
            console.log("Click Attack jsonStr : ", attackData);
            let attackJson = JSON.parse(attackData);

            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("White Team Response list (before) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"]);
            console.log("Black Team Attack list (before) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"]);
            console.log("Click Response responseJson : ", attackJson);
            console.log("attack step load json : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attackStep"]);

            // 만약 1단계 공격이라면 그에 맞는 공격만 효과가 있음
            let cardLv = roomTotalJson[0][attackJson.companyName]["penetrationTestingLV"][attackJson.attackIndex];
            if (0 <= attackJson.attackIndex && attackJson.attackIndex < 4){
                if (attackJson.attackIndex == roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["vuln"]){
                    console.log("attack success : ", attackJson.attackIndex)

                    var attackList = roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"];
                    var responseList = roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"];
                    var existAttack = false;
                    for(var i = 0; i < attackList.length; i++){ 
                        console.log("공격 수행 여부 attackList[i] : ", attackList[i]);
                        if (Object.keys(attackList[i]) == attackJson.attackIndex || Object.keys(responseList[i]) == attackJson.attackIndex) { 
                            existAttack = true;
                            break;
                        }
                    }

                    console.log("공격 수행 여부 : ", existAttack);

                    if (!existAttack){
                        let json = new Object();
                        json[attackJson.attackIndex] = socket.userID;
                        roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"].push(json);
                        roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["last"] = attackJson.attackIndex;
                        step = 1;
            
                        console.log("결정된 인덱스 별 step : ", 1);
                        await attackCount(socket, roomTotalJson, attackJson, cardLv, 1);
                        await monitoringCount(socket, roomTotalJson, attackJson, cardLv);
                    } else {
                        console.log("이미 수행한 공격입니다.");
                    }
                    
                }
            } else {

                let step; // attack Step
                if (attackJson.attackIndex == 4){
                    step = 2;
                } else if (attackJson.attackIndex == 5){
                    step = 3;
                } else if (attackJson.attackIndex == 6){
                    step = 4;
                } else if (7 <= attackJson.attackIndex && attackJson.attackIndex <= 10){
                    step = 5;
                } else if (11 <= attackJson.attackIndex && attackJson.attackIndex <= 12){
                    step = 6;
                }

                var attackList = roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"];
                var responseList = roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"];
                var existAttack = false;
                for(var i = 0; i < attackList.length; i++){ 
                    if (Object.keys(attackList[i]) == attackJson.attackIndex || Object.keys(responseList[i]) == attackJson.attackIndex) { 
                        existAttack = true;
                        break;
                    }
                }

                if (!existAttack){

                        let json = new Object();
                        json[attackJson.attackIndex] = socket.userID;
                        roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"].push(json);
                        roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["last"] = attackJson.attackIndex;
                
                        console.log("결정된 인덱스 별 step : ", step);
                        await attackCount(socket, roomTotalJson, attackJson, cardLv, step);
                        await monitoringCount(socket, roomTotalJson, attackJson, cardLv);
                } else {
                    console.log("이미 수행한 공격입니다.");
                }
                
            }

            let pitaNum;
            if (attackJson.teamName == true) {
                pitaNum = roomTotalJson[0]['whiteTeam']['total_pita'] - config["ATTACK_" + (attackJson.attackIndex + 1)]['pita'][" + cardLv + "];
                roomTotalJson[0]['whiteTeam']['total_pita'] = pitaNum;

                socket.to(socket.room).emit('Update White Pita', pitaNum);
                socket.emit('Update White Pita', pitaNum);
            } else {
                pitaNum = roomTotalJson[0]['blackTeam']['total_pita'] - config["ATTACK_" + (attackJson.attackIndex + 1)]['pita'][" + cardLv + "];
                roomTotalJson[0]['blackTeam']['total_pita'] = pitaNum;

                socket.to(socket.room).emit('Update Black Pita', pitaNum);
                socket.emit('Update Black Pita', pitaNum);
            }

            // step = roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attackStep"];
            console.log("roomTotalJson[0][attackJson.companyName]['sections'][attackJson.sectionIndex] : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]);
            // console.log("attack step update : ", step);
            

            await jsonStore.updatejson(roomTotalJson[0], socket.room);
            roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("attack step after update json : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attackStep"]);
            console.log("attack step after destroy status json : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["destroyStatus"]);
        });

        // 공격을 수행하였을 때 결과 처리 및 total pita 정보 보내기
        socket.on("Click Response", async(responseData) => {
            console.log("Click Attack jsonStr : ", responseData);
            let responseJson = JSON.parse(responseData);

            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("White Team Response list (Click Response before) : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["response"]["progress"]);
            console.log("Black Team Attack list (Click Response before) : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attack"]["progress"]);
            console.log("Click Response responseJson : ", responseJson);
            console.log("response step load json : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["responseStep"]);

            let cardLv = roomTotalJson[0][responseJson.companyName]["penetrationTestingLV"][responseJson.attackIndex];

            await responseCount(socket, roomTotalJson, responseJson, cardLv)

            
        });


        // 모의해킹 혹은 연구를 수행하였을 때 결과 처리 및 total pita 정보 보내기
        socket.on("Click Upgrade Attack", async(upgradeJson) => {
            let upgradeAttackInfo = JSON.parse(upgradeJson);

            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("Update card list upgradeAttackInfo : ", upgradeAttackInfo);

            let cardLv;
            let pitaNum;
            if (socket.team == true) {
                console.log("white team upgrade attack card");
                cardLv = roomTotalJson[0][upgradeAttackInfo.companyName]["penetrationTestingLV"][upgradeAttackInfo.attackIndex];
                roomTotalJson[0][upgradeAttackInfo.companyName]["penetrationTestingLV"][upgradeAttackInfo.attackIndex] += 1;
                pitaNum = roomTotalJson[0]['whiteTeam']['total_pita'] - config["RESEARCH_" + (upgradeAttackInfo.attackIndex + 1)]['pita'][cardLv];
                roomTotalJson[0]['whiteTeam']['total_pita'] = pitaNum;
            } else {
                console.log("black team upgrade attack card");
                cardLv = roomTotalJson[0][upgradeAttackInfo.companyName]["attackLV"][upgradeAttackInfo.attackIndex];
                roomTotalJson[0][upgradeAttackInfo.companyName]["attackLV"][upgradeAttackInfo.attackIndex] += 1;
                pitaNum = roomTotalJson[0]['blackTeam']['total_pita'] - config["RESEARCH_" + (upgradeAttackInfo.attackIndex + 1)]['pita'][cardLv];
                roomTotalJson[0]['blackTeam']['total_pita'] = pitaNum;
            }

            console.log("Update card list roomTotalJson : ", roomTotalJson[0][upgradeAttackInfo.companyName]);

            await jsonStore.updatejson(roomTotalJson[0], socket.room);
            roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("Update card list update roomTotalJson : ", roomTotalJson);
            let returnValue;

            if (socket.team == true) {
                returnValue = roomTotalJson[0][upgradeAttackInfo.companyName]["penetrationTestingLV"];
                socket.to(socket.room).emit('Update White Pita', pitaNum);
                socket.emit('Update White Pita', pitaNum);
            } else {
                returnValue = roomTotalJson[0][upgradeAttackInfo.companyName]["attackLV"];
                socket.to(socket.room).emit('Update Black Pita', pitaNum);
                socket.emit('Update Black Pita', pitaNum);
            }

            // 나중에 white와 black 구분해서 보내기
            console.log("Update Card List Return Value : ", returnValue);
            socket.to(socket.room).emit("Card List", returnValue);
            socket.emit("Card List", returnValue);

        });


        // 회사 몰락 여부 확인
        socket.on('On Main Map', async() => {
            let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("On Main Map roomTotalJson : ", roomTotalJson);

            let abandonStatusList = [];
            for(let company of companyNameList){
                abandonStatusList.push(roomTotalJson[0][company]["abandonStatus"]);
            }

            console.log("On Main Map abandonStatusList : ", abandonStatusList);
            socket.emit('Company Status', abandonStatusList);
        })
        
        // 회사 차단 인원 확인 (현제 test로 하드코딩 하여 추후 json에서 가져와 수정해야 함)
        // 다음주에 해야 됨
        socket.on('On Monitoring', function() {
            // let comapny_abandonStatus = {companyA: true, companyB: false, companyC: false, companyD: false, companyE: false};
            let company_blockedNum = 2;
            // var companyStatusJson = JSON.stringify(comapny_abandonStatus);
            socket.to(socket.room).emit("Blocked Num", company_blockedNum);
            socket.emit('Blocked Num', company_blockedNum);


        })


// ===================================================================================================================
        // ## [Section] 영역 클릭 시 
        socket.on('Section_Name', async(data) => {
            console.log('[Section - Click Section] Click Area Info  : ', data);
            data = JSON.parse(data);

            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            var white_total_pita = roomTotalJson[0].whiteTeam.total_pita;
            console.log("Before White total_pita!!!", white_total_pita );

            var corpName = data.Corp;
            var sectionIdx = data.areaIdx;
            
            if(white_total_pita - config.MAINTENANCE_SECTION_INFO.pita[roomTotalJson[0][corpName].sections[sectionIdx].level] < 0)
            {
                console.log("[Maintainance] 피타 부족");
            } else {
                // 최대 레벨 확인
                if(roomTotalJson[0][corpName].sections[sectionIdx].level >= config.MAX_LEVEL){
                    console.log("섹션 최대 레벨");
                } else {
                    // json 변경 - pita 감소
                    var newTotalPita = white_total_pita - config.MAINTENANCE_SECTION_INFO.pita[roomTotalJson[0][corpName].sections[sectionIdx].level]; //pita 감소
                    roomTotalJson[0].whiteTeam.total_pita = newTotalPita;
                    roomTotalJson[0][corpName].sections[sectionIdx].level += 1; // 레벨 증가
                    await jsonStore.updatejson(roomTotalJson[0], socket.room);

                    // update 확인(추후 삭제)
                    var NewRoomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
                    console.log("After White total_pita!!!", white_total_pita - config.MAINTENANCE_SECTION_INFO.pita[roomTotalJson[0][corpName].sections[sectionIdx].level] );
                    console.log("================= After UPDATE ================= : ", NewRoomTotalJson[0][corpName].sections[sectionIdx]);

                    var area_level = sectionIdx.toString() + "-" + (roomTotalJson[0][corpName].sections[sectionIdx].level);
                    socket.to(socket.room).emit("New_Level", area_level.toString());
                    socket.emit('New_Level', area_level.toString());

                    socket.to(socket.room).emit("Load Pita Num", newTotalPita);
                    socket.emit("Load Pita Num", newTotalPita);    

                }
            }
        });

        // ## [Section] 구조도 페이지 시작 시
        socket.on('Section_Start', async (corp) => {
            console.log("Section_Start CALLED >> ");
            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

            var corpName = corp;
            var sectionsArr = roomTotalJson[0][corpName].sections;
            console.log("### LENGTH ### >> ", sectionsArr.length);

            for(var i=0; i<sectionsArr.length; i++){
                var sectionInfo = { Corp: corpName, areaIdx: i, level: roomTotalJson[0][corpName].sections[i].level, vuln: roomTotalJson[0][corpName].sections[i].vuln}
                console.log("[Section] sectionInfo-detail", sectionInfo);
                socket.to(socket.room).emit("Area_Start_Emit", JSON.stringify(sectionInfo));
                socket.emit('Area_Start_Emit', JSON.stringify(sectionInfo));
                /*
                [Section] sectionInfo-detail { Corp: 'companyA', areaIdx: 0, level: 0, vuln: 3 }
                [Section] sectionInfo-detail { Corp: 'companyA', areaIdx: 1, level: 0, vuln: 1 }
                [Section] sectionInfo-detail { Corp: 'companyA', areaIdx: 2, level: 0, vuln: 2 }
                */
            }
        });

        // ## [PreDiscovery] 사전탐색 페이지 시작 시
        socket.on('PreDiscovery_Start', async (corp) => {
            console.log("PreDiscovery_Start CALLED >> ");
            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

            var corpName = corp;
            var sectionsArr = roomTotalJson[0][corpName].sections;

            for(var i=0; i<sectionsArr.length; i++){
                var sectionInfo = { Corp: corpName, areaIdx: i, vuln: roomTotalJson[0][corpName].sections[i].vuln, vulnActive: roomTotalJson[0][corpName].sections[i].vulnActive}
                console.log("[PreDiscovery] sectionInfo-detail", sectionInfo);
                socket.to(socket.room).emit("PreDiscovery_Start_Emit", JSON.stringify(sectionInfo));
                socket.emit('PreDiscovery_Start_Emit', JSON.stringify(sectionInfo));
                /*
                [Section] sectionInfo-detail { Corp: 'companyA', areaIdx: 0, vuln: 3, vulnActive: false}
                [Section] sectionInfo-detail { Corp: 'companyA', areaIdx: 1, vuln: 1, vulnActive: false}
                [Section] sectionInfo-detail { Corp: 'companyA', areaIdx: 2, vuln: 2, vulnActive: false}
                */
            }
        });

        // ## [Vuln] 영역 클릭 시 
        socket.on('Get_VulnActive', async (data) => {
            console.log('[Vuln] Click Area_Name IDX : ', data);
            data = JSON.parse(data);

            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            var black_total_pita = roomTotalJson[0].blackTeam.total_pita;
            console.log("Before black_total_pita!!!", black_total_pita );

            var corpName = data.Corp;
            var sectionIdx = data.areaIdx;

            
            if( roomTotalJson[0][corpName].sections[sectionIdx].vulnActive == true){
                console.log("이미 취약점확인됨" + roomTotalJson[0][corpName].sections[sectionIdx].vulnActive.toString());
            }
            else if(black_total_pita - config.EXPLORE_INFO.pita < 0)
            {
                console.log("피타 부족");
            } else {
                // json 변경
                var newTotalPita = black_total_pita - config.EXPLORE_INFO.pita; // pita 감소
                roomTotalJson[0].blackTeam.total_pita = newTotalPita; // pita 감소
                roomTotalJson[0][corpName].sections[sectionIdx].vulnActive = true;  // vulnActive 변경
                await jsonStore.updatejson(roomTotalJson[0], socket.room);

                // 확인
                var roomTotalJsonA = JSON.parse(await jsonStore.getjson(socket.room));
                console.log("UPDATE 후에 JSON!!!",roomTotalJsonA[0]);
                console.log("After black_total_pita!!!", black_total_pita - config.EXPLORE_INFO.pita);

                socket.to(socket.room).emit("Area_VulnActive", sectionIdx, roomTotalJson[0][corpName].sections[sectionIdx].vulnActive);
                socket.emit('Area_VulnActive', sectionIdx, roomTotalJson[0][corpName].sections[sectionIdx].vulnActive);

                socket.to(socket.room).emit("Load Pita Num", newTotalPita);
                socket.emit("Load Pita Num", newTotalPita);   
            }
        });

        // // ## [Vuln] 영역 클릭 시  ====> vuln 전달하는 버전. 지금은 active 여부를 보냄(위 코드)
        // socket.on('Get_Vuln', async (data) => {
        //     console.log('[Vuln] Click Area_Name IDX : ', data);
        //     data = JSON.parse(data);

        //     const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
        //     var black_total_pita = roomTotalJson[0].blackTeam.total_pita;
        //     console.log("Before black_total_pita!!!", black_total_pita );

        //     var corpName = data.Corp;
        //     var sectionIdx = data.areaIdx;

        //     if(black_total_pita - config.EXPLORE_INFO.pita < 0)
        //     {
        //         console.log("피타 부족");
        //     } else {
        //         // json 변경
        //         roomTotalJson[0].blackTeam.total_pita = black_total_pita - config.EXPLORE_INFO.pita; // pita 감소
        //         roomTotalJson[0][corpName].sections[sectionIdx].vulnActive = true;  // vulnActive 변경
        //         await jsonStore.updatejson(roomTotalJson[0], socket.room);

        //         // 확인
        //         var roomTotalJsonA = JSON.parse(await jsonStore.getjson(socket.room));
        //         console.log("UPDATE 후에 JSON!!!",roomTotalJsonA[0]);
        //         console.log("After black_total_pita!!!", black_total_pita - config.EXPLORE_INFO.pita);

        //         socket.to(socket.room).emit("Area_Vuln", sectionIdx, roomTotalJson[0][corpName].sections[sectionIdx].vuln, roomTotalJson[0][corpName].sections[sectionIdx].vulnActive);
        //         socket.emit('Area_Vuln', sectionIdx, roomTotalJson[0][corpName].sections[sectionIdx].vuln, roomTotalJson[0][corpName].sections[sectionIdx].vulnActive);
        //     }
        // });


        // [SectionState] Section Destroy
        socket.on('Get_Section_Destroy_State', async(corp) => {
            console.log('Get_Section_Destroy_State CALLED  : ', corp);
            
            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            var corpName = corp;

            //console.log("@@@@@@@@ Destroy State @@@@@@@ ",  roomTotalJson[0][corpName].sections);
            var sections = {sections: roomTotalJson[0][corpName].sections};
            socket.to(socket.room).emit("Section_Destroy_State", JSON.stringify(sections));
            socket.emit('Section_Destroy_State', JSON.stringify(sections));
        });

        // [SectionState] Section Attacked Name TEST
        socket.on('Get_Section_Attacked_Name', async(corp) => {
            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            
            var corpName = corp;

            //console.log("@@@@@@@@ Destroy State @@@@@@@ ",  roomTotalJson[0][corpName].sections);
            var sections = {sections: roomTotalJson[0][corpName].sections}


            socket.to(socket.room).emit("Section_Attacked_Name", JSON.stringify(sections));
            socket.emit('Section_Attacked_Name', JSON.stringify(sections));
        });

        // [SectionState] 관제 issue Count
        socket.on('Get_Issue_Count', async(corp) => {            
            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

            var corpName = corp;
            var sectionsArr = roomTotalJson[0][corpName].sections;

            var cntArr = [];
            for(i=0; i<sectionsArr.length; i++)
            {
                var sectionData = roomTotalJson[0][corpName].sections[i].attack.progress.length;
                cntArr[i] = sectionData;
            }

            socket.to(socket.room).emit("Issue_Count", cntArr);
            socket.emit('Issue_Count', cntArr);

        });

        // // [Monitoring] 영역 클릭하면 탐지된 공격 내용 emit
        // socket.on('Get_Issue', async(corpName,  s_idx) => {
        //     console.log("[Monitoring] Get Issue 호출" + corpName + s_idx);
        //     const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
        //     //console.log("[Monitoring] 결과 " + roomTotalJson[0][corpName].sections[s_idx].response.progress.toString());
        //     var issueDetail = roomTotalJson[0][corpName].sections[s_idx].response.progress;
        //     console.log("[Monitoring] 결과 ", issueDetail);
        //     socket.emit('Get_Issue_Detail', issueDetail.length, issueDetail);
        // });

        // [Abandon] 한 회사의 모든 영역이 파괴되었는지 확인 후 몰락 여부 결정
        socket.on('is_All_Sections_Destroyed', async(corpName) => {
            console.log("[Abandon]is_All_Sections_Destroyed " + corpName);
            const roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            
            var isAbondon = true;
            var sectionsArr = roomTotalJson[0][corpName].sections;
            for(i=0; i<sectionsArr.length; i++)
            {
                var isDestroy = roomTotalJson[0][corpName].sections[i].destroyStatus;
                if(isDestroy == false){ // 한 영역이라도 false면 반복문 나감
                    isAbondon = false;
                    break;
                }
            }
            console.log("[Abandon] isAbondon " + isAbondon);

            if(isAbondon == true){ // 회사 몰락
                console.log("[Abandon] 회사몰락 " + corpName);
                roomTotalJson[0][corpName].abandonStatus = true;
                await jsonStore.updatejson(roomTotalJson[0], socket.room);

                // [GameLog] 로그 추가
                const blackLogJson = JSON.parse(await jsonStore.getjson(socket.room+":blackLog"));
                const whiteLogJson = JSON.parse(await jsonStore.getjson(socket.room+":whiteLog"));

                let today = new Date();   
                let hours = today.getHours(); // 시
                let minutes = today.getMinutes();  // 분
                let seconds = today.getSeconds();  // 초
                let now = hours+":"+minutes+":"+seconds;
                var monitoringLog = {time: now, nickname: "", targetCompany: corpName, targetSection: "", actionType: "Damage", detail: corpName+"가 파괴되었습니다."};

                blackLogJson[0].push(monitoringLog);
                whiteLogJson[0].push(monitoringLog);
                await jsonStore.updatejson(blackLogJson[0], socket.room+":blackLog");
                await jsonStore.updatejson(whiteLogJson[0], socket.room+":whiteLog");

                var logArr = [];
                logArr.push(monitoringLog);
                socket.emit('BlackLog', logArr);
                socket.emit('WhiteLog', logArr);
            }
            
        });

        // [Monitoring] monitoringLog 스키마 데이터 저장- test용(하드코딩)
        socket.on('Put_MonitoringLog', async(corp) => {
            console.log('Put_MonitoringLog CALLED  : ', corp);
            
            // var test = {
            //     time : "00:11:22",
            //     nickname : "test1",
            //     targetCompany : "companyA",
            //     targetSection : "Area_DMZ",
            //     actionType : "Detected",
            //     detail : "test"
            // };
            // var test2 = {
            //     time : "00:11:22",
            //     nickname : "test1",
            //     targetCompany : "companyA",
            //     targetSection : "Area_Sec",
            //     actionType : "Detected",
            //     detail : "test"
            // };

            // var test3 = {
            //     time : "00:11:22",
            //     nickname : "test1",
            //     targetCompany : "companyB",
            //     targetSection : "Area_DMZ",
            //     actionType : "Response",
            //     detail : "test"
            // };
            // var test4 = {
            //     time : "00:11:22",
            //     nickname : "test1",
            //     targetCompany : "companyB",
            //     targetSection : "Area_Sec",
            //     actionType : "Damage",
            //     detail : "test"
            // };

            //var monTest = [test, test2, test, test2, test, test2, test3, test4, test3, test4,test3, test4];
            //jsonStore.storejson(monTest, socket.room+":whiteLog");
            
        });

        // [Monitoring] monitoringLog 스키마 데이터 보내기
        socket.on('Get_MonitoringLog', async(corp) => {
            console.log('Get_MonitoringLog CALLED  : ', corp);
            const monitoringLogJson = JSON.parse(await jsonStore.getjson(socket.room+":whiteLog"));

            var jsonArray = [];
            console.log('Get_MonitoringLog Result : ', monitoringLogJson[0].length);
            for (var i=0; i<monitoringLogJson[0].length; i++) {
                if(monitoringLogJson[0][i]["targetCompany"] == corp){
                    var newResult = {
                        time : monitoringLogJson[0][i]["time"],
                        nickname : monitoringLogJson[0][i]["nickname"],
                        targetCompany : corp,
                        targetSection : monitoringLogJson[0][i]["targetSection"],
                        actionType : monitoringLogJson[0][i]["actionType"],
                        detail : monitoringLogJson[0][i]["detail"]
                    }
                    jsonArray.push(newResult);
                } 
            }
            console.log('Get_MonitoringLog NEW Result Length : ', jsonArray.length);
            //console.log("@@@@@@@@ MonitoringLog @@@@@@@ ",  jsonArray);
            socket.emit('MonitoringLog', jsonArray);
        });

        // // [GmaeLog] GmaeLog Black 스키마 데이터 보내기 => 한줄씩 보내기 안되납?
        // socket.on('Put_BlackLog', async(newLog) => {
        //     console.log('Put_BlackLog CALLED >> ', newLog);
        //     var logList = [newLog];
        //     console.log('Put_BlackLog CALLED >> ', logList);
        //     socket.emit('BlackLog', logList);
        // });

        // // [GmaeLog] GmaeLog White 스키마 데이터 보내기
        // socket.on('Put_WhiteLog', async(newLog) => {
        //     console.log('Put_WhiteLog CALLED', newLog);
        //     //var logList = [newLog];
        //     // console.log('Put_WhiteLog CALLED >> ', logList);
        //     // socket.emit('WhiteLog', logList);
        // });
// ===================================================================================================================
        
        socket.on('disconnect', async function() {
            console.log('A Player disconnected!!! - socket.sessionID : ', socket.sessionID);
            clearInterval(timerId)
            clearInterval(pitaTimerId);
            console.log("[disconnect] 타이머 종료!");

            await leaveRoom(socket, socket.room);
            await sessionStore.deleteSession(socket.sessionID);
        });
    })

    // [room] 방 키 5자리 랜덤 
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


    // 현재 날짜 문자열 생성
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
    }

    async function createRoom(roomType){
        //  1. redis - room에 저장
        var roomPin = randomN();
        var creationDate = nowDate();

        var room_info = {
            'creationDate' : creationDate,
            'roomType' : roomType,
        };

        await redis_room.createRoom(roomPin, room_info);

        // 2. redis - roomManage/'roomKey' 저장
        var room_info = {
            'roomType' : roomType,
            'creationDate' : creationDate,
            'userCnt' : 0,
            'whiteUserCnt' : 0,
            'blackUserCnt' : 0,
            'blackPlacement' : '4321',
            'whitePlacement' : '4321',
            'toBlackUsers' : [],
            'toWhiteUsers' : [],
        };

        hashtableStore.storeHashTable(roomPin, room_info, 'roomManage');

        // 3. redis - roomManage/publicRoom 또는 roomManage/privateRoom 에 저장
        var redisroomKey =  roomType +'Room';
        listStore.rpushList(redisroomKey, roomPin, false, 'roomManage');

        return roomPin
    };


    // Init waitingroom   
    // async function initRoom(roomPin){
    //     var userPlacement = {
    //         blackPlacement : [4,3,2,1], // Unity 자리 위치 할당 관리 큐
    //         whitePlacement : [4,3,2,1],
    //         toBlackUsers : [], // teamChange 대기 큐(사용자 고유 id 저장)
    //         toWhiteUsers:  []
    //     }

    //     // redis에 저장
    //     jsonStore.storejson(userPlacement, roomPin);
    //     const userPlacement_Redis = await jsonStore.getjson(roomPin);
    //     console.log("!@#!@#!@", JSON.parse(userPlacement_Redis));
    // };


    // 공개방/비공개 방 들어갈 수 있는지 확인 (검증 : 룸 존재 여부, 룸 full 여부)
    async function UpdatePermission(roomPin){
         /*
                < 로직 > 
                1. 해당 룸 핀이 있는지 확인
                2. 해당 룸에 들어갈 수 있는지 (full상태 확인)
                3. permission 주기 (socket.room 저장, 방 상태 update 및 cnt ++)
        */

        // 1. 해당 룸 핀이 있는지 확인
        if (! await redis_room.IsValidRoom(roomPin)) { 
            console.log("permission False - no Room");
            return false
        }

        // 2. 해당 룸에 들어갈 수 있는지 (full상태 확인)
        console.log("room_member 수", await redis_room.RoomMembers_num(roomPin))
        // 바꿔야 함 << 수정 필요 >> 여기가 아닌 roomManage/key 의 cnt ++ -> 아니 필요없음
        if (await redis_room.RoomMembers_num(roomPin) >= 8){
            console.log("permission False - room Full");
            return false
        }

        // 바꿔야 함 << 수정 필요 >> -> 아니다 이건 add user에서 처리해줘야 함  --> 아니 필요없음
        // 3. permission 주기 (, 방 상태 update 및 cnt ++)
        // add user에서 cnt 변경하기
        // roomManage/key 의 cnt ++
        // socket.room 저장은 return 후 호출한 곳에서 해주자
        
        return true
       
    };

    // 방 나가는  함수
    async function leaveRoom(socket, roomPin){

        // 1. 해당 인원이 나가면 room null인지 확인 (user 0명인 경우 룸 삭제)
        if (await redis_room.RoomMembers_num(roomPin) <= 1){
            console.log("[룸 삭제]!");
            redis_room.deleteRooms(roomPin); // 1) redis 기본 room 삭제

            var redisroomKey = await hashtableStore.getHashTableFieldValue(roomPin, ['roomType'], 'roomManage'); // 3번 과정을 위해 roomType 가져오기
            console.log('redisroomKey : ',redisroomKey, 'roomPin : ', roomPin);
            console.log('hashtableStore.deleteHashTable', hashtableStore.deleteHashTable(roomPin,'roomManage')); // 2) roomManage room 삭제
            console.log('listStore.delElementList : ', listStore.delElementList(redisroomKey[0] + 'Room', 0, roomPin, 'roomManage')); // 3) roomManage list에서 삭제
        }
        else{
            // 1) roomManage room 인원 수정
            // userCnt, blackUserCnt/whiteUserCnt, blackPlacement/whitePlacement 수정 필요
            var roomManageInfo = await hashtableStore.getAllHashTable(roomPin, 'roomManage'); ;
            console.log("roomManageInfo" , roomManageInfo);

            roomManageInfo.userCnt = roomManageInfo.userCnt - 1; // userCnt 변경

            if (socket.team){ // blackUserCnt/whiteUserCnt, blackPlacement/whitePlacement  팀 변경
                roomManageInfo.whiteUserCnt = roomManageInfo.whiteUserCnt - 1;
                await DeplaceUser(socket.team, await redis_room.getMember(socket.room, socket.userID).place); // blackPlacement/whitePlacement  -> DeplaceUser
            }else{
                roomManageInfo.blackUserCnt = roomManageInfo.blackUserCnt - 1;
                await DeplaceUser(socket.team, await redis_room.getMember(socket.room, socket.userID).place);  // blackPlacement/whitePlacement  -> DeplaceUser
            }

            await hashtableStore.storeHashTable(room, roomManageDict, 'roomManage');


            // 2)  Redis - room 인원에서 삭제
            redis_room.delMember(roomPin, socket.userID);


            // 3) roomManage list 인원 확인 (함수로 따로 빼기)
            // 만약 해당 룸이 full이 아니면 list에 추가해주기
            if (await redis_room.RoomMembers_num(roomPin) < 8){
                var redisroomKey =  roomManageInfo.roomType +'Room';
                listStore.rpushList(redisroomKey, roomPin, false, 'roomManage');
                console.log("roomManage의 list에 추가됨");
            }
            
        }
        
        // 3. 방에 emit하기 (나갈려고 하는 사용자에게 보냄)
        io.sockets.in(roomPin).emit('logout'); 
        // 3. 방에 emit하기 (그 외 다른 사용자들에게 나간 사람정보 보냄_
        socket.broadcast.to(roomPin).emit('userLeaved',socket.userID);  
    

        // 4. (join삭제) socket.leave(room) 
        socket.leave(roomPin);

        // 5. 나머지 room 관련 정보 socket에서 삭제해주기!!
       // << 코드 미정 >>
    };


    // [GameStart] 게임시작을 위해 게임 스키마 초기화 
    function InitGame(room_key, blackUsersInfo, whiteUsersInfo){
        console.log("INIT GAME 호출됨------! blackUsersID", blackUsersInfo);


        /*
            var blackUsers = [ user1ID, user2ID, user3ID ];
        */

        // RoomTotalJson 생성 및 return 
        var userCompanyStatus = new UserCompanyStatus({
            warnCnt    : 0,
            detectCnt : 0,
            IsBlocked   : false, //무력화 상태
        });

        var blackUsers = {};
        var whiteUsers = {};

        for (const user of blackUsersInfo){
            blackUsers[user.UsersID] = new BlackUsers({
                userId   : user.UsersID,
                profileColor : user.UsersProfileColor,
                currentLocation : "",
                companyA    : userCompanyStatus,
                companyB    : userCompanyStatus,
                companyC    : userCompanyStatus,
                companyD    : userCompanyStatus,
                companyE    : userCompanyStatus,
            });
        }

        for (const user of whiteUsersInfo){
            whiteUsers[user.UsersID] =  new WhiteUsers({
                userId   : user.UsersID,
                profileColor : user.UsersProfileColor,
                currentLocation : ""
            })
        }
    
        var progress = new Progress({
            progress  : [],
            last  : -1
        })

        var initCompany = new Company({
            abandonStatus : false,
            penetrationTestingLV : [1,1,1,1,1,1,1,1,1,1,1,1,1],
            attackLV : [0,0,0,0,0,0,0,0,0,0,0,0,0],
            sections : [
                new Section({
                destroyStatus  : false ,
                level  : 0,
                vuln : 0,
                vulnActive : false,
                attackStep : 0,
                responseStep : 0,
                attack : progress,
                response : progress,
                }),

                new Section({
                    destroyStatus  : false ,
                    level  : 0,
                    vuln : 1,
                    vulnActive : false,
                    attackStep : 0,
                    responseStep : 0,
                    attack : progress,
                    response : progress,
                }),

                new Section({
                    destroyStatus  : false ,
                    level  : 0,
                    vuln : 2,
                    vulnActive : false,
                    attackStep : 0,
                    responseStep : 0,
                    attack : progress,
                    response : progress,
                }),
            ]
        });


        var RoomTotalJson  = {
            roomPin : room_key,
            server_start  : new Date(),
            server_end  :  new Date(),
            blackTeam  : new BlackTeam({ 
                total_pita : 500,
                users : blackUsers
            }),
            whiteTeam  : new WhiteTeam({ 
                total_pita : 500,
                users : whiteUsers
            }),
            companyA    : initCompany,
            companyB    : initCompany,
            companyC    : initCompany,
            companyD    : initCompany,
            companyE    : initCompany,
        };
      

        return RoomTotalJson
    }

    

    // 공격 별 n초 후 공격 성공
    async function attackCount(socket, roomTotalJson, attackJson, cardLv, step){
        var attackStepTime = setTimeout(async function(){
            socket.to(socket.room).emit("Attack Step", step);
            socket.emit("Attack Step", step);

            // let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("White Team Response list (attackCount) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"]);
            console.log("Black Team Attack list (attackCount) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"]);

            if (step == 6) {
                roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["destroyStatus"] = true;
                console.log("destory section!! section : ", attackJson.sectionIndex, ", destroyStatus : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["destroyStatus"]); 

                sectionDestroy = {company : attackJson.companyName, section : attackJson.sectionIndex};
                var destroyJson = JSON.stringify(sectionDestroy);
                socket.to(socket.room).emit("Section Destroy", destroyJson);
                socket.emit("Section Destroy", destroyJson);

                socket.to(socket.room).emit('is_All_Sections_Destroyed', attackJson.companyName);
                socket.emit('is_All_Sections_Destroyed', attackJson.companyName);


                const blackLogJson = JSON.parse(await jsonStore.getjson(socket.room+":blackLog"));
                const whiteLogJson = JSON.parse(await jsonStore.getjson(socket.room+":whiteLog"));

                let today = new Date();   
                let hours = today.getHours(); // 시
                let minutes = today.getMinutes();  // 분
                let seconds = today.getSeconds();  // 초
                let now = hours+":"+minutes+":"+seconds;

                var sectionNames = [["Area_DMZ", "Area_Interal", "Area_Sec"], ["Area_DMZ", "Area_Interal", "Area_Sec"],["Area_DMZ", "Area_Interal", "Area_Sec"],["Area_DMZ", "Area_Interal", "Area_Sec"],["Area_DMZ", "Area_Interal", "Area_Sec"]];
                var companyIdx =  attackJson.companyName.charCodeAt(0) - 65;
                let tSection = attackJson.sectionIndex;
                var monitoringLog = {time: now, nickname: "", targetCompany: attackJson.companyName, targetSection: sectionNames[companyIdx][tSection], actionType: "Damage", detail: sectionNames[companyIdx][tSection]+"가 파괴되었습니다."};
                console.log("MonitoringLog Section 파괴 TEST >> ", monitoringLog);

                blackLogJson[0].push(monitoringLog);
                whiteLogJson[0].push(monitoringLog);
                await jsonStore.updatejson(blackLogJson[0], socket.room+":blackLog");
                await jsonStore.updatejson(whiteLogJson[0], socket.room+":whiteLog");
                
                var logArr = [];
                logArr.push(monitoringLog);
                socket.emit('BlackLog', logArr);
                socket.emit('WhiteLog', logArr);
            }

            if (step > roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attackStep"]){
                roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attackStep"] = step;
                roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["responseStep"] = step;
            }

            console.log("[setTimeout] roomTotalJson attack step ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attackStep"]);
            console.log("[setTimeout] roomTotalJson attack step, step ", step);

            await jsonStore.updatejson(roomTotalJson[0], socket.room);
            roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));                

            console.log("attack step after edit json (attackCount) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attackStep"]);

            clearTimeout(attackStepTime);

        }, config["ATTACK_" + (attackJson.attackIndex + 1)]["time"][cardLv] * 1000);
    }

    // 공격 별 n초 후 관제 리스트로 넘기기
    async function monitoringCount(socket, roomTotalJson, attackJson, cardLv){
        var monitoringTime = setTimeout(async function(){
            // let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));

            var attackList = roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"];
            let delIndex = -1;
            for(var i = 0; i < attackList.length; i++){ 
                if (Object.keys(attackList[i]) == attackJson.attackIndex) { 
                    delIndex = i
                    console.log("Delete Response attack in Response List : ", i);
                    break;
                }
            }

            console.log("monitoring success? : ", Boolean(delIndex));

            console.log("White Team Response list (monitoringCount) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"]);
            console.log("Black Team Attack list (monitoringCount) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"]);

            if (delIndex > -1){
                delete roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"][attackJson.attackIndex];

                let json = new Object();
                json[attackJson.attackIndex] = socket.userID;
                attackList.splice(i, 1); 
                roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"].push(json);
                roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["last"] = attackJson.attackIndex;

                let responseProgress = []
                for(var i in roomTotalJson[0][attackJson.companyName]){
                    console.log("responseIndex : ", roomTotalJson[0][attackJson.companyName][i]);
                    responseProgress.push(Number(Object.keys(roomTotalJson[0][attackJson.companyName][i])));
                }
                
                console.log("responseProgress", responseProgress);

                socket.to(socket.room).emit('Load Response List', responseProgress);
                socket.emit('Load Response List', responseProgress);

                roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"] = attackList;

                console.log("[timeout] roomTotalJson[0][attackJson.companyName]['sections'][attackJson.sectionIndex]['attack']['progress']", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"]);
                console.log("[timeout] roomTotalJson[0][attackJson.companyName][sections][attackJson.sectionIndex][response][progress]", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"]);

                // white room으로 response list 보내기 -> 해당 공격들만 활성화 시키기


                console.log("Done Monitoring atttck : ", attackJson.attackIndex);

                await jsonStore.updatejson(roomTotalJson[0], socket.room);
                roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
                console.log("White Team Response list (timeout) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["response"]["progress"]);
                console.log("Black Team Attack list (timeout) : ", roomTotalJson[0][attackJson.companyName]["sections"][attackJson.sectionIndex]["attack"]["progress"]);
            
                clearTimeout(monitoringTime);
                
            } else {
                console.log("what the");
            }

        }, config["RESEARCH_" + (attackJson.attackIndex + 1)]["time"][cardLv] * 1000);
    }

    // 대응 별 n초 후 공격 성공
    async function responseCount(socket, roomTotalJson, responseJson, cardLv){
        var attackStepTime = setTimeout(async function(){

            // response list에서 대응 성공한 공격 삭제
            var responseList = roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["response"]["progress"];
            for(var i = 0; i < responseList.length; i++){ 
                if (Object.keys(responseList[i]) == responseJson.attackIndex) { 
                    console.log("Delete Response attack in Response List : ", i);
                    responseList.splice(i, 1); 
                    break;
                }
            }

            // var attackList = roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attack"]["progress"];
            // for(var i = 0; i < attackList.length; i++){ 
            //     if (Object.keys(attackList[i]) == responseJson.attackIndex) { 
            //         console.log("Delete Response attack in Response List : ", i);
            //         attackList.splice(i, 1); 
            //         break;
            //     }
            // }

            let step; // attack Step

            let responseProgress = []
            for(var i in responseList){
                console.log("responseIndex : ", responseList[i]);
                responseProgress.push(Number(Object.keys(responseList[i])));
            }

            console.log("Math.max(...responseList) ; ", Math.max(...responseProgress));
            console.log("response lsit(before maxattack) : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["response"]["progress"]);
            if (responseList.length == 0){
                step = 0;
            } else {
                let maxAttack = Math.max(...responseProgress);
                if (0 <= maxAttack && maxAttack < 4){
                    step = 1;
                } else if (maxAttack == 4){
                    step = 2;
                } else if (maxAttack == 5){
                    step = 3;
                } else if (maxAttack == 6){
                    step = 4;
                } else if (7 <= maxAttack && maxAttack <= 10){
                    step = 5;
                } else if (11 <= maxAttack && maxAttack <= 12){
                    step = 6;
                }
            }

            socket.to(socket.room).emit('Load Response List', responseProgress);
            socket.emit('Load Response List', responseProgress);            

            socket.to(socket.room).emit("Response Step", step - 1);
            socket.emit("Response Step", step - 1);

            roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["response"]["progress"] = responseList;
            roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attack"]["progress"] = attackList;

            // let roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));
            console.log("White Team Response list (responseCount) : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["response"]["progress"]);
            console.log("Black Team Attack list (responseCount) : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attack"]["progress"]);

            if (step < roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attackStep"]){
                roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attackStep"] = step;
                roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["responseStep"] = step;
            }

            console.log("[setTimeout] roomTotalJson response step ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attackStep"]);
            console.log("[setTimeout] roomTotalJson response step, step ", step);

            await jsonStore.updatejson(roomTotalJson[0], socket.room);
            roomTotalJson = JSON.parse(await jsonStore.getjson(socket.room));                

            console.log("attack step after edit json (attackCount) : ", roomTotalJson[0][responseJson.companyName]["sections"][responseJson.sectionIndex]["attackStep"]);

            clearTimeout(attackStepTime);

        }, config["ATTACK_" + (responseJson.attackIndex + 1)]["time"][cardLv] * 1000);
    }
    
}

