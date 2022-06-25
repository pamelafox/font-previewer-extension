var fonts = {};

/**
 * Hash to store the user's currently selected font options and values.
 */
var fontOptions = {};

/**
 * Hash that maps font option IDs to CSS equivalents.
 * TODO: Remember why the mapping is necessary. (I forgot).
 */
var fontOptionIds =
{'fontFamily': 'font-family',
 'fontSize': 'font-size',
 'fontStyle': 'font-style',
 'fontWeight': 'font-weight',
 'textShadow': 'text-shadow',
 'textDecoration': 'text-decoration',
 'textTransform': 'text-transform',
 'letterSpacing': 'letter-spacing',
 'wordSpacing': 'word-spacing',
 'lineHeight': 'line-height'
};

var lsSubset;
var LS_SEARCHBOX_VALUE = 'font-previewer-searchbox-value';
var LS_FONTS_API = 'font-previewer-api';

// The search terms chosen by the user
var currentSearchTerms = [];

/**
 * Called on page load. Dynamically builds font list.
 */
function onLoad() {
  document.getElementById("fontStyle").addEventListener("change", onOptionChange);
  document.getElementById("fontWeight").addEventListener("change", onOptionChange);
  document.getElementById("textShadow").addEventListener("change", onOptionChange);
  document.getElementById("textTransform").addEventListener("change", onOptionChange);
  document.getElementById("textDecoration").addEventListener("change", onOptionChange);
  document.getElementById("fontSize").addEventListener("change", onOptionChange);
  document.getElementById("fonts-subset").addEventListener("change", onOptionChange);
  document.getElementById("fonts-searchbox").addEventListener("input", onSearchChange);

  var fontsJSON = lscache.get(LS_FONTS_API);
  if (fontsJSON) {
    onFontsLoad(fontsJSON, true);
  } else {
    var script = document.createElement('script');
    script.src = 'https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyBLBeqjz4y-yYybCig6p1PMKnt9g4PLLNU&callback=onFontsLoad';
    document.getElementsByTagName('head')[0].appendChild(script);
  }
}

function onFontsLoad(json, fromCache) {
  var fontsList = document.getElementById('fonts-all');

  for (fontInfo of json.items) {
    const fontRow = makeFontRow(fontInfo);

    fontsList.appendChild(fontRow);

    // Save font info and associated DOM element for later use
    // Lowercase font name is saved to speed up searches
    fontInfo['fontRow'] = fontRow;
    fontInfo['lowercaseFamily'] = fontInfo.family.toLowerCase();
    fonts[fontInfo.family] = fontInfo;
  }
  if (localStorage.getItem(lsSubset)) {
    document.getElementById('fonts-subset').value = localStorage.getItem(lsSubset);
  }

  const searchboxValue = lscache.get(LS_SEARCHBOX_VALUE);

  if (searchboxValue) {
    document.getElementById('fonts-searchbox').value = searchboxValue;
  }

  onSubsetChange();
  localStarage.init(fontsList, {
     starredList: document.getElementById('fonts-starred'),
     onClone: addRowBehavior
  });
  if (!fromCache) {
    lscache.set(LS_FONTS_API, json, 60*12);
  }
  loadVisibleFonts();
  onSearchChange();
  $('#fonts').on('scroll', throttle(function (event) {
    loadVisibleFonts();
  }, 1000));
}

/**
 * Adds specified font to font list.
 * @param {Object} fontInfo
 */
function makeFontRow(fontInfo) {
  const fontName = fontInfo.family;
  var div = document.createElement('div');
  div.id = fontName.replace(' ', '', 'g');
  div.setAttribute('data-font', fontName);
  div.className = 'fontrow ' + fontInfo.subsets.join(' ');
  var label = document.createElement('label');
  var input = document.createElement('input');
  input.type = 'radio';
  input.name = 'fontFamily';
  input.value = fontName;
  label.appendChild(input);
  if (fontInfo.subsets[0] != 'khmer') {
    label.style.fontFamily = fontName;
  }
  label.style.fontWeight = 'normal';
  label.appendChild(document.createTextNode(fontName));
  div.appendChild(label);
  addRowBehavior(div);
  return div;
}


function addRowBehavior(div) {
  var input = div.getElementsByTagName('input')[0];
  input.onchange = function () {
    fontOptions.fontFamily = input.value;
    changeFont();
  };
}

function throttle(fn, threshhold, scope) {
  threshhold || (threshhold = 250);
  var last,
      deferTimer;
  return function () {
    var context = scope || this;

    var now = +new Date,
        args = arguments;
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}

var LOADED_FONTS = {};
function loadVisibleFonts() {

  function inView($elem, nearThreshold) {
    function getViewportHeight() {
      var height = window.innerHeight; // Safari, Opera
      var mode = document.compatMode;

      if ( (mode || !$.support.boxModel) ) { // IE, Gecko
          height = (mode == 'CSS1Compat') ?
          document.documentElement.clientHeight : // Standards
          document.body.clientHeight; // Quirks
      }
      return height;
    }

    var viewportHeight = getViewportHeight();
    var scrollTop = (document.documentElement.scrollTop ?
          document.documentElement.scrollTop :
          document.body.scrollTop);
    var elemTop    = $elem.offset().top;
    var elemHeight = $elem.height();
    nearThreshold = nearThreshold || 0;
    if ((scrollTop + viewportHeight + nearThreshold) > (elemTop + elemHeight)) {
      return true;
    }
    return false;
  }

  var maxCharacters = 1730;
  var cssBaseUrl = 'https://fonts.googleapis.com/css?family=';

  var visibleFontNames = [];

  for (font of Object.values(fonts)) {
    if (!LOADED_FONTS[font.family] && font.subsets[0] != 'khmer') {
      const $fontRow = $(font.fontRow);

      if ($fontRow.is(':visible') && inView($fontRow, 50)) {
        visibleFontNames.push([escape(font.family)]);
        LOADED_FONTS[font.family] = true;
      }
    }
  }
  if (visibleFontNames.length > 0) {
    var cssUrl = cssBaseUrl + visibleFontNames.join('|');
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = cssUrl;
    document.getElementsByTagName('head')[0].appendChild(link);
  }
}

/**
 * Called when the user changes any of the font styling options.
 * @param {Element} elem
 */
function onOptionChange(elem) {
  var id = elem.id;
  var value = elem.value;
  fontOptions[id] = value;
  changeFont();
}

/**
 * Helper method to remove duplicate strings from an array (case-insensitive).
 * @param {Array} stringArray
 */
 function removeDuplicates(stringArray) {
  return [...new Set(
    stringArray.map(str => str.toLowerCase())
  )];
}

/**
 * Helper method that returns true if a given font family matches any search term in a list (or the list is empty).
 * @param {Array} searchTermArray
 * @param {String} fontFamily
 */
function doesSearchTermMatch(searchTermArray, fontFamily) {
  return searchTermArray.length === 0 || searchTermArray.some(searchTerm => fontFamily.includes(searchTerm));
}

/**
 * Filter fonts based on search terms and hide them from the DOM accordingly.
 */
function filterFonts() {
  for (font of Object.values(fonts)) {
    // If a given font matches the search term, show it.
    if (doesSearchTermMatch(currentSearchTerms, font.lowercaseFamily)) {
      font.fontRow.style.display = 'block';
    } else {
      font.fontRow.style.display = 'none';
    }
  }
}

/**
 * Called when the user changes the font subset dropdown.
 * Also called on initial load.
 */
function onSubsetChange() {
  var value = document.getElementById('fonts-subset').value;
  localStorage.setItem(lsSubset, value);
  var matches = document.querySelectorAll('div.fontrow');
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].classList.contains(value)) {
      matches[i].style.display = 'block';
    } else {
      matches[i].style.display = 'none';
    }
  }
}

/**
 * Called when the user changes text in the font search field.
 * Also called on initial load.
 */
function onSearchChange() {
  const searchbox = document.getElementById('fonts-searchbox');

  // Sanitize and format input
  const value = searchbox.value
    .replace(/[^a-zA-Z0-9, ]/g, '')  // Remove non-alphanumeric characters
    .replace(/ {2,}/g, ' ')  // Strip extra whitespace
    .replace(/[, ]{2,}/g, ', ');  // Remove duplicate commas

  searchbox.value = value;

  // Split into individual search terms and remove duplicates
  currentSearchTerms = removeDuplicates(value.split(/,\s?/))
    .filter(searchTerm => {
      return searchTerm.length > 0;
    });

  filterFonts();
  lscache.set(LS_SEARCHBOX_VALUE, value, 60*12);
}

/**
 * Helper function that returns (a promise to) the current tab id
 */
async function getCurrentTabId() {
  let options = {
    active: true,
    lastFocusedWindow: true
  };

  // Return the first result (there should only be one)
  return (await chrome.tabs.query(options))[0].id;
}

/**
 * Resets the font on the target page by setting styles back
 * to original styles (stored in data attributes).
 */
async function resetFont() {
  // Resets the form
  document.forms[0].reset();

  /**
   * Resets the font and styles on target page to their original state, stored in data attributes.
   * @param {Object} fontOptionIds
   */
  function PREVIEWER_resetFont(fontOptionIds) {

    function resetElem(elem) {
      for (var fontOptionId in fontOptionIds) {
        if (elem.dataset[fontOptionId] != '') {
          elem.style[fontOptionId] = elem.dataset[fontOptionId];
        } else {
         elem.style[fontOptionId] = null;
        }
      }
    }
    resetElem(document.body);
    var elems = document.getElementsByTagName('*');
    for (var i = 0; i < elems.length; i++) {
      resetElem(elems[i]);
    }
  }

  // Execute PREVIEWER_resetFont on the target page
  chrome.scripting.executeScript({
    target: {tabId: await getCurrentTabId()},
    func: PREVIEWER_resetFont,
    args: [fontOptionIds],
  });
}

/**
 * Called when the user selects a new font to preview.
 */
async function changeFont() {
  var selector = document.getElementById('selector').value;
  var fontFamily = fontOptions.fontFamily || fonts[0];
  var subset = document.getElementById('fonts-subset').value;
  if (subset.indexOf('-ext') > -1) {
    subset = subset.split('-ext')[0] + ',' + subset;
  }
  var fontUrl = '//fonts.googleapis.com/css?family=' + fontFamily + '&subset=' + subset;

  // Constructs the HTML that the user can copy/paste into their site.
  var fontHtml = '<link href="' + fontUrl + '" rel="stylesheet" type="text/css">\n';
  fontHtml += '<style>\n' + selector + ' {\n font-family: \'' + fontFamily + '\', ' + (fonts[fontFamily].alt || 'sans-serif') + ';\n';
  for (var fontOptionId in fontOptionIds) {
    if (fontOptions[fontOptionId]) {
      if (fontOptionId != 'fontFamily') {
        fontHtml += '  ' + fontOptionIds[fontOptionId] + ': ' + fontOptions[fontOptionId] + ';\n';
      }
    }
  }
  fontHtml += '}\n</style>';
  document.getElementById('fontHtml').innerHTML = fontHtml.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /**
   * Changes the font and styles on the target page per user selected options.
   * Sends all the globals from this page, since they are not available on the target page.
   * @param {Object} fontOptionIds
   * @param {Object} fontOptions
   * @param {String} fontFamily
   * @param {String} fontUrl
   */
  function PREVIEWER_changeFont(selector, fontOptionIds, fontOptions, fontFamily, fontUrl) {

    /**
     * Processes given DOM element. For every styling option specified, it stores
     * the old style as a data attribute and sets the new style.
     * It also sets a classname on the element to indicate its been processed.
     * @param {Element} elem
     */
    function processElem(elem) {
      for (var fontOptionId in fontOptionIds) {
        if (fontOptions[fontOptionId]) {
          if (elem.dataset[fontOptionId] === null) {
            elem.dataset[fontOptionId] = elem.style[fontOptionId];
          }
          elem.style[fontOptionId] = fontOptions[fontOptionId];
        }
      }
    }

    // Adds the font stylesheet to the page.
    document.body.innerHTML += '<link href="' + fontUrl + '" rel="stylesheet" type="text/css">';

    // Processes BODY tag and all children.
    if (selector == '*') {
      processElem(document.body);
    }
    var elems = document.body.querySelectorAll(selector);
    for (var i = 0; i < elems.length; i++) {
      processElem(elems[i]);
    }
  }

  // Execute PREVIEWER_changeFont on the target page
  chrome.scripting.executeScript({
    target: {tabId: await getCurrentTabId()},
    func: PREVIEWER_changeFont,
    args: [selector, fontOptionIds, fontOptions, fontFamily, fontUrl],
  });
}

/**
 * Converts all passed arguments to a string.
 * Makes it easier to send function call to executeScript()
 * return {String}
 */
function stringifyArgs() {
  var stringifiedArgs = [];
  for (var i = 0; i < arguments.length; i++) {
    var argument = arguments[i];
    if (typeof argument == 'string') {
      stringifiedArgs.push('\'' + argument + '\'');
    } else if (typeof argument == 'number' || typeof argument == 'boolean') {
      stringifiedArgs.push(argument);
    } else if (typeof argument == 'object') {
      stringifiedArgs.push(JSON.stringify(argument));
    }
  }
  return stringifiedArgs.join(',');
}

onLoad();
