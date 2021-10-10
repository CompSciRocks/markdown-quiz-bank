'use strict'
module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';',
            }, dist: {
                src: ['src/*.js'],
                dest: 'dist/mdq.js',
            },
        },
        sass: {
            dist: {
                options: {
                    style: 'compressed',
                    sourcemap: 'none',
                }, files: {
                    'dist/mdq.css': 'src/mdq.scss',
                }
            }
        },
        insert: {
            options: {},
            main: {
                src: "dist/mdq.css",
                dest: "dist/mdq.js",
                match: /%%CSS%%/
            },
        },
        notify: {
            default: {
                options: {
                    title: '<%= pkg.name %>',
                    message: 'JS and CSS compiled and saved to dist folder',
                }
            }
        },
        uglify: {
            dist: {
                options: {
                    banner: '/*\t<%= pkg.name %> - <%= pkg.version %>\n *\n *\t(c) <%= grunt.template.today("yyyy") %> Aelora Web Services, LLC\n *\thttps://compsci.rocks\n */\n',
                },
                files: {
                    'dist/mdq.min.js': 'dist/mdq.js',
                }
            }
        },
        watch: {
            scripts: {
                files: ['src/*'],
                tasks: ['concat', 'sass', 'insert', 'uglify', 'notify'],
                options: {
                    spawn: false
                }
            }
        }

    });
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-insert');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-notify');

    grunt.registerTask('default', ['dist', 'watch']);
    grunt.registerTask('dist', ['concat', 'sass', 'insert', 'uglify']);
}