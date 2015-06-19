# Backup and Update Tool
Node.Js module for back-upping, restoring and updating files with Yandex.Disk.

## Installation
Installed [7-zip](http://www.7-zip.org/) required on non-Windows systems.
Then install from NPM repository:
```sh
$ npm install esf-but
```

## Usage
1. Configure BUT with ```butfile.json```.
	- Configure [7-zip](http://www.7-zip.org/) archiver:
		- modify ```zipExecutable``` parameter to set custom path to [7-zip](http://www.7-zip.org/) executable;
		- on Windows live default to use bundled ```vendor/7z/7za.exe```;
		- remove ```zipExecutable``` parameter to use default [node-7z](https://github.com/quentinrossetti/node-7z) setting: 7za has to be at PATH or at the same directory with package.json.
	- Set paths to be back-upped, restored, updated to use according functionality and a temporary path.
	- Set Yandex.Disk [access token](https://tech.yandex.ru/oauth/) to use backup functionality.
2. Use API:

| Command 				| Description |
|--- 							|--- 					|
| ```download``` 	| Downloads files from locations, specified in ```butfile.json``` at ```update.paths```. |
| ```backup``` 		| Backups files to Yandex.Disk, using settings, specified in ```butfile.json``` at ```backup```. |
| ```restore``` 	| Restores backup files. |
| ```sendFilesToYaDisk``` | Sends files to Yandex.Disk from temporary directory, specified in ```butfile.json``` at ```update.paths```, but without pre-archiving them. |

## Road Map
|Version  |Status|Functionality |
|---      |---  |---           |
|0.1      |released  |Update tool   |
|0.2      |released  |Backup tool with Yandex.Disk backup. Zip, no encryption|
|0.3      |released  |Encrypted zip |
|0.4      |     |HTTPS with certificate|
|0.5      |     |Encrypted password local storage |
|1.0      |     |Auto installation and update. Documentation. SA |

## License
MIT © Denis Bondarenko 2015
