'use strict;'
var EXPORTED_SYMBOLS = ['openRegistryKey'];

var openRegistryKey = {
	_consoleService:null,
	_regEditPath: null,
	_arrHives:new Array ('HKEY_CURRENT_CONFIG', 'HKEY_LOCAL_MACHINE', 'HKEY_CLASSES_ROOT', 'HKEY_CURRENT_USER', 'HKEY_USERS'),

	LOG: function(msg){	
		//this._consoleService.logStringMessage(msg); 
	},
  
	init: function() {
		var Cc = Components.classes, Ci = Components.interfaces;
		//this._consoleService = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);

		var env = Cc['@mozilla.org/process/environment;1'].getService(Ci.nsIEnvironment);
		var winDir = env.get('windir');

		if (winDir.charAt(winDir.length-1) != '\\') {
			winDir += '\\';
		}

		this._regEditPath = winDir +  'regedit.exe'

		var file = this.getFileObjectForPath(this._regEditPath);

		if (file.exists()) {
			return;
		}

		this._regEditPath = winDir +  'system32\\regedt32.exe';
	},

	bind: function(window) {
		window.setTimeout(function() { openRegistryKey.handleLoad(window); }, 500);
	}, 

	unbind: function(window) {
		var document = window.document;
	    var cm = document.getElementById('contentAreaContextMenu');
	    var mItem = document.getElementById('context-openregistrykey');
	    mItem.removeEventListener('click', openRegistryKey.handleMenuItemClick);
	    cm.removeChild(mItem);
		cm.removeEventListener('popupshowing', openRegistryKey.handleContextMenuShowing);
	}, 

	handleLoad: function(window){
		var document = window.document;

	    var cm = document.getElementById('contentAreaContextMenu');
	    var mItem = document.createElement('menuitem');
	    mItem.setAttribute('id','context-openregistrykey');
	    mItem.setAttribute('class','menuitem-iconic');
	    mItem.setAttribute('image','resource://open-registry-key/__versiondir__/skin/pic16.png');
	    mItem.setAttribute('label','Open in RegEdit');
	    mItem.addEventListener('click', openRegistryKey.handleMenuItemClick, false);

	    cm.appendChild(mItem);

		cm.addEventListener('popupshowing', openRegistryKey.handleContextMenuShowing, false);
	},

	handleContextMenuShowing: function(evt) {
		var document = evt.target.ownerDocument;
		document.getElementById('context-openregistrykey').hidden = !openRegistryKey._getSelectedText(document);
	},

	_getSelectedText: function(doc) {
		return openRegistryKey._getActiveWindow().content.getSelection().toString();
	},

	_normalizeString: function(theText)	{
		var arrHivesAbbr = new Array ('HKCC',                'HKLM',               'HKCR',              'HKCU',              'HKU');

		// remove whitespaces
		theText = theText.replace(/(\r|\n|\t)/g, '');

		// fix a common mistake :-)
		theText = theText.replace(/Current Version/g, 'CurrentVersion');
		
		// remove unneeded spaces
		var arrSplit = theText.split('\\');
		for (var i = 0; i < arrSplit.length; i++) {
			arrSplit[i] = arrSplit[i].replace(/^\s*/, '').replace(/\s*$/, '');
		}
		theText = arrSplit.join('\\');

		// replace abbreviations
		for (var i = 0; i < this._arrHives.length; i++) {
			var r = new RegExp('^' + arrHivesAbbr[i], 'i');
			theText = theText.replace(r, this._arrHives[i]);
		}
		
		// trim trailing ]
		if (theText.charAt(theText.length - 1) == ']') {
			theText = theText.substring(0, theText.length - 1);
		}

		return theText;
	},
 
  	_getHiveCode: function(theText) {
		// trim garbage before key start and find hive
		var hiveCode = -1;
		for (var i = 0; i < this._arrHives.length; i++) {
			var x = theText.indexOf(this._arrHives[i]);
			if (x >= 0)
			{
				theText = theText.substring(x, theText.length);
				hiveCode = i;
				break;
			}
		}

		return hiveCode;
  	},
  
	handleMenuItemClick: function(evt) {
		var document = evt.target.ownerDocument;
		var selected = openRegistryKey._getSelectedText(document);
		if (!selected) return;


		selected = openRegistryKey._normalizeString(selected);
		var hiveCode = openRegistryKey._getHiveCode(selected);

		while(hiveCode == -1) {
			selected = openRegistryKey._getActiveWindow().prompt('Please enter a valid Registry Key', selected);

			if (!selected) return;

			selected = openRegistryKey._normalizeString(selected);
			hiveCode = openRegistryKey._getHiveCode(selected);
		}

		openRegistryKey.openKey(openRegistryKey._getValidKey(hiveCode, selected));
	},
  
  	openKey: function(str) {
  		// remove the last character if it is a '\'
		if (str.charAt(str.length - 1) == '\\')	{
			str = str.substring(0, str.length - 1);
		}

  		//this.LOG('will open: ' + str);
		var cc = Components.classes, ci = Components.interfaces;

		var wrk = cc['@mozilla.org/windows-registry-key;1'].createInstance(ci.nsIWindowsRegKey);
		wrk.create(wrk.ROOT_KEY_CURRENT_USER, 'Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\Regedit', wrk.ACCESS_WRITE);
		wrk.writeStringValue('LastKey', str);
		wrk.close();	

		// create an nsILocalFile for the executable
		var file = this.getFileObjectForPath(this._regEditPath);

		// create an nsIProcess and run
		var process = cc['@mozilla.org/process/util;1'].createInstance(ci.nsIProcess);
		process.init(file);
		var args = [];
		process.run(false, args, args.length);	
  	},
  
	_getActiveWindow: function() {
		var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
		return wm.getMostRecentWindow('navigator:browser');
	},
  
	_getValidKey: function(hiveCode, theText) {

		var iLastBSlash, strKey, strValue, strVerifiedKey = '';
			
		// No Subkey
		var firstSep = theText.indexOf('\\');
		if (firstSep == -1) return theText;

		// find hive
		var strHive = this._arrHives[hiveCode];
		var strWithoutHive = theText.substr(firstSep+1);

		if (strWithoutHive.length == 0)
			return strHive;

		var arrKeysAndValues = strWithoutHive.split('\\');

		var wrk = Components.classes['@mozilla.org/windows-registry-key;1'].createInstance(Components.interfaces.nsIWindowsRegKey);

		var apiCodes = [0x80000005, wrk.ROOT_KEY_LOCAL_MACHINE, wrk.ROOT_KEY_CLASSES_ROOT, wrk.ROOT_KEY_CURRENT_USER, 0x80000003];
		var rootKey = apiCodes[hiveCode];

		wrk.open(rootKey,  arrKeysAndValues[0], wrk.ACCESS_READ);

		for (i = 1; i < arrKeysAndValues.length; i++) {
			var nextKey = strVerifiedKey +  (i>1 ? '\\' : '') + arrKeysAndValues[i]

			if (wrk.hasChild(nextKey))
				strVerifiedKey = nextKey;
			else
				break;
		}

		wrk.close();
		return strHive + '\\' + arrKeysAndValues[0] + '\\' + strVerifiedKey;
	},

	getFileObjectForPath: function(path) {
		var file = Components.classes['@mozilla.org/file/local;1'].getService(Components.interfaces.nsILocalFile);
		file.initWithPath(path);
		return file;
	}

};