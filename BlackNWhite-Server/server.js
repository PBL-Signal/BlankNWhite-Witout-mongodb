const socketIO = require('socket.io')(5000);

console.log('Server Start : port 5000');

socketIO.on('connection', function(socket) {
	console.log('Player Connected : ', socket.id);
    
    socketIO.emit('PlayerConnected');

   let Players = [];
    socket.on('PlayerEnter', function(nickname) {
        let playerInfo = [socket.id, nickname, "false", "false", "0", "7"];
        Players[Players.length]=playerInfo;
        console.log("Players >> ", Players);
    });

    socketIO.on('disconnect', function() {
        console.log('A Player disconnected');
    });
});