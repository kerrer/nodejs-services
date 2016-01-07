var expect = require('expect.js');
var io =  require('socket.io-client');
describe('socket', function(){

  it('should have an accessible socket id equal to the engine.io socket id', function(done) {
   var socket = io('http://localhost:3210',{ forceNew: true });
    socket.on('connect', function(){
      expect(socket.id).to.be.ok();
      expect(socket.id).to.eql(socket.io.engine.id);
      socket.disconnect();
      done();
    });
  });
  
  it('should connect to localhost', function(done){
    var socket = io('http://localhost:3210',{ forceNew: true });
    socket.emit('hi','from test test');
    socket.on('hi', function(data){
	  console.log(data);
      socket.disconnect();
      done();
    });
  });
 
});


