/* abstract */ class RoomStore {
    findRooms() {} // 현재 생성된 방 리스트 반환
    checkRooms(room) {} // 해당 방의 존재 여부
    saveRoomPlayer(room, playerID, name) {} // 특정 방에 플레이어 추가 (playerID는 socket.UID)
    findRoomPlayers(room) {} // 해당 방의 플레이어 리스트 반환
    deletePlayer(room, playerID, name) {} // 해당 플레이어가 특정 방을 나감
    deleteRoom(room) {} // 방 자체를 없앰
  }
  
  class InMemoryRoomStore extends RoomStore {
    constructor() {
        super();
        this.rooms = new Map();
    }

    checkRooms(room) {
        if (this.rooms.get(room) == null) {
            return false;
        } else {
            return true;
        }
    }

    findRooms() { // 현재 생성된 방 리스트 반환
        console.log("findRooms : ", [...this.rooms.keys()]);
        return [...this.rooms.keys()];
    }

    findRoomPlayers(room) { // 해당 방의 플레이어 리스트 반환
        // 만약에 찾고자 하는 방이 없으면 1을 리턴
        if (this.rooms.get(room) == null) {
            console.log("findRoomPlayers : 방 없어서 1 리턴");
            return 1;
        } else {
            console.log("findRoomPlayers : ", this.rooms.get(room));
            return this.rooms.get(room);
        }
    }

    deletePlayer(room, player) { // 해당 플레이어가 특정 방을 나감
        if (this.rooms.get(room) == null) {
            console.log("deletePlayer : 방 없음");
        } else {
            var del = this.rooms.get(room)
            del = del.filter(function(item) {
                return item[0] !== player
            });           
            if (del.length == 0){ // 현재 나가는 플레이어가 이 방의 마지막 인원인 경우 방까지 삭제
                this.rooms.delete(room);
            } else {
                this.rooms.set(room, del);
            }
            console.log("deletePlayer : ", this.rooms.keys(), this.rooms.values());
        }
    }

    saveRoomPlayer(room, playerID, name) { 
        this.rooms.set("test", [[1111, 44]]);
        console.log(this.rooms.keys(), this.rooms.values());
        if (this.rooms.get(room) == null) {
            //방이 존재하지 않는 경우 바로 SET
            console.log("no exists!!");
            this.rooms.set(room, [[playerID, name]]);
            console.log("saveRoomPlayer : ", this.rooms.keys(), this.rooms.values());
        } else {
            //방이 존재하는 경우
            console.log("exists!!");
            var players = []
            players = this.rooms.get(room);
            players.push([playerID, name]);
            this.rooms.set(room, players);
            console.log("saveRoomPlayer : ", this.rooms.keys(), this.rooms.values());
        }
        //this.rooms.set(room, player);
    }

    deleteRoom(room) {
        this.rooms.delete(room);
    }
  }
  
//   const SESSION_TTL = 24 * 60 * 60;
//   const mapSession = ([userID, username, connected]) =>
//     userID ? { userID, username, connected: connected === "true" } : undefined;
  
  class RedisRoomStore extends RoomStore {
    constructor(redisClient) {
      super();
      this.redisClient = redisClient;
    }

    deletePlayer(room, playerID, name) {
        this.redisClient.lrem(`room:${room}`, 0, name);
        this.redisClient.lrem(`room:${room}`, 0, playerID);
    }

    saveRoomPlayer(room, playerID, name) { 
        this.redisClient.lpush(`room:${room}`, [playerID, name]);

    }

    async findRoomPlayers(room) { // 해당 방의 플레이어 리스트 반환
        var check = await this.redisClient.exists(`room:${room}`);
        console.log("findRoomPlayers : ", check, `room:${room}`);
        if (check === 1){
            var plist = []
            var tmp = await this.redisClient.lrange(`room:${room}`, 0, -1);

            for(var i=0; i<tmp.length; i+=2){
                plist.push([tmp[i], tmp[i+1]]);
            }
            console.log("findRoomPlayers : ", tmp, plist);
            return plist;
        //}// 만약에 찾고자 하는 방이 없으면 []을 리턴
        } else{// 만약에 찾고자 하는 방이 없으면 1을 리턴
            console.log("findRoomPlayers : 방 없어서 1 리턴");
            return 1;
        }
    }

    async deleteRoom(room) {
        var check = await this.redisClient.exists(`room:${room}`);
        if (check == 1){
            this.redisClient.del(`room:${room}`);
        }
    }
  
    // findSession(id) {
    //   return this.redisClient
    //     .hmget(`session:${id}`, "userID", "username", "connected")
    //     .then(mapSession);
    // }
  
    // saveSession(id, { userID, username, connected }) {
    //   this.redisClient
    //     .multi()
    //     .hset(
    //       `session:${id}`,
    //       "userID",
    //       userID,
    //       "username",
    //       username,
    //       "connected",
    //       connected
    //     )
    //     .expire(`session:${id}`, SESSION_TTL)
    //     .exec();
    // }

    // async deleteSession(id) {
    //     let check = await this.redisClient.exists(`session:${id}`);
    //     console.log(check);
    //     if (check == 1){
    //         this.redisClient.hdel(`session:${id}`, "userID", "username", "connected");
    //     }
    // }
  
    // async findAllSessions() {
    //   const keys = new Set();
    //   let nextIndex = 0;
    //   do {
    //     const [nextIndexAsStr, results] = await this.redisClient.scan(
    //       nextIndex,
    //       "MATCH",
    //       "session:*",
    //       "COUNT",
    //       "100"
    //     );
    //     nextIndex = parseInt(nextIndexAsStr, 10);
    //     results.forEach((s) => keys.add(s));
    //   } while (nextIndex !== 0);
    //   const commands = [];
    //   keys.forEach((key) => {
    //     commands.push(["hmget", key, "userID", "username", "connected"]);
    //   });
    //   return this.redisClient
    //     .multi(commands)
    //     .exec()
    //     .then((results) => {
    //       return results
    //         .map(([err, session]) => (err ? undefined : mapSession(session)))
    //         .filter((v) => !!v);
    //     });
    // }
  }
  module.exports = {
    InMemoryRoomStore,
    RedisRoomStore,
  };
  