const socketIO = require('socket.io')(5000);

console.log('Server Start : port 5000');

// on은 클라이언트에서 보낸 이벤트를 실행할 때 사용
socketIO.on('connection', function(socket) {
	console.log('Player Connected');
    
    // emit은 클라이언트에 이벤트를 보낼 때 사용
    socketIO.emit('PlayerConnected');
   
    socketIO.on('disconnect', function() {
        console.log('A Player disconnected');
    });
});