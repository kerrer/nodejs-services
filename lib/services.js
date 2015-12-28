'use strict';

exports.__esModule = true;
var _Etcd = require('node-etcd'),
	_dnode = require('dnode'),
	_fs =  require('fs'),
	path = require('path'),
	S = require('string'),
    _ = require('lodash');

var Promise = require('bluebird');
var async=require('async');
var Err=require('exception');
var Log=require('log')();

var cluster,numCPUs,config;

function Services(etcd_port,etcd_host) {
	var services = {
		VERSION: '0.1.1',		
		projects_prefix:"/services/projects",
		hosts_prefix:"/services/hosts",
		options:{}
	};
    var etcd = new _Etcd(etcd_host || '127.0.0.1', etcd_port || '4001');
    
	services.server=function(port,host){	   
		cluster = require('cluster');
		numCPUs = require('os').cpus().length;
		config = require('config')();
		
		this.port = port || '5004';
	    this.host = host || '0.0.0.0';
	    this.svf=process.env.SVR_DIR;
        this.inif=process.env.SVR_DIR + "/all.services";
        this.inifs=process.env.SVR_DIR + "/all.files";   
		
		return this;
	};
	
	services.client=function(){       
		return this;
	};
   
    services.config=function(options){
		this.options = _.merge(this.options, options);
		return this;
	};
	
	services.start=function(tag,pm2){
		this.tag = tag;
		var server = this;
		registerServices(this).then(function(){
			var tag =  server.tag;
			var host = server.host = host || server.host || '127.0.0.1';
			var port = server.port = port || server.port || '5004';
			Log.info('starting services..............');
			_fs.readFile(server.inifs,'utf8',function(error,data){
				error ? Log.error(error) : null;
				var files = JSON.parse(data);
				var modules_path =path.join(process.env.SVR_DIR,"modules");	
				var options={type:'start',files:files,host:host,port:port,modules_path:modules_path};
				var instances = server.options.instances || 1; 
				instances = instances > numCPUs ? numCPUs : instances;
				if(instances ===1 || pm2){					
					require('./rpc.js').buildRpcServices(options);
				}else{
					runCluster(instances,options,function(error,res){
						error ? Log.error(error) : null;
					});	//clusterService
				}
						
				Log.info('services started!');
				Log.info("It's ALL OK!");
			});	// _fs.readFile				
		},function(error){
			Log.error(error.message);
		});//registerServices
	};
	
    services.restart=function(){
		var server = this;
	    shutdown().then(function(){
			purgeServices(server).done(function(){
				setTimeout(function(){
                  run(server).then(function(){
					Log.info('services restarted!');  
			      });
                }, 1000); //run			  
			});//purgeServices		      
	    });//shutdown
    };
    
    services.reload=function(){
		var server = this;	
		Log.info('reloading services......................');
		purgeServices(server).done(function(res){
			reloadService(server).then(function(){
				Log.info('services reloaded!');
				return true;   
	        },function(error){
				Log.error(error.message);
				return false;
			});//reloadService	  
			return true;
		},function(res){return false;});//purgeServices	    
    };
    
    services.reloadEtcd=function(){
		
	};
	
    services.stop=function(){
	   shutdown().then(function(){
		  return true;   
	   });
    };
    
    services.Clean = function(){
		var server = this;
		return  new Promise(function (fullfill, reject){
			purgeServices(server).done(function(){
			   fullfill(true);	
			});
		});		
	};
    
    function shutdown(){
		return  new Promise(function (fullfill, reject){
			async.forEachOf(cluster.workers, function(worker,id, callback) {
				cluster.workers[id].kill();	
				callback();
			},function(error){
				if(error){
					Log.info("reload services",error.message);
					reject(error);
				}
				fullfill(true);	   		
			});	//async.forEachOf
		});//promise
    }
	
	function runCluster(instances,options,cb){
		cluster.setupMaster({exec: __dirname+ "/server.js"});
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
			if( error ) {
				Log.error("purger service: ",error.message);
				cb(error);
			}
			Log.info("服务正在监听端口:" +options.host + ":" + options.port);	
			cb(null,true);				 			
		});	//async.each  
	}
	
	function reloadService(server){ 
		var tag = server.tag;
		var host = server.host;
		var port = server.port;
		
	  return  new Promise(function (fullfill, reject){	    
        _fs.readFile(server.inifs,'utf8',function(err,data){
			if(err){
			   Log.error(err);	
			   reject(false);
			}
			var files = JSON.parse(data);
			async.forEachOf(cluster.workers, function(worker,id, callback) {
				worker.send({type:'reload',data:{services:files,host:host,port:port}});
				callback();
			},function(error){
				if(error){
					Log.info("reload services",error.message);
					reject(error);
				}
				registerServices(server).then(function(){  fullfill(true); });			   		
			});	//async.forEachOf
		});//_fs.readFile
	  });//promise
	}
	
	
	services.get = function(name,param,cb){
		var s = name.toLowerCase().split(".");

		if(s.length !==2){
			Log.error("Error call service: ",service);
			return cb({"message":"Error call service: "+service});
		}
				
        var server = this;
        async.waterfall([
			function(callback) {			
				var nodes={};
				var s_uri= server.projects_prefix + "/" + s.join('/');
				etcd.get(s_uri,{ recursive: true },function(error,body,header){
					if(error){
						Log.error(error);
						callback(error.error);
					}
					if(!body.node.nodes || body.node.nodes.length <1){
					   	callback({"message":"接口请求无法完成！"});
					}
					body.node.nodes.forEach(function(node){
						var attrs=JSON.parse(node.value);
						var key=attrs.host + ":" + attrs.port;
						nodes[key]=attrs;
					});
					if( Object.keys(nodes).length ===0){
						callback({"message":"请求接口不存在"});
					}
					callback(null,nodes);					
				});//server.etcd.get
			},
			function(nodes, callback) {			
				
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
					callback({"message":name + ": " + nodes[host].deprecated});
				}
				
				callback(null,{host:nodes[host].host,port:nodes[host].port,callname:nodes[host].call_name});
			},
			function(besthost, callback) {	
				var d = _dnode.connect(besthost.host,besthost.port);
				d.on('remote', function (remote) { 
					remote[besthost.callname](param, function (s) { 
						d.end();
						s.error  ? callback(error) :null;					
						callback(null,s);
					});
				});
				d.on('fail', function(err){	 callback(err); });
				d.on('error', function(err){ callback(err); });
			}
			], function (error, result) {
				if(error){
					Log.error("获取数据发生错误");
					return cb(error);
				}
				return cb(null,result)
		});//async.waterfall	
	};

	function registerServices(server){		
		return   new Promise(function (fullfill, reject){		
			var tag = server.tag;
			var host = server.host;
			var port = server.port;
		
			_fs.readFile(server.inif,'utf8',function(err,data){		
				err ? reject(err):null;	
				//Log.debug('registering services.................');
				var buffer = new Buffer(JSON.parse("{\"type\":\"Buffer\",\"data\":[" + data + "]}"));
				var services = JSON.parse(buffer.toString());
				var ipkey = host + ":" + port;
				var calls=[];
				var host_uri= server.hosts_prefix + "/" + ipkey + ":" + tag;
		
				async.forEachOf(services, function(item,key, cb_foreach) {
					async.each(item, function(service, cb_each) {
						var uri= server.projects_prefix + "/"+tag + "/" + service.call_name + "/" + ipkey;
						service.host=host;
						service.port=port;
						calls.push(service.call_name);
						etcd.set(uri,JSON.stringify(service),function(error,body,header){
							error ? cb_each(error):cb_each();;						
						});//etcd.set					
					}, function(error){
						error ? cb_foreach(error): cb_foreach();
					});	//async.each	
				}, function(error){
					if(error){
						 Log.error("regist services error: ",error.message,error.stack);
						 reject(error);
				    }else{
						etcd.set(host_uri,JSON.stringify(calls),function(error,body,header){
							error ? reject(error): fullfill(true);						
						});							
					}//else			
				});	//async.forEachOf
			});//_fs.readFile
		});//promise
	}

	function purgeServices(server){		
		return   new Promise(function (fullfill, reject){
			var tag = server.tag;
			var host = server.host;
			var port = server.port;			
			var ipkey = host + ":" + port;
			var hostUri= server.hosts_prefix + "/" +ipkey + ":" + tag;
					
			etcd.get(hostUri,function(error,body,header){
					error ? reject(error):null;
					body.node.value ? null : fullfill(true);
					var names = JSON.parse(body.node.value); 
					async.each(names, function(name, callback) {
						var uri= server.projects_prefix + "/" + tag + "/" + name + "/" + ipkey;
						var res = etcd.del(uri,function(error,body,header){
							error ? callback(error): null;
							callback();
						});//etcd.del					
					}, function(error){
						if( error ) {
							Log.error("purger service: ",error.message);
							reject(error);
						} 
						etcd.del(hostUri,function(error,body,header){
							error ? reject(error): null;
							fullfill("purged!");
						});				
					});	//async.each				
			});//etcd.get		
		});  //promise		
	}

	return services;
}

Services.initialize = function (etcd_host,etcd_port) {
	etcd_host = etcd_host || '127.0.0.1';
	etcd_port = etcd_port || '4001';
	return new Services(etcd_host, etcd_port);
};

// Finally, export `Bookshelf` to the world.
exports['default'] = Services;
module.exports = exports['default'];

//end
