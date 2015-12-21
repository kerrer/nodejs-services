var _dnode = require('dnode'),	extend = require('util')._extend;
var net = require('net');
var async=require('async');
var run_services={};
var path = require('path');

process.on("message",function(obj){ 
	var files = obj.data.services;
	var host = obj.data.host;
	var port = obj.data.port;
	
	var svf=path.join(process.env.SVR_DIR,"modules");	
	
    async.each(files, function(file, callback) {
		var s = requireUncached(svf + file);
		extend(run_services, s.services);
		callback();		
	}, function(error){
		if( error ) {
			console.log("start service: ",error.message);			
		}else if(obj.type==="start"){		
			var server = net.createServer(function (c) {
				var d = _dnode(run_services); 
				d.on('error',function(err){
					console.log("socker"+ err);   
					var s= {method:42,arguments:[{"error":{"status":err.statusCode,"msg":err.message}}],callbacks:{},links:[]};
					c.write(JSON.stringify(s));
					c.end();
				});	
				c.pipe(d).pipe(c);
			});	
			server.listen(port,host);		
		}//else		 			
	});	//async.each
});

process.on('uncaughtException', function(err) {
        console.log("error: ",err.message,err.stack);     
       
});
process.on('unhandledRejection', function(reason, p) {
    console.log("Unhandled Rejection at: Promise ", p, " reason: ", reason);
    // application specific logging, throwing an error, or other logic here
});
function requireUncached(module){
    delete require.cache[require.resolve(module)]
    return require(module)
}
