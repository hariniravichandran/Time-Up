
var background = {
  timerData: {
    facebook: 20
  },
  lastOpenedTimes: {}, //Contains when last network was opened if currently open
  currentTime: new Date(), 
  socialNetworkTabs: {}, //{tabId: site}
  socialNetworkTabsList: {}, //{site: [list of tabids]}
  init: function() {
    var _this = background;
    //chrome.storage.sync.clear(function (){});
    chrome.storage.sync.get("timerData", function (obj) {
          console.log(obj);
          if (obj.timerData !== undefined) {
            _this.timerData =  _this.clone(obj.timerData);
          } else {
            _this.timerData =  {};
          }
          _this.trackTabs();
          chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
              _this.trackNewTab(tabId, changeInfo, tab);
          });
          chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
              _this.tabClosed(tabId, removeInfo);
          });
          console.log("Background running and listening");
          chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
              if (request.msg == 'Send Data') {
                sendResponse(_this.timerData);
              } else {
                _this.saveChanges(request);
                sendResponse("Got the data!");
              }
          });
          setInterval(_this.checkIfTimeToClose, 3000);
    });
    
  },
  saveChanges: function (timerDataNew) {
      /*Get currently save data and UPSERT the new timer data for the site in question
       and immediately check to see if it's open*/
      var timerDataCurrent = this.clone(this.timerData);
      var _this = background;
      var updated = false;
      for (var key in timerDataCurrent) {
        if (key == timerDataNew.site) {
          if (timerDataNew.timeLimit > 0) {
            timerDataCurrent[key] = parseInt(timerDataNew.timeLimit);
          }else {
            delete timerDataCurrent[key]; 
          }
          updated = true;
          break;
        }
      }
      if (!updated && timerDataNew.timeLimit > 0) {
        timerDataCurrent[timerDataNew.site] = parseInt(timerDataNew.timeLimit);
      }
      chrome.storage.sync.set({'timerData': timerDataCurrent}, function() {
          chrome.storage.sync.get("timerData", function (obj) {
              _this.timerData = _this.clone(obj.timerData);
              _this.trackTabs();
          });
      });
  },
  extractDomain: function (url) {
      var domain;
      //find & remove protocol (http, ftp, etc.) and get domain
      if (url.indexOf("://") > -1) {
          domain = url.split('//')[1];
          domain = domain.split('/')[0];
      }
      else {
          domain = url.split('/')[0];
      }
      //find & remove port number
      domain = domain.split(':')[0];
      var splitArr = domain.split('.'); 
      domain = splitArr[splitArr.length - 2]
      return domain;
  },

  addSiteToTrackedTimers: function(tab, tabId) {
      var networksToMonitor = [];
      var _this = background;
      for (var key in _this.timerData) {
        networksToMonitor.push(key);
      }
      /*
        The regex gets the parts which are not between // and / and makes them empty. 
        So http://www.facebook.com/xxxx ===> www.facebook.com.
        The split (".") ===> [www, facebook, com] and then we reverse it. Second last is the sitename.
        It doesn't handle all URL cases though. We need some other way of getting what social network it is.
      */
      //console.log(tab.url.replace(/.*?:\/\//g, ""));
      //var regex = /^((http[s]?|ftp):\/\/)?\/?([^\/\.]+\.)*?([^\/\.]+\.[^:\/\s\.]{2,3}(\.[^:\/\s\.]‌​{2,3})?)(:\d+)?($|\/)([^#?\s]+)?(.*?)?(#[\w\-]+)?$/gi;
      //console.log(tab.url.replace(/.*?:\/\//g, "").split('.'));
      
      //var siteNameArray = tab.url.replace(/.*?:\/\//g, "").split('.').reverse(); 
      //var siteName = siteNameArray[1];
      
      var siteName = _this.extractDomain(tab.url);
      if (networksToMonitor.indexOf(siteName) >= 0) {
            _this.socialNetworkTabs["tab@"+tab.id] = siteName;
            if (_this.socialNetworkTabsList[siteName] === undefined) {
              _this.socialNetworkTabsList[siteName] = tab.id;  
            } else {
              _this.socialNetworkTabsList[siteName] += ("," + tab.id);  
            }
            
            var newlyOpened = true;
            for (var key in _this.lastOpenedTimes) {
              if (key == siteName) {
                newlyOpened = false;
                break;
              }
            }
            if (newlyOpened) {
              _this.lastOpenedTimes[siteName] = new Date();
            }
      }
  },
  tabClosed: function(tabId, removeInfo) {
    /*
      This works even if we close a tab using this extension.
      If a tab with a social network being tracked is closed, then delete it from 
      tabs list for that site and the tab itself from our tracking. If that's the last 
      tab open for a tracked site, erase last opened time for the site. 
    */
    if (background.socialNetworkTabs["tab@"+tabId] !== undefined) {
      var siteClosed = background.socialNetworkTabs["tab@"+tabId];
      delete background.socialNetworkTabs["tab@"+tabId];
      for (var key in background.socialNetworkTabsList) {
        if (key == siteClosed) {
          var deleteTracking = true;
          if (background.socialNetworkTabsList[key].split(",").length == 1) {
            /*Only one tab for this site, so delete all tracking*/
            delete background.lastOpenedTimes[siteClosed];
          } else {
            deleteTracking = false;
            var tabsForSite = background.socialNetworkTabsList[key].split(",");
            console.log(background.socialNetworkTabsList[key].split(","));
            var indexOfTabId = tabsForSite.indexOf(""+tabId);
            console.log(indexOfTabId);
            if (indexOfTabId > -1) {
              tabsForSite.splice(indexOfTabId, 1);
            }
            background.socialNetworkTabsList[key] = tabsForSite.join(",");
          }

        }
      }
      if (deleteTracking == true) {
        delete background.socialNetworkTabsList[siteClosed];
      }
    }
  },
  trackNewTab: function(tabId, changeInfo, tab){
    
    if(tab.status == 'complete') {
      this.addSiteToTrackedTimers(tab);
    }
  },
  trackTabs: function () {
    var networksToMonitor = [];
    var _this = background;
    for (var key in _this.timerData) {
      networksToMonitor.push(key);
    }
    chrome.tabs.query({}, function (tabs){
      //Now an array of tabs where the social network is open is returned and we check if array has elements
      tabs.map (function(tab) {
          _this.addSiteToTrackedTimers(tab);
      });
    });
  },
  checkIfTimeToClose: function() {
    var _this = background;
    var networksToMonitor = [];
    for (var key in _this.timerData) {
      networksToMonitor.push(key);
    }
    var curTime = new Date();
    for (var key in _this.lastOpenedTimes) {
      if ((curTime -  _this.lastOpenedTimes[key]) >= (_this.timerData[key] * 1000 * 60) ) {
        /*Time to close. So get the tab list and use split to create an array. The map and parseInt is just used to
        convert strings to int so the .remove function works fine.*/
        var tabsIdToRemove = _this.socialNetworkTabsList[key].split(",").map (function (el) {
          return parseInt(el);
        })
        chrome.tabs.remove(tabsIdToRemove, function (){

        });
      }
    }
  },
  clone: function (obj) {
    var copy;
    var _this = this;
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = _this.clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = _this.clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
  }
};

background.init();

