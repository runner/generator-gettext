/**
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 * @license GNU GENERAL PUBLIC LICENSE Version 3
 */

'use strict';

const
    fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    serial = require('cjs-async/serial'),
    name   = 'gettext',
    log    = require('runner-logger').wrap(name),
    tools  = require('runner-tools');


function standardChannelsHandle ( stdout, stderr ) {
    (stdout + stderr).trim().split('\n').forEach(function ( line ) {
        if ( line.length !== 0 ) {
            log.info(line);
        }
    });
}


function po2js ( poFile, jsonFile, compact, callback ) {
    const
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

    if ( po.headers['Plural-Forms'] ) {
        result.meta.plural = po.headers['Plural-Forms'].split('plural=').pop().replace(';', '');
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

    if ( compact ) {
        tools.write([{name: jsonFile, data: JSON.stringify(result)}], log, callback);
    } else {
        tools.write([{name: jsonFile, data: JSON.stringify(result, null, '    ')}], log, callback);
    }
}


function msginit ( config, potFile, poFile, language, callback ) {
    let command = [
        'msginit',
        '--input="'  + potFile  + '"',
        '--output="' + poFile   + '"',
        '--locale="' + language + '"',
        '--no-translator'
    ];

    // optional flags
    config.noWrap && command.push('--no-wrap');

    // final exec line
    command = command.join(' ');

    if ( config.verbose ) {
        log.info('exec', command);
    }

    exec(command, function ( error, stdout, stderr ) {
        if ( error ) {
            log.fail(error.toString());
        }

        standardChannelsHandle(stdout, stderr);

        /* eslint-disable-next-line handle-callback-err */
        tools.read(poFile, log, function ( error, data ) {
            data.toString().replace(
                'Content-Type: text/plain; charset=ASCII',
                'Content-Type: text/plain; charset=UTF-8'
            );

            tools.write([{name: poFile, data: data}], log, callback);
        });
    });
}


function msgmerge ( config, potFile, poFile, callback ) {
    let command = [
        'msgmerge',
        '--update',
        '--quiet',
        '--verbose',
        '--backup="off"'
    ];

    // optional flags
    config.indent     && command.push('--indent');
    config.noLocation && command.push('--no-location');
    config.noWrap     && command.push('--no-wrap');
    config.sortOutput && command.push('--sort-output');
    config.sortByFile && command.push('--sort-by-file');

    // merge
    command.push(poFile);
    command.push(potFile);

    // final exec line
    command = command.join(' ');

    if ( config.verbose ) {
        log.info('exec', command);
    }

    exec(command, function ( error, stdout, stderr ) {
        if ( error ) {
            log.fail(error.toString());
        }

        standardChannelsHandle(stdout, stderr);

        callback();
    });
}


function xgettext ( config, callback ) {
    const
        dstFile = path.join(config.source, 'messages.pot'),
        pkgPath = path.join(process.cwd(), 'package.json');

    let pkgInfo, command;

    function scanPath ( fsPath ) {
        if ( fs.statSync(fsPath).isDirectory() ) {
            fs.readdirSync(fsPath).forEach(function ( item ) {
                scanPath(path.join(fsPath, item));
            });
        } else {
            command.push(fsPath);
        }
    }

    delete require.cache[pkgPath];
    pkgInfo = require(pkgPath);

    command = [
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
    config.indent      && command.push('--indent');
    config.noLocation  && command.push('--no-location');
    config.addLocation && command.push('--add-location=' + config.addLocation);
    config.noWrap      && command.push('--no-wrap');
    config.sortOutput  && command.push('--sort-output');
    config.sortByFile  && command.push('--sort-by-file');
    config.addComments && command.push('--add-comments="' + config.addComments + '"');

    // add input files to the params
    config.jsData.forEach(scanPath);

    // final exec line
    command = command.join(' ');

    if ( config.verbose ) {
        log.info('exec', command);
    }

    exec(command, function ( error, stdout, stderr ) {
        if ( error ) {
            callback(error);

            return;
        }

        standardChannelsHandle(stdout, stderr);

        callback(error, dstFile);
    });
}


function execPo ( config, done ) {
    if (
        Array.isArray(config.languages) && config.languages.length &&
        Array.isArray(config.jsData) && config.jsData.length
    ) {
        xgettext(config, function ( error, potFile ) {
            if ( error ) {
                log.fail(error.toString());
                done();

                return;
            }

            serial(config.languages.map(function ( language ) {
                const poFile = path.join(config.source, language + '.po');

                return function ( result ) {
                    fs.exists(poFile, function ( exists ) {
                        if ( exists ) {
                            // merge existing pot and po files
                            msgmerge(config, potFile, poFile, function () {
                                result(null);
                            });
                        } else {
                            // create a new lang file
                            msginit(config, potFile, poFile, language, function () {
                                result(null);
                            });
                        }
                    });
                };
            }), done);
        });
    } else {
        log.info('no valid config options (check generator configuration)');
        done();
    }
}


function json ( config, done ) {
    serial(config.languages.map(function ( language ) {
        const
            poFile   = path.join(config.source, language + '.po'),
            jsonFile = path.join(config.target, language + '.json');

        return function ( result ) {
            fs.exists(poFile, function ( exists ) {
                if ( exists ) {
                    po2js(poFile, jsonFile, config.compact, function () {
                        result(null);
                    });
                } else {
                    log.warn('doesn\'t exists: %s', log.colors.bold(poFile));
                    result(true);
                }
            });
        };
    }), function ( error ) {
        done(error);
    });
}


function build ( config, done ) {
    execPo(config, function () {
        json(config, done);
    });
}


function clear ( config, done ) {
    const files = [];

    config.languages.forEach(function ( language ) {
        files.push(path.join(config.target, language + '.json'));
    });

    tools.unlink(files, log, done);
}


function generator ( config = {}, options = {} ) {
    const
        tasks = {},
        {prefix = name + ':', suffix = ''} = options;

    // sanitize and extend defaults
    config = Object.assign({
        // dir with po and pot files
        source: '.',

        // directory with generated localization json files
        target: '.',

        // javascript source files
        jsData: [],

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
        verbose: false,

        // generated json file mode
        compact: false
    }, config);

    tasks[prefix + 'config' + suffix] = function () {
        log.inspect(config, log);
    };

    tasks[prefix + 'build' + suffix] = function ( done ) {
        build(config, done);
    };

    tasks[prefix + 'exec' + suffix] = function ( done ) {
        execPo(config, done);
    };

    tasks[prefix + 'json' + suffix] = function ( done ) {
        json(config, done);
    };

    tasks[prefix + 'clear' + suffix] = function ( done ) {
        clear(config, done);
    };

    return tasks;
}


// export main actions
generator.methods = {
    build: build
};


// public
module.exports = generator;
