const url = require('url');
const async = require('async');
const func = require('./server_functions/db_func');
const { Socket } = require('dgram');

module.exports = (io) => {
    
    var gameserver = io.of("blacknwhite");
 
    var rooms ={}; 
    let Players = [];

    io.on('connection', (socket) => {
        console.log("io-handler.js socket connect!!");
        console.log("socketid : "+ socket.id); 
        
    
    
        // socket.on('PlayerEnter', function() {
        //     console.log('A Player ~~!~!~');
        // });


        socket.on('PlayerEnter', function(nickname) {
            console.log("Players >> ");
            let playerInfo = [socket.id, nickname, "false", "false", "0", "7"];
            Players[Players.length]=playerInfo;
            console.log("Players >> ", Players);
            

            // JSON 형식으로 유니티에 데이터 보내기
            Players = {socket : "abcd", nickname: "efg", readyStatus:"false", teamStatus: "false", team: "0", color: "7"};

            console.log("json : ", Players);

            const PlayersJson = JSON.stringify(Players);
            console.log("jsonStringify : ", PlayersJson.toString());
            socket.emit('PlayersData', PlayersJson);
        });

    
        socket.on('disconnect', function() {
            console.log('A Player disconnected!!!');
        });
    })
}

