/**
 * New node file
 */
var Service= require('../services')();
var fs =  require('fs');
var file= __dirname + "/" + "services.txt";

fs.readFile(file,'utf8',function(err,data){
	console.log(data);
	var buf = new Buffer(JSON.parse(data));
	//console.log(buf.toString());
	//Service.RegisterService('doctor','localhost','5004',service);
});