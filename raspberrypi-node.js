'use strict';

var all = require('./all.js');
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var args = require('get-gulp-args')();
var fs = require('fs');

function initTasks(gulp) {
  var runSequence = require('run-sequence').use(gulp);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'RaspberryPi', 'blink');
  }

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function (cb) {
    all.azhSshExec('(curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -) && sudo apt-get -y install nodejs', config, args.verbose, cb);
  });

  gulp.task('deploy', 'Deploys sample code to the board', function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var files = fs.readdirSync('./app');
    var filesLocal = [];
    var filesRemote = [];
    console.log(files);

    for (var i = 0; i < files.length; i++) {
      filesLocal.push('./app/' + files[i]);
      filesRemote.push(targetFolder + '/' + files[i]);
    }

    all.uploadFilesViaScp(config, filesLocal, filesRemote, function () {
      // [REVIEW] failure is not handled properly
      all.azhSshExec('cd ' + targetFolder + ' && npm install', config, args.verbose, cb);
    });
  });

  gulp.task('run', 'Runs deployed sample on the board', function () {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var startFile = config.start_file ? config.start_file : 'blink.js';
    var nodeCommand = 'nodejs';
    if (args.debug) {
      nodeCommand += ' --debug-brk=5858';
    }

    all.azhSshExec('sudo' + ' ' + nodeCommand + ' ' + targetFolder + '/' + startFile + ' && exit', cb);
  });

  gulp.task('default', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
