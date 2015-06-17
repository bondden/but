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

		if(settings!==false)return;
		var settingsRaw=fs.readFileSync('butfile.json', 'utf8');
		settings=JSON.parse(settingsRaw);

		date=getDateFormatted();

		if(encrypt!==false)return;
		encrypt=crypt.createCipher(settings.backup.crypt.alg, settings.backup.crypt.pass);
	},

	log       = function(s){

		if(!settings.log)return;

		var d=new Date();

		if(typeof s === 'object'){
			s=JSON.stringify(s);
		}

		fs.appendFile(
			'butlog.log',
			d.toUTCString()+'\t'+s+'\n',
			function(err){
				if(err) throw err;
			}
		);

		console.log('log: '+s);

	},

	dldFile   = function(pathData,pathNum,updaterSettings){

		var options={
			host: url.parse(pathData.fromUrl).host,
			port: 80,
			path: url.parse(pathData.fromUrl).pathname,
			auth: updaterSettings.basicAuth.user+':'+updaterSettings.basicAuth.pass
		};

		var file = fs.createWriteStream(pathData.toInstall);

		http.get(options, function(r){
			r.on('data', function(data){
				file.write(data);
			}).on('end', function(){
				file.end();
				log('downloaded '+pathData.fromUrl+' to '+pathData.toInstall);
			});
		});

	},

	download  = function(){

		loadSettings();

		log('Downloader started with settings:\n'+JSON.stringify(settings.update));

		settings.update.paths.forEach(function(p,i){
			dldFile(p,i,settings.update);
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

		loadSettings();

		var YandexDisk = require('yandex-disk').YandexDisk;
		var disk = new YandexDisk(settings.backup.token);

		var d=settings.backup.tmpDir.substring(0,settings.backup.tmpDir.length-1);
		var remoteDir=settings.backup.remoteRoot+date;

		log('creating remote directory '+remoteDir);

		disk.mkdir(remoteDir,function(e){
			if(!e){
				log('ok');
			}else{
				log(e.stack);
			}
		});

		try{
			var files = fs.readdirSync(d);
		}catch(e1){
			log(e1);
			return;
		}
		files.forEach(function(file,i){
			var filePath=settings.backup.tmpDir+file;
			if(fs.statSync(filePath).isFile()){

				disk.uploadFile(filePath,remoteDir+'/'+file,function(e,r){
					if(!e){
						log('uploaded file '+file);
					}else{
						log(e);
					}
				});

			}
		});

		log('cleaning');
		disk.readdir(settings.backup.remoteRoot,function(e,r){
			if(!e){
				if(typeof r === 'object' && Array.isArray(r)){
					if(r.length>settings.backup.maxRemoteVersions){

						var m=[];
						r.forEach(function(v,i){
							m.push(v.displayName);
						});
						m.sort();

						var surplus=m.length-settings.backup.maxRemoteVersions;
						var ex=m.slice(0,surplus);

						log(ex);
						ex.forEach(function(td,j){
							disk.remove(settings.backup.remoteRoot+td,function(e2,r2){
								if(!e2){
									log('removed obsolete remote '+td);
								}else{
									log(e2);
								}
							});
						});

					}
				}
			}else{
				log(e);
			}
		});
		//fse.emptyDirSync(settings.backup.tmpDir);

	},

	backup  = function(){

		loadSettings();

		log('Backup started with settings:\n'+JSON.stringify(settings.backup));

		//1. prepare dirs		
		fse.emptyDirSync(settings.backup.tmpDir);

		//2. pack
		var c=0;
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
			)
			.then(function(){
				log('zipped: '+path);
				//3. send, when all've been saved
				sendFilesToYaDisk();
			})
			.catch(function(er){
				log(er);
			});

		});

	},

	restore = function(){

		loadSettings();

		try{
			var files = fs.readdirSync(settings.restore.pathSrc);
		}catch(e1){
			log(e1);
			return;
		}
		files.forEach(function(file,i){
			var filePath=settings.restore.pathSrc+'/'+file;
			if(fs.statSync(filePath).isFile()){

				var z = new z7();
				z.extractFull(
					filePath,
					settings.restore.pathDst,
					{
						p:    settings.backup.crypt.pass
					}
				)
				.then(function(){
					log('unpacked: '+path);
				})
				.catch(function(er){
					log(er);
				});

			}
		})

	}

;

module.exports={
	download:download,
	backup:backup,
	sendFilesToYaDisk:sendFilesToYaDisk,
	restore:restore
};
