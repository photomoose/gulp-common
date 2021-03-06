/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var args = require('get-gulp-args')();
var fs = require('fs');
var path = require('path');

var all;

function initTasks(gulp, options) {
  all = require('./all.js')(options);

  var config = all.getConfig();
  var targetFolder = config.project_folder ? config.project_folder : '.';
  var startFile = config.start_file ? config.start_file : 'app';

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'c', 'Edison', ((options && options.appName) ? options.appName : 'unknown'));
  }

  var runSequence = require('run-sequence').use(gulp);

  gulp.task('init', 'Initializes sample', function (cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate);
    }

    cb();
  });

  gulp.task('clone-iot-sdk', false, function (cb) {
    all.sshExecCmds(["if [ ! -d ~/azure-iot-sdk-c ]; " +
      "then git clone https://github.com/Azure/azure-iot-sdk-c.git && cd ~/azure-iot-sdk-c && git checkout 76906dc; fi",
      'cd ~/azure-iot-sdk-c/uamqp && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-uamqp-c.git . && git checkout 5bf09d3; fi',
      'cd ~/azure-iot-sdk-c/umqtt && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-umqtt-c.git . && git checkout 51da812; fi',
      'cd ~/azure-iot-sdk-c/parson && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/kgabis/parson.git . && git checkout c22be79; fi',
      'cd ~/azure-iot-sdk-c/c-utility && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-c-shared-utility.git . && git checkout 9073d21; fi',
      'cd ~/azure-iot-sdk-c/uamqp/c-utility && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-c-shared-utility.git . && git checkout b0b5b1b; fi',
      'cd ~/azure-iot-sdk-c/umqtt/c-utility && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-c-shared-utility.git . && git checkout b0b5b1b; fi'],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('change-make-parallelism-to-2', false, function (cb) {
    all.sshExecCmds(["sed -i 's/--jobs=$CORES/--jobs=2/g' ~/azure-iot-sdk-c/build_all/linux/build.sh"],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('build-iot-sdk', false, function (cb) {
    all.sshExecCmds(["test -e ~/azure-iot-sdk-c/cmake/iotsdk_linux/iothub_client/libiothub_client_mqtt_transport.a || " +
      "(cd ~/azure-iot-sdk-c && sudo build_all/linux/build.sh --skip-unittests --no-amqp --no-http --no_uploadtoblob)"],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('install-tools', 'Installs required software on the device', function (cb) {
    runSequence('clone-iot-sdk', 'change-make-parallelism-to-2', 'build-iot-sdk', cb);
  });

  gulp.task('clean', 'Remove installed SDK and deployed sample code from device', function (cb) {
    all.sshExecCmds(["rm -rf ~/azure-iot-sdk-c",
      "rm -rf " + targetFolder],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('deploy', 'Deploy and build sample code on the device', function (cb) {
    let src = [];
    let dst = [];

    if (options.app) {
      for (let i = 0; i < options.app.length; i++) {
        let f = options.app[i];
        src.push('./app/' + f);
        dst.push(targetFolder + '/' + f);
      }
    }

    // optionally copy X.509 certificate(s) and associated private key(s) to the device
    if (config.iot_device_connection_string &&
      config.iot_device_connection_string.toLowerCase().indexOf('x509=true') != -1) {
      var toolsFolder = all.getToolsFolder();
      var certName = all.getDeviceId() + '-cert.pem';
      var certPath = path.join(toolsFolder, certName);
      var keyName = all.getDeviceId() + '-key.pem';
      var keyPath = path.join(toolsFolder, keyName);

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        src.push(certPath);
        dst.push(targetFolder + '/' + certName);

        src.push(keyPath);
        dst.push(targetFolder + '/' + keyName);
      }
    }

    all.uploadFilesViaScp(src, dst, function (err) {
      if (err) {
        cb(err);
      } else {
        all.sshExecCmds(['cd ' + targetFolder + ' && file=(*.pem) && if [ -e "$file" ]; then chmod 600 *.pem; fi',
          'cd ' + targetFolder + ' && cmake .',
          'cd ' + targetFolder + ' && make'],
          {
            verbose: args.verbose,
            sshPrintCommands: true,
            validate: true
          }, cb);
      }
    });
  });

  gulp.task('run-internal', false, function (cb) {
    var param = options.appParams || '';

    all.sshExecCmd('sudo chmod +x ' + './' + startFile + ' ; sudo ' + './' + startFile + ' ' + param,
      { verbose: true, sshPrintCommands: true, baseDir: targetFolder }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('default', 'Deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  });
}

module.exports = initTasks;
