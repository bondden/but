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
	z7        = require('node-7z-esf'),

	clc       = require('cli-color'),

	settings  = false,
	date      = '0000-00-00-00-00-00',
	encrypt   = false,

	/**
	 * Converts local paths in settings to absolute according butfile.json schema v.0.3.0
	 */
	absolutizePaths=function(){

		var aP=function(p){
			if(!path.isAbsolute(p)){
				p=path.resolve(__dirname+'/../../'+p).replace(/\\/ig,'/');
			}
			return p;
		};

		settings.update.paths.forEach(function(p,i){
			settings.update.paths[i].toInstall=aP(p.toInstall);
		});

		settings.backup.pathsToBackup.forEach(function(p,i){
			settings.backup.pathsToBackup[i]=aP(p);
		});

		settings.backup.tmpDir=aP(settings.backup.tmpDir);
		settings.restore.pathSrc=aP(settings.restore.pathSrc);
		settings.restore.pathDst=aP(settings.restore.pathDst);

		if(settings.hasOwnProperty('zipExecutable')){
			settings.zipExecutable=aP(settings.zipExecutable);
		}

	},

	setZipExecutable=function(){
		if(settings.hasOwnProperty('zipExecutable')){
			global.gNode7zEsf=settings.zipExecutable;
		}
	},

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

				absolutizePaths();

				setZipExecutable();

				rs(settings);

			});

		});

	},

	logFilter = function(s){
		var
			censorNote='FILTERED',
			censoredKeys=[
				'pass',
				'password',
				'userPass',
				'userPassword',
				'token'
			]
		;

		for(var i=0,l=censoredKeys.length;i<l;i++){
			s=(s+'').replace(
				new RegExp('"'+censoredKeys[i]+'"\s*:\s*"([^"]+)"',"ig"),
				'"'+censoredKeys[i]+'":"'+censorNote+'"'
			);
		}

		return s;
	},

	log       = function(s){

		if(!settings.log)return;

		var
			styles={
				'ne':clc.white,
				'er':clc.red,
				'ok':clc.green,
				'em':clc.yellow,
				'mb':clc.magentaBright,
				'sh':clc.whiteBright
			},
			style='ne',
			apx  =false
		;

		//set console style style
		if(s instanceof Error){
			style='er';
			apx='\n'+s.stack;
		}

		//set log format
		if(typeof s === 'object'){
			s=JSON.stringify(s);
			if(apx){
				s+=apx;
			}
		}

		s=logFilter(s);

		var d=new Date();

		fs.appendFile(
			'butlog.log',
			d.toUTCString()+'\t'+s+'\n',
			function(err){
				if(err) throw err;
			}
		);

		console.log(styles[style]('but.log: '+s));

	},

	rej =function(message,error,rejectHandler){
		log(message);
		log(error);
		rejectHandler(error);
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
						rej('Error dldFile.1',e,rj);
					});
				});

			}catch(e){
				rej('Error dldFile.2',e,rj);
			}

		});

	},

	download  = function(){

		log('\n\nStarting Downloader\n');

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
					rej('Downloader error:\n',e,rj);
				});

			}).catch(function(e){
				rej('Settings loading error:\n',e,rj);
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

		log('\n\nSending files to Yandex.Disk\n');

		return new Promise(function(rs,rj){

			loadSettings().then(function(r){

				log('initializing Yandex.Disk');

				try{
					var YandexDisk=require('yandex-disk').YandexDisk;
					var disk      =new YandexDisk(settings.backup.token);

					var d        =settings.backup.tmpDir.substring(0,settings.backup.tmpDir.length-1);
					var remoteDir=settings.backup.remoteRoot+date;
				}catch(e){
					rej('Error sendFilesToYaDisk.1:',e,rj);
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
									rej('Error sendFilesToYaDisk.actions.1:',e,rj);
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
								rej('Error sendFilesToYaDisk.actions.2:',e1,rj1);
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
								rej('Error sendFilesToYaDisk.actions.3:',e,rj1);
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
										rej('Error sendFilesToYaDisk.actions.4:',e,rj1);
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
									rej('Error sendFilesToYaDisk.actions.5:',e,rj1);
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
							rej('Error sendFilesToYaDisk.3:',e,rj);
						});

					}).catch(function(e){
						rej('Error sendFilesToYaDisk.4:',e,rj);
					});

				}).catch(function(e){
					rej('Error sendFilesToYaDisk.5:',e,rj);
				});

			}).catch(function(e){
				rej('Error sendFilesToYaDisk.6:',e,rj);
			});

		});

	},

	archivePath =function(p){

		return new Promise(function(rs,rj){

			fs.exists(p,function(exists){
				if(!exists){
					rej('path: '+p+' doesn`t exist',new Error('path: '+p+' doesn`t exist'),rj);
				}else{

					try{

						var z = new z7();

						z.add(
							settings.backup.tmpDir.replace(/\/+$/,'')+'/'+encodeURIComponent(p)+'.zip',
							p,
							{
								p:    settings.backup.crypt.pass,
								ssw:  true
								//m:    'he'
							}
						)/*.process(function(fls){

							console.log('zip process:');
							console.log(fls);

						})*/.then(function(){

							log('zipped: '+p);
							rs('zipped: '+p);

						}).catch(function(er){
							rej('Error zip.1:',er,rj);
						});

					}catch(zErr){
						rej('Error zip.2:',zErr,rj);
					}

				}
			});

		});

	},

	backup  = function(){

		log('\n\nStarting backup\n');

		return new Promise(function(rs,rj){

			loadSettings().then(function(r){

				log('Backup started with settings:\n'+JSON.stringify(settings.backup));

				//1. prepare dirs
				fse.emptyDirSync(settings.backup.tmpDir);

				var queue=[];

				settings.backup.pathsToBackup.forEach(function(p){

					//2. pack
					archivePath(p).then(function(r1){
						//3. send
						queue.push(sendFilesToYaDisk());

					}).catch(function(e1){

						log('Error backup.3:');
						log(e1);
						queue.push(new Promise(function(rse,rje){
							rje(e1);
						}));

					});

				});

				Promise.all(queue).then(function(rq){
					rs('ok');
				}).catch(function(eq){
					rj(new Error('Error archiving and saving files to Yandex.Disk'));
				});

			}).catch(function(e){
				rej('Error backup.1:',e,rj);
			});

		});

	},

	restore = function(){

		log('\n\nStarting restore\n');

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
						rej('Error restore.1:',err,rj);
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
								rej('Error restore.2:',er,rj);
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
