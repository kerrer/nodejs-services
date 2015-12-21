/**
 * New node file
 */
var Service= require('../services')();
//Service.set();
Service.Get("DOCTOR.GETHOSTLIST",{'beep':'sdfasdfs'},function(data){
	console.log("data:");
	console.log(data);
});