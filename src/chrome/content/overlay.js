'use strict;'
var openRegistryKey = {
 _regEditPath: null,
 _arrHives: new Array('HKEY_CURRENT_CONFIG', 'HKEY_LOCAL_MACHINE', 'HKEY_CLASSES_ROOT', 'HKEY_CURRENT_USER', 'HKEY_USERS'),
 init: function()
 {
  let env = Components.classes['@mozilla.org/process/environment;1'].getService(Components.interfaces.nsIEnvironment);
  let winDir = env.get('windir');
  if (winDir.charAt(winDir.length - 1) != '\\')
   winDir += '\\';
  openRegistryKey._regEditPath = winDir + 'regedit.exe';
  let file = openRegistryKey.getFileObjectForPath(openRegistryKey._regEditPath);
  if (!file.exists())
   openRegistryKey._regEditPath = winDir + 'system32\\regedt32.exe';
  let cm = window.document.getElementById('contentAreaContextMenu');
  let mItem = window.document.createElement('menuitem');
  mItem.setAttribute('id','context-openregistrykey');
  mItem.setAttribute('class','menuitem-iconic');
  mItem.setAttribute('image','chrome://ork/skin/pic16.png');
  let gBundle = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
  let locale = gBundle.createBundle('chrome://ork/locale/openregistrykey.properties');
  mItem.setAttribute('label', locale.GetStringFromName('openregistrykey.contextmenu.label'));
  mItem.addEventListener('click', openRegistryKey.handleMenuItemClick, false);
  cm.appendChild(mItem);
  cm.addEventListener('popupshowing', openRegistryKey.handleContextMenuShowing, false);
 },
 handleContextMenuShowing: function(evt)
 {
  let doc = evt.target.ownerDocument;
  doc.getElementById('context-openregistrykey').hidden = !openRegistryKey._getSelectedText(doc);
 },
 _getSelectedText: function(doc)
 {
  return openRegistryKey._getActiveWindow().content.getSelection().toString();
 },
 _normalizeString: function(theText)
 {
  let arrHivesAbbr = new Array ('HKCC', 'HKLM', 'HKCR', 'HKCU', 'HKU');
  theText = theText.replace(/(\r|\n|\t)/g, '');
  theText = theText.replace(/Current Version/g, 'CurrentVersion');
  let arrSplit = theText.split('\\');
  for (let i = 0; i < arrSplit.length; i++)
  {
   arrSplit[i] = arrSplit[i].replace(/^\s*/, '').replace(/\s*$/, '');
  }
  theText = arrSplit.join('\\');
  for (let i = 0; i < openRegistryKey._arrHives.length; i++)
  {
   let r = new RegExp('^' + arrHivesAbbr[i], 'i');
   theText = theText.replace(r, openRegistryKey._arrHives[i]);
  }
  if (theText.charAt(theText.length - 1) == ']')
   theText = theText.substring(0, theText.length - 1);
  return theText;
 },
 _getHiveCode: function(theText)
 {
  let hiveCode = -1;
  for (let i = 0; i < openRegistryKey._arrHives.length; i++)
  {
   let x = theText.indexOf(openRegistryKey._arrHives[i]);
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
  let doc = evt.target.ownerDocument;
  let selected = openRegistryKey._getSelectedText(doc);
  if (!selected)
   return;
  selected = openRegistryKey._normalizeString(selected);
  let hiveCode = openRegistryKey._getHiveCode(selected);
  while(hiveCode == -1)
  {
   let gBundle = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
   let locale = gBundle.createBundle('chrome://ork/locale/openregistrykey.properties');
   let title = locale.GetStringFromName('openregistrykey.prompt.title');
   let message = locale.GetStringFromName('openregistrykey.prompt.message');
   let gPrompt = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
   let newVal = {value: selected};
   if (!gPrompt.prompt(openRegistryKey._getActiveWindow(), title, message, newVal, null, {value: false}))
    return;
   if (selected == newVal.value)
    return;
   selected = newVal.value;
   selected = openRegistryKey._normalizeString(selected);
   hiveCode = openRegistryKey._getHiveCode(selected);
  }
  openRegistryKey.openKey(openRegistryKey._getValidKey(hiveCode, selected));
 },
 openKey: function(str)
 {
  if (str.charAt(str.length - 1) == '\\')
   str = str.substring(0, str.length - 1);
  let wrk = Components.classes['@mozilla.org/windows-registry-key;1'].createInstance(Components.interfaces.nsIWindowsRegKey);
  wrk.create(wrk.ROOT_KEY_CURRENT_USER, 'Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\Regedit', wrk.ACCESS_WRITE);
  wrk.writeStringValue('LastKey', str);
  wrk.close(); 
  let file = openRegistryKey.getFileObjectForPath(openRegistryKey._regEditPath);
  let process = Components.classes['@mozilla.org/process/util;1'].createInstance(Components.interfaces.nsIProcess);
  process.init(file);
  let args = [];
  process.run(false, args, args.length); 
 },
 _getActiveWindow: function()
 {
  let wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  return wm.getMostRecentWindow('navigator:browser');
 },
 _getValidKey: function(hiveCode, theText)
 {
  let iLastBSlash, strKey, strValue, strVerifiedKey = '';
  let firstSep = theText.indexOf('\\');
  if (firstSep == -1) return theText;
  let strHive = openRegistryKey._arrHives[hiveCode];
  let strWithoutHive = theText.substr(firstSep+1);
  if (strWithoutHive.length == 0)
   return strHive;
  let arrKeysAndValues = strWithoutHive.split('\\');
  let wrk = Components.classes['@mozilla.org/windows-registry-key;1'].createInstance(Components.interfaces.nsIWindowsRegKey);
  let apiCodes = [0x80000005, wrk.ROOT_KEY_LOCAL_MACHINE, wrk.ROOT_KEY_CLASSES_ROOT, wrk.ROOT_KEY_CURRENT_USER, 0x80000003];
  let rootKey = apiCodes[hiveCode];
  wrk.open(rootKey,  arrKeysAndValues[0], wrk.ACCESS_READ);
  for (i = 1; i < arrKeysAndValues.length; i++)
  {
   let nextKey = strVerifiedKey + (i>1 ? '\\' : '') + arrKeysAndValues[i];
   if (!wrk.hasChild(nextKey))
    break;
   strVerifiedKey = nextKey;
  }
  wrk.close();
  return strHive + '\\' + arrKeysAndValues[0] + '\\' + strVerifiedKey;
 },
 getFileObjectForPath: function(path)
 {
  let file = Components.classes['@mozilla.org/file/local;1'].getService(Components.interfaces.nsILocalFile);
  file.initWithPath(path);
  return file;
 }
};
window.addEventListener('load', openRegistryKey.init, false);
