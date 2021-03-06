/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var args = require('get-gulp-args')();
var fs = require('fs');
var path = require('path');

/**
 * Main entry point for all Orange Pi Node configuration.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Orange Pi Node Specific options
 */
function initTasks(gulp, options) {
  var runSequence = require('run-sequence').use(gulp);
  var all = require('./all.js')(options);
  var config = all.getConfig();

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'OrangePi', ((options && options.appName) ? options.appName : 'unknown'));
  }

  gulp.task('init', 'Initializes sample', function (cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate);
    }

    cb();
  })

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function (cb) {
    var ifNodeExist = "hash node 2>/dev/null";
    var ifNodeCompatibleWith4Exists = "(node -v | grep -Eq 'v([0-9]{2,}|[4-9])\.')";
    var installNode4x = "((curl -sL http://deb.nodesource.com/setup_4.x "
      + "--output ~/setup_4.x --write-out %{http_code} | grep 200) "
      + "&& sudo -E bash ~/setup_4.x && sudo apt-get -y install nodejs)";
    all.sshExecCmd("(" + ifNodeExist + "&&" + ifNodeCompatibleWith4Exists + ") || " + installNode4x, { verbose: args.verbose }, cb);
  });

  gulp.task('deploy', 'Deploys sample code to the board', function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var files = fs.readdirSync('./app');
    var filesLocal = [];
    var filesRemote = [];

    for (var i = 0; i < files.length; i++) {
      filesLocal.push('./app/' + files[i]);
      filesRemote.push(targetFolder + '/' + files[i]);
    }

    // optionally copy X.509 certificate(s) and associated private key(s) to the device
    var toolsFolder = all.getToolsFolder();
    files = fs.readdirSync(toolsFolder);
    for (i = 0; i < files.length; i++) {
      if (path.extname(files[i]) === '.pem') {
        filesLocal.push(path.join(toolsFolder, files[i]));
        filesRemote.push(targetFolder + '/' + files[i]);
      }
    }

    all.uploadFilesViaScp(filesLocal, filesRemote, function () {
      console.log("- Installing NPM packages on the device. It might take several minutes.");
      all.sshExecCmd('cd ' + targetFolder + ' && file=(*.pem) && if [ -e "$file" ]; then chmod 600 *.pem; fi && npm install',
        { verbose: args.verbose }, cb);
    });
  });

  gulp.task('run-internal', false, function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var startFile = config.start_file ? config.start_file : 'app.js';
    var nodeCommand = 'nodejs';

    if (args.debug) {
      nodeCommand += ' --debug-brk=5858';
    }

    var nodejsParam = '';
    if (config.iot_device_connection_string) {
      nodejsParam = ' "' + config.iot_device_connection_string + '"';
    }

    all.sshExecCmd('sudo' + ' ' + nodeCommand + ' ' + targetFolder + '/' + startFile + nodejsParam + ' && exit', { verbose: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('default', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
