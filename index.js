/**
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 * @license GNU GENERAL PUBLIC LICENSE Version 3
 */

'use strict';

var fs    = require('fs'),
    path  = require('path'),
    exec  = require('child_process').exec,
    name  = 'gettext',
    log   = require('@runner/logger').wrap(name),
    tools = require('@runner/tools');


function po2js ( config, poFile, jsonFile ) {
    var jsonDir  = config.target,
        po       = require('gettext-parser').po.parse(fs.readFileSync(poFile, {encoding: 'utf8'})),
        contexts = po.translations,
        result   = {
            meta: {
                charset:  po.charset,
                project:  po.headers['project-id-version'],
                language: po.headers.language,
                plural:   ''
            },
            data: {}
        };

    if ( po.headers['plural-forms'] ) {
        result.meta.plural = po.headers['plural-forms'].split('plural=').pop().replace(';', '');
    }

    // fill items
    Object.keys(contexts).sort().forEach(function ( contextName ) {
        result.data[contextName] = result.data[contextName] || {};

        Object.keys(contexts[contextName]).sort().forEach(function ( msgId ) {
            if ( msgId ) {
                if ( contexts[contextName][msgId].msgid_plural ) {
                    result.data[contextName][msgId] = contexts[contextName][msgId].msgstr;
                } else {
                    result.data[contextName][msgId] = contexts[contextName][msgId].msgstr[0];
                }
            }
        });

    });

    if ( !fs.existsSync(jsonDir) ) {
        fs.mkdirSync(jsonDir);
    }

    // store js file
    fs.writeFileSync(jsonFile, JSON.stringify(result, null, '\t'), {encoding: 'utf8'});

    return result;
}


function msginit ( config, langName, potFile, poFile, callback ) {
    var title  = 'msginit ',
        params = [
            'msginit',
            '--input="'  + potFile  + '"',
            '--output="' + poFile   + '"',
            '--locale="' + langName + '"',
            '--no-translator'
        ],
        command;

    // optional flags
    if ( config.noWrap ) { params.push('--no-wrap'); }

    // final exec line
    command = params.join(' ');

    exec(command, function ( error, stdout, stderr ) {
        if ( error ) {
            // profile.notify({
            //     info: error.toString().trim(),
            //     type: 'fail',
            //     tags: [self.entry, title],
            //     data: {command: command}
            // });
        } else {
            (stdout + stderr).trim().split('\n').forEach(function ( line ) {
                console.log(title, line);
            });

            // Content-Type: text/plain; charset=UTF-8
            fs.writeFileSync(poFile,
                fs.readFileSync(poFile, {encoding: 'utf8'}).replace(
                    'Content-Type: text/plain; charset=ASCII',
                    'Content-Type: text/plain; charset=UTF-8'
                )
            );
        }

        callback(error);
    });
}


function msgmerge ( config, langName, potFile, poFile, callback ) {
    var title    = 'msgmerge',
        msgmerge = [
            'msgmerge',
            '--update',
            '--verbose'
        ],
        command;

    // optional flags
    if ( config.indent     ) { msgmerge.push('--indent'); }
    if ( config.noLocation ) { msgmerge.push('--no-location'); }
    if ( config.noWrap     ) { msgmerge.push('--no-wrap'); }
    if ( config.sortOutput ) { msgmerge.push('--sort-output'); }
    if ( config.sortByFile ) { msgmerge.push('--sort-by-file'); }

    // merge
    msgmerge.push(poFile);
    msgmerge.push(potFile);

    // final exec line
    command = msgmerge.join(' ');

    if ( config.verbose ) {
        console.log(title, command);
    }

    exec(command, function ( error, stdout, stderr ) {
        /* eslint no-unused-vars: 0 */

        if ( error ) {
            // profile.notify({
            //     info: error.toString().trim(),
            //     type: 'fail',
            //     tags: [self.entry, title],
            //     data: {command: command}
            // });
        } else {
            // profile.notify({
            //     info: stderr.trim().split('\n')[1],
            //     tags: [self.entry, title, langName],
            //     data: {command: command}
            // });
        }

        callback(error);
    });
}


function xgettext ( config, callback ) {
    var dstFile = path.join(config.source, 'messages.pot'),
        title   = 'xgettext',
        pkgInfo, params, command;

    delete require.cache[path.join(process.cwd(), 'package.json')];
    pkgInfo = require(path.join(process.cwd(), 'package.json'));

    params = [
        'xgettext',
        '--force-po',
        '--output="' + dstFile + '"',
        '--language="JavaScript"',
        '--from-code="' + config.fromCode + '"',
        '--package-name="' + pkgInfo.name + '"',
        '--package-version="' + pkgInfo.version + '"',
        '--msgid-bugs-address="' + (pkgInfo.author.email ? pkgInfo.author.email : pkgInfo.author) + '"'
    ];

    // optional flags
    if ( config.indent      ) { params.push('--indent'); }
    if ( config.noLocation  ) { params.push('--no-location'); }
    if ( config.addLocation ) { params.push('--add-location=' + config.addLocation); }
    if ( config.noWrap      ) { params.push('--no-wrap'); }
    if ( config.sortOutput  ) { params.push('--sort-output'); }
    if ( config.sortByFile  ) { params.push('--sort-by-file'); }
    if ( config.addComments ) { params.push('--add-comments="' + config.addComments + '"'); }

    // input file
    params.push(config.jsData);

    // final exec line
    command = params.join(' ');

    console.log(command);

    exec(command, function ( error, stdout, stderr ) {
        if ( error ) {
            // profile.notify({
            //     info: error.toString().trim(),
            //     type: 'fail',
            //     tags: [self.entry, title],
            //     data: {command: command}
            // });
            //console.log(error);
            log.fail(error.toString().trim());

            callback(error);

            return;
        }

        if ( stdout ) {
            stdout.trim().split('\n').forEach(function ( line ) {
                console.log(title, line);
            });
        }

        if ( stderr ) {
            stderr.trim().split('\n').forEach(function ( line ) {
                console.log(title, line);
            });
        }

        // profile.notify({
        //     info: 'write ' + dstFile,
        //     tags: [self.entry, title],
        //     data: {command: command}
        // });

        callback(error, dstFile);
    });
}


function build ( config, done ) {
    xgettext(config, function ( error, potFile ) {
        var runCount = 0,
            fnDone   = function ( poFile, jsonFile ) {
                runCount++;

                po2js(config, poFile, jsonFile);

                if ( runCount >= config.languages.length ) {
                    done();
                }
            };

        if ( error ) {
            done();

            return;
        }

        config.languages.forEach(function ( langName ) {
            var poFile   = path.join(config.source, langName + '.po'),
                jsonFile = path.join(config.target, langName + '.json');

            if ( fs.existsSync(poFile) ) {
                // merge existing pot and po files
                msgmerge(config, langName, potFile, poFile, function () {
                    fnDone(poFile, jsonFile);
                });
            } else {
                // create a new lang file
                msginit(config, langName, potFile, poFile, function () {
                    fnDone(poFile, jsonFile);
                });
            }
        });
    });
}


function clear ( config, done ) {
    var files = [];

    config.languages.forEach(function ( language ) {
        files.push(path.resolve(config.target, language + '.json'));
    });

    tools.unlink(files, log, done);
}


function generator ( config, options ) {
    var tasks = {};

    // sanitize and extend defaults
    config = Object.assign({
        // dir with po and pot files
        source: undefined,

        // directory with generated localization json files
        target: undefined,

        // javascript source file
        jsData: undefined,

        // list of language codes in ISO 639-1 format to generate localization files for
        languages: [],

        // Specifies the encoding of the input files.
        // This option is needed only if some untranslated message strings or their corresponding comments
        // contain non-ASCII characters.
        // @flag --from-code=name
        fromCode: 'UTF-8',

        // Place comment blocks starting with tag and preceding keyword lines in the output file.
        // Without a tag, the option means to put all comment blocks preceding keyword lines in the output file.
        // Note that comment blocks supposed to be extracted must be adjacent to keyword lines.
        // @flag --add-comments[=tag]
        addComments: 'gettext',

        // Write the .po file using indented style.
        // @flag --indent
        indent: false,

        // Write "#: filename:line" lines.
        // @flag --no-location
        noLocation: true,

        // @flag --add-location
        addLocation: 'file',

        // Do not break long message lines.
        // Message lines whose width exceeds the output page width will not be split into several lines.
        // Only file reference lines which are wider than the output page width will be split.
        // @flag --no-wrap
        noWrap: true,

        // Generate sorted output.
        // Note that using this option makes it much harder for the translator to understand each message’s context.
        // @flag --sort-output
        sortOutput: true,

        // Sort output by file location.
        // @flag --sort-by-file
        sortByFile: false,

        // Increase verbosity level.
        // @flag --verbose
        verbose: false
    }, config || {});
    options = Object.assign(generator.options, options || {});

    tasks[options.prefix + 'config' + options.suffix] = function () {
        log.inspect(config, log);
    };

    tasks[options.prefix + 'build' + options.suffix] = function ( done ) {
        build(config, done);
    };

    tasks[options.prefix + 'clear' + options.suffix] = function ( done ) {
        clear(config, done);
    };

    return tasks;
}


// defaults
generator.options = {
    prefix: name + ':',
    suffix: ''
};


// export main actions
generator.methods = {
    build: build
};


// public
module.exports = generator;
