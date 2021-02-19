var openRegistryKey = {
 _regEditPath: null,
 _arrHives: new Array('HKEY_CURRENT_CONFIG', 'HKEY_LOCAL_MACHINE', 'HKEY_CLASSES_ROOT', 'HKEY_CURRENT_USER', 'HKEY_USERS'),
 init: function()
 {
  var env = Components.classes['@mozilla.org/process/environment;1'].getService(Components.interfaces.nsIEnvironment);
  var winDir = env.get('windir');
  if (winDir.charAt(winDir.length - 1) !== '\\')
   winDir += '\\';
  openRegistryKey._regEditPath = winDir + 'regedit.exe';
  var file = openRegistryKey.getFileObjectForPath(openRegistryKey._regEditPath);
  if (!file.exists())
   openRegistryKey._regEditPath = winDir + 'system32\\regedt32.exe';
  var cm = window.document.getElementById('contentAreaContextMenu');
  var mItem = window.document.createElement('menuitem');
  mItem.setAttribute('id','context-openregistrykey');
  mItem.setAttribute('class','menuitem-iconic');
  mItem.setAttribute('image','chrome://ork/skin/pic16.png');
  var gBundle = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
  var locale = gBundle.createBundle('chrome://ork/locale/openregistrykey.properties');
  mItem.setAttribute('label', locale.GetStringFromName('openregistrykey.contextmenu.label'));
  mItem.addEventListener('click', openRegistryKey.handleMenuItemClick, false);
  cm.appendChild(mItem);
  cm.addEventListener('popupshowing', openRegistryKey.handleContextMenuShowing, false);
 },
 handleContextMenuShowing: function(evt)
 {
  var doc = evt.target.ownerDocument;
  doc.getElementById('context-openregistrykey').hidden = !openRegistryKey._getSelectedText(doc);
 },
 _getSelectedText: function(doc)
 {
  return openRegistryKey._getActiveWindow().content.getSelection().toString();
 },
 _normalizeString: function(theText)
 {
  var arrHivesAbbr = new Array ('HKCC', 'HKLM', 'HKCR', 'HKCU', 'HKU');
  theText = theText.replace(/(\r|\n|\t)/g, '');
  theText = theText.replace(/Current Version/g, 'CurrentVersion');
  var arrSplit = theText.split('\\');
  var i;
  for (i = 0; i < arrSplit.length; i++)
  {
   arrSplit[i] = arrSplit[i].replace(/^\s*/, '').replace(/\s*$/, '');
  }
  theText = arrSplit.join('\\');
  for (i = 0; i < openRegistryKey._arrHives.length; i++)
  {
   var r = new RegExp('^' + arrHivesAbbr[i], 'i');
   theText = theText.replace(r, openRegistryKey._arrHives[i]);
  }
  if (theText.charAt(theText.length - 1) === ']')
   theText = theText.substring(0, theText.length - 1);
  return theText;
 },
 _getHiveCode: function(theText)
 {
  var hiveCode = -1;
  for (var i = 0; i < openRegistryKey._arrHives.length; i++)
  {
   var x = theText.indexOf(openRegistryKey._arrHives[i]);
   if (x >= 0)
   {
    theText = theText.substring(x, theText.length);
    hiveCode = i;
    break;
   }
  }
  return hiveCode;
 },
 handleMenuItemClick: function(evt)
 {
  var doc = evt.target.ownerDocument;
  var selected = openRegistryKey._getSelectedText(doc);
  if (!selected)
   return;
  selected = openRegistryKey._normalizeString(selected);
  var hiveCode = openRegistryKey._getHiveCode(selected);
  while(hiveCode === -1)
  {
   var gBundle = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
   var locale = gBundle.createBundle('chrome://ork/locale/openregistrykey.properties');
   var title = locale.GetStringFromName('openregistrykey.prompt.title');
   var message = locale.GetStringFromName('openregistrykey.prompt.message');
   var gPrompt = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
   var newVal = {value: selected};
   if (!gPrompt.prompt(openRegistryKey._getActiveWindow(), title, message, newVal, null, {value: false}))
    return;
   if (selected === newVal.value)
    return;
   selected = newVal.value;
   selected = openRegistryKey._normalizeString(selected);
   hiveCode = openRegistryKey._getHiveCode(selected);
  }
  openRegistryKey.openKey(openRegistryKey._getValidKey(hiveCode, selected));
 },
 openKey: function(str)
 {
  if (str.charAt(str.length - 1) === '\\')
   str = str.substring(0, str.length - 1);
  var wrk = Components.classes['@mozilla.org/windows-registry-key;1'].createInstance(Components.interfaces.nsIWindowsRegKey);
  wrk.create(wrk.ROOT_KEY_CURRENT_USER, 'Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\Regedit', wrk.ACCESS_WRITE);
  wrk.writeStringValue('LastKey', str);
  wrk.close(); 
  var file = openRegistryKey.getFileObjectForPath(openRegistryKey._regEditPath);
  var process = Components.classes['@mozilla.org/process/util;1'].createInstance(Components.interfaces.nsIProcess);
  process.init(file);
  var args = [];
  process.run(false, args, args.length); 
 },
 _getActiveWindow: function()
 {
  var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  return wm.getMostRecentWindow('navigator:browser');
 },
 _getValidKey: function(hiveCode, theText)
 {
  var strVerifiedKey = '';
  var firstSep = theText.indexOf('\\');
  if (firstSep === -1) return theText;
  var strHive = openRegistryKey._arrHives[hiveCode];
  var strWithoutHive = theText.substr(firstSep+1);
  if (strWithoutHive.length === 0)
   return strHive;
  var arrKeysAndValues = strWithoutHive.split('\\');
  var wrk = Components.classes['@mozilla.org/windows-registry-key;1'].createInstance(Components.interfaces.nsIWindowsRegKey);
  var apiCodes = [0x80000005, wrk.ROOT_KEY_LOCAL_MACHINE, wrk.ROOT_KEY_CLASSES_ROOT, wrk.ROOT_KEY_CURRENT_USER, 0x80000003];
  var rootKey = apiCodes[hiveCode];
  wrk.open(rootKey,  arrKeysAndValues[0], wrk.ACCESS_READ);
  for (var i = 1; i < arrKeysAndValues.length; i++)
  {
   var nextKey = strVerifiedKey + (i>1 ? '\\' : '') + arrKeysAndValues[i];
   if (!wrk.hasChild(nextKey))
    break;
   strVerifiedKey = nextKey;
  }
  wrk.close();
  return strHive + '\\' + arrKeysAndValues[0] + '\\' + strVerifiedKey;
 },
 getFileObjectForPath: function(path)
 {
  var file = Components.classes['@mozilla.org/file/local;1'].getService(Components.interfaces.nsILocalFile);
  file.initWithPath(path);
  return file;
 }
};
window.addEventListener('load', openRegistryKey.init, false);
