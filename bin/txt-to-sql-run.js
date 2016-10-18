#!/usr/bin/env node

"use strict";

var program = require('commander');
var fast = require('./fast.js');
var txtToSql = require('../lib/txt-to-sql.js');
var Promises = require('best-promise');
var fs = require('fs-promise');
var changing = require('best-globals').changing;
var fs = require('fs-promise');
var jsYaml = require('js-yaml');
var Path = require('path');
var miniTools = require('mini-tools');

program
    .version(require('../package').version)
    .usage('[options] input.txt')
    .option('-i, --input', 'Name of the input file')
    .option('-p, --prepare', 'Analyzes input and generates input.yaml')
    .option('-f, --fast', 'Uses streams to process input')
    .option('-e, --export-defaults', 'Exports defaults to txt-to-sql-defaults.yaml')
    .parse(process.argv);


if( ((""==program.args && !program.input) && !program.exportDefaults) ){
    program.help();
}

var cmdParams = {};
cmdParams.input = program.input ? program.input : program.args[0];
cmdParams.prepare = program.prepare;
cmdParams.fast = program.fast;
cmdParams.exportDefaults = program.exportDefaults;

// numero de lineas a leer para analizar entrada
var fastBufferingThreshold = 50;

function writeConfigYaml(params, inputYaml) {
    var create = false;
    return fs.exists(inputYaml).then(function(exists) {
        create = ! exists;
        if(create) {
            var createdParams = Object.assign({}, params);
            if(! createdParams.opts.columns) { delete createdParams.opts.columns; }
            delete createdParams.rawTable;
            return fs.writeFile(inputYaml, jsYaml.safeDump(createdParams), {encoding:'utf8'});
        }
    }).then(function() {
        if(create) {
            process.stdout.write("Generated '"+inputYaml+"' with deduced options\n");
        } else {
            process.stdout.write("Not overwriding existing '"+inputYaml+"'\n");
        }
    });
}

function getOutputDir(inFile) {
    return Promises.start(function() {
        if(!inFile) { throw new Error("null file"); }
        return fs.exists(inFile);
    }).then(function(exists) {
        if(! exists) { throw new Error("'"+inFile+"' does not exists"); }
        return inFile;
    }).then(function(inFile) {
        return Path.dirname(Path.resolve(inFile));
    }).catch(function(err) {
        return Promise.reject(err);
    });
};

function collectExistentFiles(files) {
    var existentFiles = [];
    return Promises.all(files.map(function(file) {
        return fs.exists(file).then(function(exists) {
            if(exists) { existentFiles.push(file); }
        });
    })).then(function() {
        return existentFiles;
    });
};

function createParams(params, preparedParams) {
    var res = {
       tableName:params.tableName,
       rawTable:params.rawTable,
       opts: changing(params.opts, preparedParams.opts),
    };
    res.opts.columns = params.columns || preparedParams.columns;
    return res;
}

function doPrepare(params, inputYaml) {
    var res;
    return txtToSql.prepare(params).then(function(result) {
        if(result.errors) { throw new Error(result.errors); }
        if(result.warnings) {
            process.stdout.write("There are warnings: \n  "+result.warnings.join('\n  ')+"\n");
        }
        res = createParams(params, result);
        return writeConfigYaml(res, inputYaml);
    }).then(function() {
        return res;
    });
}

function doGenerate(params, inputYaml, inputName) {
    var outSQL = inputName+'.sql';
    return doPrepare(params, inputYaml).then(function(preparedParams) {
        return txtToSql.generateScripts(preparedParams);
    }).then(function(result) {
        if(result.errors) { throw new Error(result.errors); }
        return fs.writeFile(outSQL, result.rawSql);
    }).then(function() {
        process.stdout.write("Generated '"+outSQL+"'")
    });
}

var workingDir = Path.resolve('.');
var defYamlName = 'txt-to-sql-defaults.yaml';
var globalBaseDir = Path.dirname(Path.parse(__filename).dir);
var defYaml = Path.resolve(globalBaseDir, 'lib', defYamlName);
var inputName = Path.basename(cmdParams.input, '.txt');
var params = {};

Promises.start(function() {
    if(cmdParams.exportDefaults) {
        var outputDefYaml = Path.resolve(workingDir, defYamlName);
        return fs.copy(defYaml, outputDefYaml).then(function() {
            process.stdout.write("Written '"+outputDefYaml+"'\n");
        });
    } else {
        var inputBase;
        var inputYaml;
        return getOutputDir(cmdParams.input).then(function(outputDir) {
            inputBase = Path.resolve(outputDir, inputName);
            inputYaml = inputBase+'.yaml';
            var configFiles = [
                defYaml,
                Path.resolve(workingDir, defYamlName),
                inputYaml
            ];
            return collectExistentFiles(configFiles);
        }).then(function(existentFiles) {
            return miniTools.readConfig(existentFiles);
        }).then(function(data) {
            params.opts = data.opts;
            if(! params.tableName) {
                params.tableName = inputName;
            }
            return fs.readFile(cmdParams.input);
        }).then(function(rawInput) {
            params.rawTable = rawInput;
            if(cmdParams.fast) {
                return fast.doFast(params, inputBase, fastBufferingThreshold).then(function(preparedResult) {
                    return writeConfigYaml(createParams(params, preparedResult), inputBase+'.yaml');
                }).then(function() {
                    process.stdout.write("Generated '"+inputBase+".sql'")
                });
            } else if (cmdParams.prepare) {
                return doPrepare(params, inputYaml);
            } else {
                return doGenerate(params, inputYaml, inputBase);
            }
        });
   }
}).catch(function(err) {
    process.stderr.write("ERROR: "+err.message+"\n"+err.stack);
    program.help();
});
