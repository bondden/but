# Backup and Update Tool
Node.Js module for backuping, restoring and updating files with Yandex.Disk.

## Installation
```sh
$ npm install but
```

## Usage
1. Configure BUT with ```butfile.json```.
2. Use API:

| Command 				| Description |
|--- 							|--- 					|
| ```download``` 	| Downloads files from locations, specified in ```butfile.json``` at ```update.paths```. |
| ```backup``` 		| Backups files to Yandex.Disk, using settings, specified in ```butfile.json``` at ```backup```. |
| ```restore``` 	| Restores backup files. |
| ```sendFilesToYaDisk``` | Sends files to Yandex.Disk from temporary direcory, specified in ```butfile.json``` at ```update.paths```, but without pre-archiving them. |

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
