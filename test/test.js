"use strict";

var fs = require('fs-promise');
var txtToSql = require('../lib/txt-to-sql.js');
var expect = require('expect.js');
var selfExplain = require('self-explain');
var differences = selfExplain.assert.allDifferences;
var changing = require('best-globals').changing;
var yaml = require('js-yaml');
var common = require('./test-common');

function loadYaml(fileName) {
    var res = {};
    return common.setIfFileExists(fileName, res, 'all').then(function() {
        if(!res.all) {
            throw new Error('"'+fileName+'" debe existir');
        }
        return yaml.safeLoad(res.all);
    });
}

describe("fixtures", function(){
    [
        {name:'example-one'},
        {name:'pk-simple', changeExpected:function(exp) { exp.opts.separator = '\t'; }},
        {name:'pk-complex', changeExpected:function(exp) { exp.opts.separator = '|'; }},
        {name:'pk-complex-all', changeExpected:function(exp) { exp.opts.separator = '|';}},
        {name:'pk-very-simple', changeExpected:function(exp) { exp.opts.separator = ',';}},
        {name:'pk-very-simple2', changeExpected:function(exp) { exp.opts.separator = ',';}},
        {name:'pk-simple-nn', changeExpected:function(exp) { exp.opts.separator = '\t'; }},
        {name:'pk-complex-nn'},
        {name:'pk-complex-nn2'},
        {name:'pk-space-simple', changeExpected:function(exp) { exp.opts.separator = /\s+/; } },
        {name:'pk-enabled'},
        {name:'pk-disabled'},
        {name:'without-pk-2'},
        {name:'fields-unmod'},
        {name:'fields-lcnames'},
        {name:'fields-lcalpha'},
        {name:'separator', changeExpected:function(exp) { exp.opts.separator = '/'; }},
        {name:'comma-align'},
        {name:'comma-align-nulls'},
        {name:'comma-align-one-column'},
        {name:'comma-align-with-max'},
        {name:'adapt'},
        {name:'column-names'},
        {name:'columns-with-spaces'},
        {name:'mysql-example-one'},
        {name:'mysql-pk-complex-all'},
        {name:'mysql-adapt'},
        {name:'sqlite-example-one'},
        {name:'sqlite-pk-complex-all'},
        {name:'sqlite-adapt'},
        {name:'mssql-example-one'},
        {name:'oracle-example-one'},
        {name:'with-drop-table'},
        {name:'mysql-with-drop-table'},
        {name:'sqlite-with-drop-table'},
        {name:'fields-ansi-lcalpha'}, // ansi
        {name:'mssql-comma-align'},
        {name:'mssql-with-drop-table'},
        {name:'oracle-with-drop-table'},
        {name:'pk-explicit'},
        {name:'pk-custom'},
        {name:'pk-custom-names'},
        {name:'with-null-lines'},
        {name:'csv-simple'},
        {name:'csv-harder'},
        {name:'insert-limit'},
        {name:'mssql-insert-limit'}, // compactInsertLimit should be ignored (#24)
        {name:'insert-limit2'},
    ].forEach(function(fixture){
        if(fixture.skip) {
            it.skip("fixture: "+fixture.name);
        } else {
            it("fixture: "+fixture.name, function(done){
                var defaultOpts = {inputEncoding:'UTF8', outputEncoding:'UTF8'};
                var param={tableName:fixture.name};
                var expected={};
                var basePath='./test/fixtures/'+fixture.name;
                var prepared;
                common.setIfFileExists(basePath+'.in-opts.yaml', param, 'opts').then(function() {
                    if(param.opts) {
                        param.opts = changing(defaultOpts, yaml.safeLoad(param.opts));
                    } else {
                        param.opts = defaultOpts;
                    }
                    return common.setIfFileExists(basePath+'.txt', param, 'rawTable', {});
                }).then(function() {
                    return common.loadDefaultExpectedResult();
                }).then(function() {
                    return common.loadYamlIfFileExists(basePath+'.result.yaml');
                }).then(function(yml) {
                    expected = changing(JSON.parse(JSON.stringify(common.defaultExpectedResult)), yml);
                    if(param.opts.outputEncoding !== null && param.opts.outputEncoding !== 'UTF8') {
                        console.log("OE", param.opts.outputEncoding)
                        throw new Error('Unhandled output test! Re-think next common.setIfFileExists() line!!');
                    }
                    return common.setIfFileExists(basePath+'.sql', expected, 'rawSql', {});
                }).then(function() {
                    if(fixture.changeExpected) { fixture.changeExpected(expected); }
                }).then(function() {
                    return txtToSql.prepare(param);
                }).then(function(preparedResult){
                    prepared = preparedResult;
                    return txtToSql.generateScripts(param);
                }).then(function(generated){
                    expect(prepared.opts).to.eql(expected.opts);
                    if(expected.columns) {
                        //console.log("PC", prepared.columns);
                        //console.log("EC", expected.columns);
                        expect(prepared.columns).to.eql(expected.columns);
                    }
                    // generated
                    expect(generated.errors).to.eql(expected.errors);
                    var comp = txtToSql.compareBuffers(generated.rawSql, expected.rawSql);
                    if(comp !==-1) {
                        console.log("GEN", generated.rawSql.toString());
                        console.log("EXP", expected.rawSql.toString());
                        console.log("diff in ", comp, "\n"+expected.rawSql.toString().substring(comp))
                    }
                    expect(generated.rawSql).to.eql(expected.rawSql);
                    expect(differences(generated.rawSql,expected.rawSql)).to.eql(null);
                    // coherencia entre prepared y generated
                    expect(generated.errors).to.eql(prepared.errors);
                    if(expected.stats) {
                        var stats = changing({},generated.stats);
                        delete stats.startTime;
                        delete stats.endTime;
                        expect(stats).to.eql(expected.stats);
                        expect(generated.stats.startTime).to.be.a('number');
                        expect(generated.stats.endTime).to.be.a('number');
                        //expect(generated.stats.endTime).to.be.greaterThan(generated.stats.startTime);
                    }
               }).then(done,done);
            });   
        }
    });
});

describe("specials", function(){
    it("manage mixed line ends", function(done){
        var rawTable=new Buffer(
            "text-field;int-field;num-field;big;double\n"+
            "hello;1;3.141592;1234567890;1.12e-101\r\n"+
            ";;;0;0.0", 'binary'
        );
        Promise.resolve().then(function(){
            return txtToSql.generateScripts({tableName:'example-one', rawTable:rawTable});
        }).then(function(generated){
            return fs.readFile('./test/fixtures/example-one.sql').then(function(rawSql){
                expect(generated.rawSql).to.eql(rawSql);
                expect(differences(generated.rawSql,rawSql)).to.eql(null);
                return;
            });
        }).then(done,done);
    });
});

describe("input errors", function(){
    var dummyBuffer = new Buffer('dummy', 'binary');
    [
        { name:'no-rawtable'},
        { name:'no-table-and-rawtable'},
        { name:'no-table-bad-column-format', change:function(param) { param.rawTable = dummyBuffer; }},
        { name:'unsupported engine', change:function(param) { param.rawTable = dummyBuffer; }},
        { name:'all-bad-params'},
        { name:'wrong-number-of-column-names'},
        { name:'duplicated-column-names'},
        { name:'unsupported-encodings', change:function(param) { param.rawTable = dummyBuffer; }},
        { name:'bad-rawtable', change:function(param) { param.rawTable = 'not a Buffer'; }},
        { name:'fields-lcalpha-dups'},
        { name:'fields-lcnames-dups'},
        { name:'fields-unmod-dups'},
        { name:'one-column-no-sep'},
        { name:'invalid-utf8'},
        { name:'invalid-ansi', skip:true},
        { name:'row-diff-num-columns'},
        { name:'missing-col-names'},
        { name:'include-pk-without-pk-columns'},
        { name:'req-columns-no-pk'},
        { name:'include-pk-columns-no-pk'},
    ].forEach(function(check){
        if(check.skip) {
            it.skip("error: "+check.name);
        } else {
            it("error: "+check.name, function(done){
                var basePath='./test/errors/'+check.name;
                var loaded={};
                var param={};
                var expected={};
                common.setIfFileExists(basePath+'.param.yaml', loaded, 'param').then(function() {
                    if(loaded.param) { param = yaml.safeLoad(loaded.param); }
                    if(! param.opts) { param.opts={}; }
                    return common.setIfFileExists(basePath+'.txt', param, 'rawTable', {});
                }).then(function() {
                    if(check.change) { check.change(param); }
                    return loadYaml(basePath+'.result.yaml');
                }).then(function(yaml) {
                    expected = yaml;
                }).then(function() {
                    //console.log(check.name, "param", param);
                    return txtToSql.prepare(param);
                }).then(function(prepared){
                    //console.log("prepared", prepared); console.log("expected", expected);
                    //console.log(check.name, "prep", prepared.errors, "expe", expected.errors)
                    expect(prepared.errors).to.eql(expected.errors);
                    expect(prepared.warnings).to.eql(expected.warnings);
                }).then(done,done);
            });
        }
    });
});

describe("file encoding", function(){
    [
        { name:'ascii7', file:'ascii7.txt', type:'ASCII7' },
        { name:'utf8', file:'utf8.txt', type:'UTF8'},
        { name:'utf8-bom', file:'utf8-bom.txt', type:'UTF8' },
        { name:'ansi', file:'ansi.txt', type:'ANSI' }
    ].forEach(function(check){
        if(check.skip) {
            it.skip(check.name);
        } else {
            it(check.name, function(done){
                fs.readFile('./test/encoding/'+check.file).then(function(buffer){
                    return txtToSql.getEncoding(buffer);
                }).then(function(encoding) {
                    expect(encoding).to.eql(check.type);
                }).then(done,done);
            });
        }
    });
});

describe("stringizeStats", function(){
    [
        {stats:{rows:3,columns:3,textColumns:1, nullColumns:2, primaryKey:[], startTime:0, endTime:1000},
           out:'rows:3, columns:3 (text:1, null:2), time:1s' },
        {stats:{rows:0,columns:1,textColumns:0, nullColumns:1, primaryKey:[], startTime:1000, endTime:8010},
           out:'rows:0, columns:1 (text:0, null:1), time:7s, 10ms' },
        {stats:{rows:20,columns:12,textColumns:7, nullColumns:5, primaryKey:['c1','c2'], startTime:0, endTime:1000*60*60},
           out:'rows:20, columns:12 (text:7, null:5), primary key[c1,c2], time:1h'},
        {stats:{rows:2,columns:1,textColumns:0, nullColumns:1, primaryKey:['c1'], startTime:0, endTime:1000*60*60+60001},
           out:'rows:2, columns:1 (text:0, null:1), primary key[c1], time:1h, 1m, 1ms'},
        {stats:{rows:1,columns:2,textColumns:1, nullColumns:0, primaryKey:[], startTime:0, endTime:0},
           out:'rows:1, columns:2 (text:1, null:0), time:0ms' },
    ].forEach(function(check, index) {
        var name=(index+1)+': '+JSON.stringify(check.stats).substr(0,40)+'...';
        if(check.skip) {
            it.skip(name);
        } else {
            it(name, function(){
                expect(txtToSql.stringizeStats(check.stats)).to.eql(check.out);
            });
        }
    });
});

