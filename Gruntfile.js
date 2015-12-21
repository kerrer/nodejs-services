module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
        all: [
          'Gruntfile.js',
          'src/**/*.js'
        ]
    },
    clean: {
    	target:["target"],
    },
    test: {
            all: ['target/test/**/*_test.js']
    },
    jsdoc : {
        dist : {
            src: ['src/main/*.js', 'src/test/*.js'],
            options: {
                destination : 'target/out/doc',
                template : "node_modules/ink-docstrap/template",
                configure : "node_modules/grunt-build/jsdoc.conf.json"
            }
        }
    }
  });
 
  require('load-grunt-tasks')(grunt); 
};
