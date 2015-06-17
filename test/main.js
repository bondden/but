/* *
 * Author: Denis Bondarenko <bond.den@gmail.com>
 * Created: 26.03.2015 20:26
 */
'use strict';

var
	expect    =require('chai').expect,
	fs        =require('fs'),
	fse       =require('fs-extra'),
	path      =require('path'),
	but  	    =require('../index.js'),

	butfile   =path.resolve(__dirname+'/../butfile.json')
;

describe('BUT Test Suite',function(){

	it('butfile.json should exist',function(done){
		fs.exists(butfile,function(exists){
			expect(exists).to.be.true;
			done();
		});
	});

	it('Paths in butfile.json should exist',function(done){

		var
			paths     =[],
			addToPaths=function(p){
				paths.push(p);
			}
		;

		//1. read butfile
		fs.readFile(butfile,'utf8',function(e,r){
			if(e)done(e);

			//2. gather paths
			try{

				var cnf=JSON.parse(r);

				cnf.update.paths.forEach(function(p){
					addToPaths(path.dirname(p.toInstall));
				});
				cnf.backup.pathsToBackup.forEach(function(p){
					addToPaths(p);
				});
				addToPaths(cnf.backup.tmpDir);
				addToPaths(cnf.restore.pathSrc);
				addToPaths(cnf.restore.pathDst);

				//3. check paths
				var checkers=[];
				paths.forEach(function(p){
					checkers.push(new Promise(function(rs,rj){
						//console.log(p+'\n');
						fs.exists(p,function(exists){
							if(!exists){
								rj(new Error('No such path exists: '+p));
							}else{
								rs(true);
							}
						});
					}));
				});

				Promise.all(checkers).then(function(rs){

					var result=true;
					rs.forEach(function(v){
						if(!v){
							result=false;
							done(new Error('One or more paths does not exist'));
						}
					});

					expect(result).to.be.true;
					done();

				}).catch(function(er){
					done(er);
				});

			}catch(e){
				done(e);
			}

		});

	});

	it('It should have write access to file system',function(done){

		var
			tmpDir    =path.resolve(__dirname+'/d/.tmp/'),
			tmpFile='tst.tmp'
		;

		fs.writeFile(tmpDir+'/'+tmpFile,'test',function(e){

			var r=false;

			if(e){
				done(e);
			}else{
				r=true;
			}

			expect(r).to.be.true;
			done();

		});

	});

	it('It should have access to Yandex.Disk',function(){



	});

	it('It should download a test file',function(){
		throw new Error('Empty test');
	});

	it('It should backup a test file',function(){
		throw new Error('Empty test');
	});

	it('It should restore a test file',function(){
		throw new Error('Empty test');
	});

});
