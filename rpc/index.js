var _dnode = require('dnode'),	extend = require('util')._extend;
var net = require('net');
var async=require('async');

function requireUncached(module){
    delete require.cache[require.resolve(module)]
    return require(module)
}

function buildRpcServices(options){
	var files = options.files;
	var host = options.host;
	var port = options.port;
	var modules_path = options.modules_path;
	var run_services={};
	
	async.each(files, function(file, callback) {
		var s = requireUncached(modules_path + file);
		extend(run_services, s.services);
		callback();		
	}, function(error){
		if( error ) {
			console.log("start service: ",error.message);			
		}else if(options.type==="start"){		
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
}

exports.buildRpcServices=buildRpcServices;
