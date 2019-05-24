Tasks generator for gettext
===========================

[![build status](https://img.shields.io/travis/runner/generator-gettext.svg?style=flat-square)](https://travis-ci.org/runner/generator-gettext)
[![npm version](https://img.shields.io/npm/v/runner-generator-gettext.svg?style=flat-square)](https://www.npmjs.com/package/runner-generator-gettext)
[![dependencies status](https://img.shields.io/david/runner/generator-gettext.svg?style=flat-square)](https://david-dm.org/runner/generator-gettext)
[![devDependencies status](https://img.shields.io/david/dev/runner/generator-gettext.svg?style=flat-square)](https://david-dm.org/runner/generator-gettext?type=dev)
[![Gitter](https://img.shields.io/badge/gitter-join%20chat-blue.svg?style=flat-square)](https://gitter.im/DarkPark/runner)
[![RunKit](https://img.shields.io/badge/RunKit-try-yellow.svg?style=flat-square)](https://npm.runkit.com/runner-generator-gettext)


## Installation ##

```bash
npm install runner-generator-gettext
```


## Usage ##

Add to the scope:

```js
const generator = require('runner-generator-gettext');
```

Generate tasks according to the given config:

```js
const tasks = generator({
    languages: ['fr', 'de'],
    source: 'src/lang',
    target: 'build/develop/lang',
    jsData: ['build/develop/main.js']    
});
```

Add generated tasks to the `runner` instance:

```js
const runner = require('runner');

Object.assign(runner.tasks, tasks);
```

The following tasks will become available:

 Task name        | Description
------------------|-------------
 `gettext:config` | prints the current configuration used for generated tasks
 `gettext:exec`   | performs `.po` and `.pot` files generation 
 `gettext:json`   | performs `.json` files generation
 `gettext:build`  | executes `gettext:exec` and `gettext:json` tasks
 `gettext:clear`  | removes compiled file

Generator accepts two arguments: base configuration and additional options.


### Base configuration ###

It's an object with the following properties:

 Name        | Description
-------------|-------------
 source      | directory with `po` and `pot` files
 target      | directory with generated localization `json` files
 jsData      | javascript source file to scan
 languages   | list of language codes in ISO 639-1 format to generate localization files for
 fromCode    | specifies the encoding of the input files (flag `--from-code=name`)
 addComments | place comment blocks starting with tag and preceding keyword lines in the output file (flag `--add-comments[=tag]`)
 indent      | write `po` files using indented style (flag `--indent`)
 noLocation  | write "#: filename:line" lines (flag `--no-location`)
 addLocation | location type (flag `--add-location`)
 noWrap      | do not break long message lines (flag `--no-wrap`)
 sortOutput  | generate sorted output (flag `--sort-output`)
 sortByFile  | sort output by file location (flag `--sort-by-file`)
 verbose     | increase verbosity level (flag `--verbose`)


### Additional options ###

It's an object with the following properties:

 Name   | Description
--------|-------------
 prefix | an affix placed before a task name (default is `gettext:`)  
 suffix | a string added at the end of a task name (empty by default)
 
So it's possible to change generated tasks names: 

```js
Object.assign(runner.tasks,
    generator(config, {
        prefix: 'lang:',
        suffix: ':develop'
    })
);
```

It will add the following tasks:

* `lang:config:develop` 
* `lang:exec:develop`  
* `lang:json:develop`  
* `lang:build:develop`  
* `lang:clear:develop`  
 

## Contribution ##

If you have any problems or suggestions please open an [issue](https://github.com/runner/generator-gettext/issues)
according to the contribution [rules](.github/contributing.md).


## License ##

`runner-generator-gettext` is released under the [GPL-3.0 License](http://opensource.org/licenses/GPL-3.0).
