const url = require('url');
const async = require('async');
const func = require('./server_functions/db_func');
const { Socket } = require('dgram');

module.exports = (io) => {
    
    var gameserver = io.of("blacknwhite");
 
    var rooms ={}; 
    let Players = [];
    let gamePlayer = {};
    let evenNumPlayer = false;
    let numPlayer = 1;

    io.on('connection', (socket) => {
        console.log("io-handler.js socket connect!!");
        console.log("socketid : "+ socket.id); 
        
    
    
        // socket.on('PlayerEnter', function() {
        //     console.log('A Player ~~!~!~');
        // });


        socket.on('PlayerEnter', function(nickname) {
            console.log("Players >> ");
            const rand_Color = Math.floor(Math.random() * 12);
            // eval("Players.player" + numPlayer + " = playerInfo")
            let playerOrder = "player" + numPlayer;
            let playerInfo = {playerOrder: playerOrder, socket: socket.id, nickname: nickname, readyStatus: false, teamStatus: false, team: evenNumPlayer, color: rand_Color};
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
            gamePlayer = JSON.parse(jsonStr);

            console.log('new Player info Jsong string : ', jsonStr);
            socket.emit('PlayersData', jsonStr);
        });
        
        socket.on('disconnect', function() {
            console.log('A Player disconnected!!!');
        });
    })
}

