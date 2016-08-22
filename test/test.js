"use strict";

var fs = require('fs-promise');
var txtToSql = require('../lib/txt-to-sql.js');
var expect = require('expect.js');
var selfExplain = require('self-explain');
var differences = selfExplain.assert.allDifferences;
var changing = require('best-globals').changing;
var yaml = require('js-yaml');

function setIfFileExists(fileName, outObject, outProperty) {
    return fs.exists(fileName).then(function(exists) {
        if(exists) { return fs.readFile(fileName, {encoding:'utf8'}); }
        return { notExists: true };
    }).then(function(content) {
        if(! content.notExists) { outObject[outProperty] = content; }
    });
}

var defaultResult = {};

function loadDefaultResult() {
    if(defaultResult.opts) { return Promise.resolve(defaultResult); }
    //console.log("loading default result");
    return setIfFileExists('./test/fixtures/_default_.out-opts.yaml', defaultResult, 'opts').then(function() {
        defaultResult.opts = yaml.safeLoad(defaultResult.opts);
        return defaultResult;
    });
}

describe("fixtures", function(){
    [
        {path:'example-one'},
        {path:'pk-simple', changeResult:function(res) { res.opts.separator = '\t'; }},
        {path:'pk-complex', changeResult:function(res) { res.opts.separator = '|'; }},
        {path:'pk-complex-all', changeResult:function(res) { res.opts.separator = '|'; }},
        {path:'pk-very-simple', changeResult:function(res) { res.opts.separator = ','; }},
        {path:'without-pk-2'},
        {path:'pk-simple-nn', changeResult:function(res) { res.opts.separator = '\t'; }},
        {path:'pk-complex-nn'},
        {path:'pk-complex-nn2'},
        {path:'pk-very-simple2', changeResult:function(res) { res.opts.separator = ','; }},
        {path:'pk-space-simple', changeResult:function(res) { res.opts.separator = /\s+/; }},
        {path:'specials'},
        {path:'exceptions', changeResult:function(res) { res.opts.separator=false; }},
        {path:'fields-unmod'},
        {path:'fields-lcnames'},
        {path:'fields-lcalpha'},
        {path:'fields-unmod-dups'},
        {path:'fields-lcnames-dups'},
        {path:'fields-lcalpha-dups'},
        {path:'wrong-input', changeResult:function(res) { res.opts.separator=false; } },
        {path:'wrong-input2',
         changeParam:function(param) { delete param.tableName; },
         changeResult:function(res) { res.opts.separator=false; }
        },
        {path:'wrong-input3', changeResult:function(res) { res.opts.separator=false; }},
        {path:'separator1', changeResult:function(res) { res.opts.separator = '/'; }},
    ].forEach(function(fixture){
        if(fixture.skip) {
            it.skip("fixture: "+fixture.path);
        } else {
            it("fixture: "+fixture.path, function(done){
                var param={tableName:fixture.path};
                var result={};
                var basePath='./test/fixtures/'+fixture.path;
                var prepared;
                setIfFileExists(basePath+'.in-opts.yaml', param, 'opts').then(function() {
                    if(param.opts) { param.opts = yaml.safeLoad(param.opts); }
                    return setIfFileExists(basePath+'.txt', param, 'txt');
                }).then(function() {
                    // para poder cambiar despues de cargar
                    if(fixture.changeParam) { fixture.changeParam(param); }
                }).then(function() {
                    return setIfFileExists(basePath+'.sql', result, 'sqls');
                }).then(function() {
                    if(result.sqls) {
                        result.sqls = result.sqls.split(/(\r?\n){2}/g)
                                                 .filter(function(sql){ return !sql.match(/^(\r?\n)$/); });
                    }
                    return loadDefaultResult();
                }).then(function() {
                    return setIfFileExists(basePath+'.out-opts.yaml', result, 'opts');
                }).then(function() {
                    result.opts = changing(defaultResult['opts'], result.opts ? yaml.safeLoad(result.opts) : {});
                    //console.log("RO", result.opts)
                }).then(function() {
                    return setIfFileExists(basePath+'.errors.yaml', result, 'errors');
                }).then(function() {
                    if(result.errors) { result.errors = yaml.safeLoad(result.errors); }
                    // para poder cambiar despues de cargar
                    if(fixture.changeResult) { fixture.changeResult(result); }
                }).then(function() {
                    return txtToSql.prepare(param);
                }).then(function(preparedResult){
                    prepared = preparedResult;
                    return txtToSql.generateScripts(param);
                }).then(function(generated){
                    // console.log("P", param.opts); console.log("R", result.opts); console.log("P", prepared);
                    expect(prepared.opts).to.eql(result.opts);
                    expect(prepared.errors).to.eql(result.errors);
                    //console.log("G", generated);
                    expect(generated.sqls).to.eql(result.sqls);
                    expect(differences(generated.sqls,result.sqls)).to.eql(null);
                    expect(generated.errors).to.eql(result.errors);
               }).then(done,done);
            });   
        }
    });
});
