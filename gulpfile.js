
// This file simply runs make install.

var gulp = require('gulp');
var shell = require('gulp-shell');

gulp.task('default', shell.task([
  'make install'
]));
