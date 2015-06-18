/* *
 * Author: Denis Bondarenko <bond.den@gmail.com>
 * Created: 01.04.2015 15:17
 */

'use strict';

var

	fs        = require('fs'),
	path      = require('path'),
	http      = require('http'),
	https     = require('https'),
	url       = require('url'),
	tar       = require('tar-fs'),
	//zlib      = require('zlib'),
	crypt     = require('crypto'),

	fse       = require('fs-extra'),
	z7        = require('node-7z'),

	settings  = false,
	date      = '0000-00-00-00-00-00',
	encrypt   = false,

	loadSettings=function(){

		return new Promise(function(rs,rj){

			if(settings!==false){
				rs(settings);
			}

			fs.readFile('butfile.json', {'encoding':'utf8'},function(e,settingsRaw){

				if(e){
					log('Error loadSettings.1');
					rj(e);
				}

				settings=JSON.parse(settingsRaw);
				date=getDateFormatted();
				if(encrypt!==false)return;
				encrypt=crypt.createCipher(settings.backup.crypt.alg, settings.backup.crypt.pass);

				rs(settings);

			});

		});

	},

	logFilter = function(s){
		var censorNote='FILTERED';
		s=s.replace(/"pass"\s*:\s*"(.+)"/ig,'"pass":"'+censorNote+'"');
		return s.replace(/"token"\s*:\s*"(.+)"/ig,'"token":"'+censorNote+'"');
	},

	log       = function(s){

		if(!settings.log)return;

		var d=new Date();

		if(typeof s === 'object'){
			s=JSON.stringify(s);
		}

		s=logFilter(s);

		fs.appendFile(
			'butlog.log',
			d.toUTCString()+'\t'+s+'\n',
			function(err){
				if(err) throw err;
			}
		);

		console.log('but.log: '+s);

	},

	dldFile   = function(pathData,pathNum,updaterSettings){

		return new Promise(function(rs,rj){

			var options={
				host: url.parse(pathData.fromUrl).host,
				port: 80,
				path: url.parse(pathData.fromUrl).pathname,
				auth: updaterSettings.basicAuth.user+':'+updaterSettings.basicAuth.pass
			};

			try{

				var file = fs.createWriteStream(pathData.toInstall);

				http.get(options, function(r){
					r.on('data', function(data){
						file.write(data);
					}).on('end', function(){

						file.end();
						log('downloaded '+pathData.fromUrl+' to '+pathData.toInstall);
						rs(true);

					}).on('error',function(e){
						log('Error dldFile.1');
						rj(e);
					});
				});

			}catch(e){
				log('Error dldFile.2');
				rj(e);
			}

		});

	},

	download  = function(){

		log('\n\nStarting Downloader');

		return new Promise(function(rs,rj){

			loadSettings().then(function(r){
				log('Downloader started with settings:\n'+JSON.stringify(settings.update));

				var waiters=[];
				settings.update.paths.forEach(function(p,i){
					waiters.push(dldFile(p,i,settings.update));
				});

				Promise.all(waiters).then(function(r){
					log('Downloader ready with result:\n'+JSON.stringify(r));
					rs(r);
				}).catch(function(e){
					log('Downloader error:\n'+JSON.stringify(e));
					rj(e);
				});

			}).catch(function(e){
				log('Settings loading error:\n'+JSON.stringify(e));
				rj(e);
			});

		});

	},

	getDateFormatted  =function(){
		var d=new Date();
		var a=[d.getFullYear(),d.getMonth()+1,d.getDate()+1,d.getHours(),d.getMinutes(),d.getSeconds()];
		var b=a.map(function(v){
			return v<10?'0'+v:v;
		});
		return b.join('')
	},

	sendFilesToYaDisk =function(){

		log('\n\nSending files to Yandex.Disk');

		return new Promise(function(rs,rj){

			loadSettings().then(function(r){

				log('initializing Yandex.Disk ');

				try{
					var YandexDisk=require('yandex-disk').YandexDisk;
					var disk      =new YandexDisk(settings.backup.token);

					var d        =settings.backup.tmpDir.substring(0,settings.backup.tmpDir.length-1);
					var remoteDir=settings.backup.remoteRoot+date;
				}catch(e){
					log('Error sendFilesToYaDisk.1:');
					log(e);
					rj(e);
				}

				var actions={

					createRemoteDir:function(disk){
						return new Promise(function(rs1,rj1){

							log('creating remote directory '+remoteDir);

							disk.mkdir(remoteDir,function(e){
								if(!e){
									log('ok');
									rs1('ok');
								}else{
									log('Error sendFilesToYaDisk.actions.1:');
									log(e.stack);
									rj1(e);
								}
							});

						});
					},

					uploadFiles:function(disk){
						return new Promise(function(rs1,rj1){

							log('uploading');

							try{
								var files=fs.readdirSync(d);
							}catch(e1){
								log('Error sendFilesToYaDisk.actions.2:');
								log(e1);
								rj1(e1);
								throw e1;
							}

							log('files to upload:\n'+files.join('\n'));

							var waiter=[];
							files.forEach(function(file){
								waiter.push(actions.uploadAFile(disk,file));
							});

							Promise.all(waiter).then(function(r){
								rs1(r);
							}).catch(function(e){
								rj1(e);
							});

						});
					},

					uploadAFile:function(disk,file){
						return new Promise(function(rs1,rj1){

							var filePath=settings.backup.tmpDir+file;
							if(fs.statSync(filePath).isFile()){

								disk.uploadFile(filePath,remoteDir+'/'+file,function(e,r){
									if(!e){
										log('uploaded file '+file);
										rs1(file);
									}else{
										log('Error sendFilesToYaDisk.actions.3:');
										log(e);
										rj1(e);
									}
								});

							}

						});
					},

					clean:function(disk){
						return new Promise(function(rs1,rj1){

							log('cleaning');

							disk.readdir(settings.backup.remoteRoot,function(e,r){
								if(!e){

									if(typeof r==='object' && Array.isArray(r)){
										if(r.length>settings.backup.maxRemoteVersions){

											var m=[];
											r.forEach(function(v){
												m.push(v.displayName);
											});
											m.sort();

											var surplus=m.length-settings.backup.maxRemoteVersions;
											var ex     =m.slice(0,surplus);

											var exL =ex.length;
											var exC =0;
											var exOC=0;

											log(ex);
											ex.forEach(function(td){

												disk.remove(settings.backup.remoteRoot+td,function(e2,r2){

													if(!e2){

														log('removed obsolete remote '+td);
														exC++;

													}else{
														log(e2);
													}

													exOC++;
													if(exOC===exL){
														if(exC===exL){
															rs1('ok');
														}else{
															rj1(new Error('Error cleaning remote directory. See but.log for details.'));
														}
													}

												});

											});

										}
									}

								}else{
									log('Error sendFilesToYaDisk.actions.4:');
									log(e);
									rj1(e);
								}
							});
							//fse.emptyDirSync(settings.backup.tmpDir);

						});
					}

				};

				actions.createRemoteDir(disk).then(function(r){

					actions.uploadFiles(disk).then(function(r1){

						actions.clean(disk).then(function(r2){

							log('remote directory has been cleaned successfully');
							rs(r2);

						}).catch(function(e){
							log('Error sendFilesToYaDisk.2:');
							log(e);
							rj(e);
						});

					}).catch(function(e){
						log('Error sendFilesToYaDisk.3:');
						log(e);
						rj(e);
					});

				}).catch(function(e){
					log('Error sendFilesToYaDisk.4:');
					log(e);
					rj(e);
				});

			}).catch(function(e){
				log('Error sendFilesToYaDisk.5:');
				log(e);
				rj(e);
			});

		});

	},

	backup  = function(){

		log('\n\nStarting backup');

		return new Promise(function(rs,rj){

			loadSettings().then(function(r){

				log('Backup started with settings:\n'+JSON.stringify(settings.backup));

				//1. prepare dirs
				fse.emptyDirSync(settings.backup.tmpDir);

				//2. pack
				var c=0;
				var cOk=0;
				var l=settings.backup.pathsToBackup.length;

				settings.backup.pathsToBackup.forEach(function(path,i){

					var z = new z7();
					z.add(
						settings.backup.tmpDir+encodeURIComponent(path)+'.zip',
						path,
						{
							p:    settings.backup.crypt.pass,
							ssw:  true
							//m:    'he'
						}
					).then(function(){
						log('zipped: '+path);
						//3. send, when all've been saved

						sendFilesToYaDisk().then(function(r){
							cOk++;
						}).catch(function(e){
							log('Error backup.2:');
							log(e);
						});

					}).catch(function(er){
						log('Error backup.3:');
						log('Error archiving files:');
						log(er);
					});

					c++;
					if(c===l){
						if(cOk==l){
							rs('ok');
						}else{
							rj(new Error('Error archiving and saving files to Yandex.Disk'));
						}
					}

				});

			}).catch(function(e){
				log('Error backup.1:');
				log(e);
				rj(e);
			});
		});

	},

	restore = function(){

		log('\n\nStarting restore');

		return new Promise(function(rs,rj){

			loadSettings().then(function(r){

				log('Restore started with settings: '+JSON.stringify(settings.restore));

				try{
					var files = fs.readdirSync(settings.restore.pathSrc);
				}catch(e1){
					log(e1);
					return;
				}

				fs.readdir(settings.restore.pathSrc,function(err, files){

					if(err){
						log('Error restore.1:');
						log(err);
						rj(err);
						return;
					}

					files.forEach(function(file){
						var filePath=settings.restore.pathSrc+'/'+file;
						if(fs.statSync(filePath).isFile()){

							var z = new z7();
							z.extractFull(
								filePath,
								settings.restore.pathDst,
								{
									p:    settings.backup.crypt.pass
								}
							).then(function(r){
								log('unpacked: '+path);
								rs(path);
							}).catch(function(er){
								log('Error restore.1:');
								log(er);
								rj(er);
							});

						}
					});

				});

			});

		});

	}

;

module.exports={
	download:download,
	backup:backup,
	sendFilesToYaDisk:sendFilesToYaDisk,
	restore:restore
};
