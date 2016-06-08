'use strict';
/*
 * This module enables right click context menu
 *
 */

XPCOMUtils.defineLazyModuleGetter(this, 'CliqzUtils',
  'chrome://cliqzmodules/content/CliqzUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'CliqzHistoryManager',
  'chrome://cliqzmodules/content/CliqzHistoryManager.jsm');

(function(ctx) {

  var contextMenu,
      activeArea,
      CONTEXT_MENU_ITEMS,
      originalTarget;

  function telemetry(type){
    var signal = {
      type: 'context_menu'
    };

    if(type) {
      signal.action = "click";
      signal.target = type;
    } else {
      signal.action = "open";
      signal.context = "dropdown";
    }

    CliqzUtils.telemetry(signal);
  }

  function openFeedback(e) {
    CLIQZEnvironment.openLink(window, CliqzUtils.FEEDBACK + "?kind=" + e.target.getAttribute('data-kind'), true);
    telemetry('open_feedback');
  }

  function openNewTab(e) {
    CLIQZEnvironment.openLink(window, e.target.getAttribute('data-url'), true);
    telemetry('open_new_tab');
  }

  function openNewWindow(e) {
    CLIQZEnvironment.openLink(window, e.target.getAttribute('data-url'), false, true);
    telemetry('open_new_window');
  }

  function openInPrivateWindow(e) {
    CLIQZEnvironment.openLink(window, e.target.getAttribute('data-url'), false, false, true);
    telemetry('open_private_window');
  }

  function removeEntry(e) {
    var item,
        url = e.target.getAttribute('data-url'),
        uri = CliqzUtils.makeUri(url, '', null);

    if(CliqzHistoryManager.isBookmarked(uri)){
      removeFromBookmarks(uri);
      //TODO remove from history only if history is enabled
      removeFromHistory(url, uri);
      telemetry('remove_from_history_and_bookmarks');
    } else {
      removeFromHistory(url, uri);
      telemetry('remove_from_history');
    }

  }

  function triggerQuery() {
    var urlbar = CliqzUtils.getWindow().document.getElementById('urlbar'),
        query = urlbar.value;

    setTimeout(function() {
      urlbar.mInputField.setUserInput('');
      urlbar.mInputField.setUserInput(query);
    }, 50);
  }

  function removeFromHistory(url, uri) {
    try {
      CliqzHistoryManager.removeFromHistory(uri);
      triggerQuery();

    } catch(e) {
      CliqzUtils.log(e.message, 'Error removing entry from history');
    }
  }

  function removeFromBookmarks(uri) {
    try {
      CliqzHistoryManager.removeFromBookmarks(uri);
      triggerQuery();
    } catch(e) {
      CliqzUtils.log(e.message, "Error removing entry from bookmarks");
    }
  }

  function replaceRemoveEntry(items, withItem) {
    Array.from(items).forEach(function(child, index) {
      if(child.getAttribute('functionality') === 'removeEntry') {
        child.setAttribute('label', CliqzUtils.getLocalizedString(withItem))
      }
    });
  }

  var ContextMenu = {
    enableContextMenu: function(box) {
      activeArea = box;
      activeArea.addEventListener('contextmenu', rightClick);
    }
  };

  function initContextMenu(){
    CONTEXT_MENU_ITEMS = [
        { label: CliqzUtils.getLocalizedString('cMenuOpenInNewTab'),         command: openNewTab,            displayInDebug: true,   functionality: 'openNewTab' },
        { label: CliqzUtils.getLocalizedString('cMenuOpenInNewWindow'),      command: openNewWindow,         displayInDebug: true,   functionality: 'openNewWindow' },
        { label: CliqzUtils.getLocalizedString('cMenuOpenInPrivateWindow'),  command: openInPrivateWindow,   displayInDebug: false,  functionality: 'openInPrivateWindow' },
        { label: CliqzUtils.getLocalizedString('cMenuRemoveFromHistory'),    command: removeEntry,           displayInDebug: true,   functionality: 'removeEntry' },
        { label: CliqzUtils.getLocalizedString('cMenuFeedback'),             command: openFeedback,          displayInDebug: true,   functionality: 'openFeedback'},
    ];

    return CLIQZEnvironment.createContextMenu(activeArea, CONTEXT_MENU_ITEMS);
  }

  function hideRemoveEntry(menu) {
    Array.from(menu.children).forEach(function(child) {
      if(child.getAttribute('functionality') === 'removeEntry') {
        child.setAttribute('style', 'display:none');
      }
    });
  }

  function showRemoveEntry(menu) {
    Array.from(menu.children).forEach(function(child) {
      if(child.getAttribute('functionality') === 'removeEntry') {
        child.setAttribute('style', 'display:block');
      }
    });
  }

  function rightClick(ev) {
    contextMenu = contextMenu || initContextMenu(); //lazy initialization
    originalTarget = ev.target;

    var children,
        uri,
        url = CLIQZ.UI.getResultOrChildAttr(ev.target, 'url');

    if(url.trim() != '') {
      children = contextMenu.childNodes;
      var menu = CliqzUtils.getWindow().document.getElementById('dropdownContextMenu');
      uri = CliqzUtils.makeUri(url, '', null);
      if (uri === null) {

        hideRemoveEntry(menu);

        for(var i = 0; i < children.length; i++) {
          children[i].setAttribute('data-url', url);
        }
        CLIQZEnvironment.openPopup(contextMenu, ev, ev.screenX, ev.screenY);

        telemetry();

      } else {
        PlacesUtils.asyncHistory.isURIVisited(uri, function(aURI, aIsVisited) {
          if(!aIsVisited || CLIQZ.UI.getElementByAttr(originalTarget, 'dont-remove', 'true')) {
            hideRemoveEntry(menu);

          } else {
            showRemoveEntry(menu);
            if(CliqzHistoryManager.isBookmarked(uri)){
              //TODO check if history is disabled, in this case we should display Remove from Bookmarks
              replaceRemoveEntry(children, CliqzUtils.getLocalizedString('cMenuRemoveFromBookmarksAndHistory'));
            } else {
              replaceRemoveEntry(children, CliqzUtils.getLocalizedString('cMenuRemoveFromHistory'));
            }
          }

          for(var i = 0; i < children.length; i++) {
            children[i].setAttribute('data-url', url);
          }
          CLIQZEnvironment.openPopup(contextMenu, ev, ev.screenX, ev.screenY);

          telemetry();
        });
      }
    }
  }

  ctx.CLIQZ.ContextMenu = ContextMenu;

})(this);
