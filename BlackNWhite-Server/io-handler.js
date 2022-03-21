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
            socket.emit('PlayersData', Players);
        });

    
        socket.on('disconnect', function() {
            console.log('A Player disconnected!!!');
        });
    })
}

