var Promise = require('bluebird');
var ejs = require('ejs');
var path = require('path');
var fs = require('fs');
var forever = require('forever');
forever.load({root:path.join(process.env.PWD,'.forever'),debug:false});

function initForever(options){
	return new Promise(function (resolve, reject){
		var tempdir=path.join(process.env.PWD,'.tmp');
		if(!fs.existsSync(tempdir)){
			fs.mkdirSync(tempdir);
		}
	
		var server_file=path.join(tempdir,'forever.js'); 
		var fun_template = fs.readFileSync(path.join(__dirname,"..", "ejs","forever.ejs"),'utf8');
		var data = ejs.render(fun_template, {options:options});
	
		fs.writeFileSync(server_file, data, 'utf8');
		resolve(server_file);
	});	
}

function Forever(options){
	var deamon= {};
	deamon.start=function(){ 
		initForever(options).then(function(file){
			forever.startDaemon(file,{
				max: 3,
				silent: true
			});
		},function(error){ console.log(error);
			return null;
		});
	};
	
	deamon.shutdown=function(){
		forever.stop();
	};
	
	return deamon;
}


exports['default'] = Forever;
module.exports = exports['default'];
