'use strict';

const _Etcd = require('node-etcd'),
	_dnode = require('dnode'),
	_fs =  require('fs'),
	path = require('path'),
	S = require('string'),
    _ = require('lodash');

const Promise = require('bluebird');
const pfs = require("promised-io/fs");
const async=require('async');
const Err=require('exception');
const Log=require('log')();

const util = require('util');
const EventEmitter = require('events').EventEmitter;

let etcd;
let cluster,numCPUs,config;

var service = function(server) {
    var self = this;   
    
    //this.on('newListener', function(listener) {
    //    Log.info('Event Listener: ' + listener);
    //});
    
    this.monitor=function(){
		var io = require('socket.io');
		var server = io(3210, { pingInterval: 2000 });
		server.on('connection', function(socket){
			socket.on('hi', function(data){
				console.log(data);
				socket.emit('hi', new Date());
				self.emit('test',data);
			});
			socket.on('',function(){
				
			});
		});
	};
	
    //start events
    this.on('start', function(node) {	
		node && (server.node = node); 
		async.parallel([
			function(callback){
				registerServices(server).then(function(){ callback(null, 1); },function(error){ callback(error); });
			},
			function(callback){
				start(server).then(function(){ self.monitor();callback(null, 2); },function(error){ callback(error); });	
			}
		],
		function(error, results){
			if(error){
				Log.error(error);
				self.emit('error',error.message);
			}else{
				self.emit('done',"services have been started!");
			}
		}); 
    });
    
	this.on('stop', function() {
		async.parallel([
			function(callback){
				purgeServices(server).then(function(){ callback(null, 1); },function(error){ callback(error); });	
			},
			function(callback){
				shutdown().then(function(){ callback(null, 2); },function(error){ callback(error); });	
			}
		],
		function(error, results){
			if(error){
				Log.error(error);
				self.emit('error',error.message);
			}else{
				self.emit('done',"all services stoped!");
			}
		}); 
    });
    
    this.on('reload', function() {
		async.parallel([
			function(callback){
				purgeServices(server).then(function(){ 
					registerServices(server).then(function(){ callback(null, 1); },  function(error){ callback(error); });
				},function(error){ 
					callback(error); 
				});	
			},
			function(callback){
				reloadService(server).then(function(){ callback(null, 2); },function(error){ callback(error); });	
			}
		],
		function(error, results){
			if(error){
				Log.error(error);
				self.emit('error',error.message);
			}else{
				self.emit('done',"all services reload!");
			}
		}); 
    });
    
	this.on('restart', function() {
       async.parallel([
			function(callback){
				purgeServices(server).then(function(){ 
					registerServices(server).then(function(){ callback(null, 1); },  function(error){ callback(error); });
				},function(error){ 
					callback(error); 
				});
			},
			function(callback){
				shutdown().then(function(){ 
					start(server).then(function(){ callback(null, 2); },function(error){ callback(error); });
				},function(error){ 
					callback(error); 
				});	
			}
		],
		function(error, results){
			if(error){
				Log.error(error);
				self.emit('error',error.message);
			}else{
				self.emit('done',"all services reload!");
			}
		}); 
    });
    
    this.on('register', function() {
        async.series([
			function(callback){
				purgeServices(server).then(function(){ callback(null, 1); },function(error){ callback(error); });	
			},
			function(callback){
				registerServices(server).then(function(){ callback(null, 2); },function(error){ callback(error); });	
			}
		],
		function(error, results){
			if(error){
				Log.error(error);
				self.emit('error',error.message);
			}else{
				self.emit('done',"all services register!");
			}
		}); 
    });
    
    this.on('test', function(data){
		console.log('test');
		Log.debug('test from ',data);
    });
    //end event
};

util.inherits(service, EventEmitter);

function start(server){
	return new Promise(function (resolve, reject){
		var node =  server.node;
		var host = server.host = host || server.host || '127.0.0.1';
		var port = server.port = port || server.port || '5004';
		Log.info('starting services..............');
		pfs.readFile(server.all_files_path,'utf8').then(function(data){
			var files = JSON.parse(data);
			var modules_path =path.join(process.env.SVR_DIR,"modules");	
			var options={type:'start',files:files,host:host,port:port,modules_path:modules_path};
			var instances = server.options.instances || 1; 
			instances = instances > numCPUs ? numCPUs : instances;
			instances ===1 ? require('./rpc').buildRpcServices(options) : 
								runCluster(instances,options,function(error,res){ error && Log.error(error) && reject(); });	//clusterService						
			Log.info('services started!');
			Log.info("It's ALL OK!");
			resolve();
		},function(error){
			Log.error(error);	
			reject(error);
		});//pfs.readFile			
	});//Promise
}
	
function Clean(){
		var server = this;
		return  new Promise(function (fullfill, reject){
			purgeServices(server).done(function(){
			   fullfill(true);	
			});
		});		
}

function shutdown(){
	return new Promise(function (resolve, reject){
		async.forEachOf(cluster.workers, function(worker,id, callback) {
			cluster.workers[id].kill();	
			callback();
		},function(error){
			error && Log.error(error) && reject(error);
			resolve();	   		
		});	//async.forEachOf
	});//promise
}

function get(name,param,cb){
		var s = name.toLowerCase().split(".");

		if(s.length !==2){
			Log.error("Error call service: ",service);
			return cb({"message":"Error call service: "+service});
		}
				
        var server = this;
        async.waterfall([
			function(callback) {	
				getNodes(s).then(function(nodes){ callback(null,nodes);	},function(error){ callback(error); });	
			},
			function(nodes, callback) {
				getBestNode(nodes).then(function(host){ callback(null,host);	},function(error){ callback(error); });
			},
			function(host, callback) {	
				remoteCall(host,param).then(function(result){ callback(null,result);	},function(error){ callback(error); });				
			}
		], function (error, result) {
			if(error){
				Log.error("获取数据发生错误");
				return cb(error);
			}
			
			return cb(null,result)
		});//async.waterfall	
}

function remoteCall(host,param){
	return   new Promise(function (resolve, reject){
		var d = _dnode.connect(host.host,host.port);
		d.on('fail', function(err){	 reject(err); });
		d.on('error', function(err){ reject(err); });
		
		d.on('remote', function (remote) { 
			remote[host.callname](param, function (s) { 
				d.end();
				s.error  ? reject(error) :resolve(s);	
			});
		});		
	});
}

function getNodes(names){
	return   new Promise(function (resolve, reject){
		var nodes={};
		var s_uri= server.projects_prefix + "/" + names.join('/');
		etcd.get(s_uri,{ recursive: true },function(error,body,header){
			error && Log.error(error) && reject(error.error);
			
			if(!body.node.nodes || body.node.nodes.length <1){
			   	reject({"message":"接口请求无法完成！"});
			}
			
			body.node.nodes.forEach(function(node){
				var attrs=JSON.parse(node.value);
				var key=attrs.host + ":" + attrs.port;
				nodes[key]=attrs;
			});
			if( Object.keys(nodes).length ===0){
				reject({"message":"请求接口不存在"});
			}
			resolve(nodes);					
		});//server.etcd.get
	});	
}

function getBestNode(nodes){
	return   new Promise(function (resolve, reject){
		var host=null;
		
		do{
			var num = Object.keys(nodes).length;
			if(num ===1){
				host = Object.keys(nodes)[0];
				break;
			}
			var index= Math.floor(Math.random() * num +1) -1 ;
			host = Object.keys(nodes)[index];
			if(nodes[host].deprecated){
				delete nodes[host];
				host=null;
			}
		}while(!host);	
			
		if(nodes[host].deprecated){
			reject({"message":name + ": " + nodes[host].deprecated});
		}
			
		resolve({host:nodes[host].host,port:nodes[host].port,callname:nodes[host].call_name});
	});
}

function runCluster(instances,options,cb){
	var ejs = require('ejs');
	var tempdir=path.join(process.env.PWD,'.tmp');
	
	if(!_fs.existsSync(tempdir)){
		_fs.mkdirSync(tempdir)
	}
	
	var server_file=path.join(tempdir,'server.js');
	var fun_template = _fs.readFileSync(path.join(__dirname, "ejs","server.ejs"),'utf8');
	var data = ejs.render(fun_template, {ss:''});purgeServices
	_fs.writeFileSync(server_file, data, 'utf8');
		
	cluster.setupMaster({exec:server_file});
	cluster.on('exit',function(worker,code, signal){		
		if( signal ) {
			Log.debug("worker",worker.id," was killed by signal: ", signal);
		} else if( code !== 0 ) {
			Log.debug("worker",worker.id," exited with error code: "+code);				
		} else {
			Log.debug("worker success!");
		}
				
		if (worker.suicide === false && code !== 0) {
			var work = cluster.fork();
		    work.send(options);				   
		}				
	});

	async.each(_.range(instances), function(id, callback) {
		var work = cluster.fork();					
		work.on('error',function(err){
		   Log.error("error handpend: ", err);	
		});
		work.send(options);		
		//work.process.stdout.on('data',function(data){console.log(data.toString())});	
		callback();		
	}, function(error){
		error && Log.error("purger service: ",error.message) && cb(error);
		Log.info("服务正在监听端口:" +options.host + ":" + options.port);	
		cb(null,true);				 			
	});	//async.each  
}
	
function reloadService(server){
	var node = server.node;
	var host = server.host;
	var port = server.port;
		
	return  new Promise(function (resolve, reject){
		pfs.readFile(server.all_files_path,'utf8').then(function(data){
			var files = JSON.parse(data);
			async.forEachOf(cluster.workers, function(worker,id, callback) {
				worker.send({type:'reload',data:{services:files,host:host,port:port}});
				callback();
			},function(error){
				error && Log.error("reload services",error.message) && reject(error);
				resolve();;			   		
			});	//async.forEachOf
		}, function(error) {
			Log.error(error);	
			reject(error);
		});//pfs.readFile
	});//promise
}
	
function registerServices(server){		
	return   new Promise(function (resolve, reject){		
		var node = server.node;
		var host = server.host;
		var port = server.port;

		pfs.readFile(server.all_services_path,'utf8').then(function(data){
			var buffer = new Buffer(JSON.parse("{\"type\":\"Buffer\",\"data\":[" + data + "]}"));
			var services = JSON.parse(buffer.toString());
			var ipkey = host + ":" + port;
			var node_all_services=[];
			var host_uri= server.hosts_prefix + "/" + ipkey + ":" + node;
			
			var regs = {};
		
			async.forEachOf(services, function(item,key, callback) {
				async.each(item, function(service, cb_each) {
					var key= server.projects_prefix + "/"+node + "/" + service.call_name + "/" + ipkey;
					service.host=host;
					service.port=port;
					node_all_services.push(service.call_name);
					regs[key]=JSON.stringify(service);				
				});	//async.each	
			});	//async.forEachOf
			
			regs[host_uri] = JSON.stringify(node_all_services);
		
			async.forEachOf(regs, function(value,key, callback) {
				etcd.set(key,value,function(error,body,header){
					error ? Log.error(error) : null;
					callback();					
				});//etcd.set					
			});	//async.each	
			
			resolve();		
		},function(error){
			Log.error(error);	
			reject(error);
		});//pfs.readFile
	});//promise
}

function purgeServices(server){
	return new Promise(function (resolve, reject){
		var node = server.node;
		var host = server.host;
		var port = server.port;			
		var ipkey = host + ":" + port;
		var hostsKey= server.hosts_prefix + "/" +ipkey + ":" + node;
		var regs =[];
			
		etcd.get(hostUri,function(error,body,header){
			error ? reject(error):null;
			body.node.value ? null : resolve();
			var names = JSON.parse(body.node.value); 
			
			async.each(names, function(name, callback) {
				var key= server.projects_prefix + "/" + node + "/" + name + "/" + ipkey;
				regs.push(key);				
			});
			
			regs.push(hostsKey);
			
			async.each(regs, function(key, callback) {
				etcd.del(key,function(error,body,header){ 	error ? Log.error(error) : null; callback(); });//etcd.del					
			});		
			resolve();			
		});//etcd.get		
	});  //promise		
}
	
function Services(etcd_port,etcd_host) {
	var services = {
		VERSION: '0.1.1',		
		projects_prefix:"/services/projects",
		hosts_prefix:"/services/hosts",
		options:{}
	};
    
    etcd = new _Etcd(etcd_host || '127.0.0.1', etcd_port || '4001');
    services.server=function(port,host){	   
		cluster = require('cluster');
		numCPUs = require('os').cpus().length;
		config = require('config')();
		
		this.port = port || '5004';
	    this.host = host || '0.0.0.0';
	 
        this.all_services_path = path.join(process.env.SVR_DIR, "all.services");
        this.all_files_path = path.join(process.env.SVR_DIR, "all.files");   
	
		return new service(this);
	};
	
	services.client=function(){       
		return this;
	};
   
    services.config=function(options){
		this.options = _.merge(this.options, options);
		return this;
	};
	
	services.get = function(name,param,cb){
		get(name,param,cb);
	};
	
	return services;
}

exports['default'] = Services;
module.exports = exports['default'];
