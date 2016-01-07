module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
        all: [
          './**/*.js'
        ]
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
         
          quiet: false, // Optionally suppress output to standard out (defaults to false)
          clearRequireCache: false // Optionally clear the require cache before running tests (defaults to false)
        },
        src: ['test/**/*Test.js']
      }
    }
  });
 
  grunt.loadNpmTasks('grunt-mocha-test');
   grunt.registerTask('default', 'mochaTest');
};
