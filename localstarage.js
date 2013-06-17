var localStarage = function() {
  var LSPREFIX = 'localstarage-';
  var STARCLASS = 'localstarage';
  var STARREDCLASS = 'starred';
  var CLONESUFFIX = '-clone';
  var EMPTYHTML = '(None yet)';

  var supportsStorage = function () {
    try {
      return !!localStorage.getItem;
    } catch (e) {
      return false;
    }
  }();

  var addClone = function(item, starredList, onClone) {
    if (starredList.innerHTML == EMPTYHTML) {
      starredList.innerHTML = '';
    }
    var starredNode = item.cloneNode(true);
    starredNode.id += CLONESUFFIX;
    starredList.appendChild(starredNode);
    // Events don't copy :(
    starredNode.querySelectorAll('.' + STARCLASS)[0].onclick = item.querySelectorAll('.' + STARCLASS)[0].onclick;
    onClone.call(null, starredNode);
  }

  var removeClone = function(item) {
    var starredNode = document.getElementById(item.id + CLONESUFFIX);
    starredNode.parentNode.removeChild(starredNode);
  }

  var checkEmpty = function(starredList) {
    if (starredList.querySelectorAll('.' + STARREDCLASS).length == 0) {
      starredList.innerHTML = EMPTYHTML;
    }
  }

  var addStar = function(item, options) {
    var lsKey = LSPREFIX + item.id;
    var star = document.createElement('span');
    star.className = STARCLASS;
    star.innerHTML = '★';
    star.onclick = function(event) {
      event.preventDefault();
      if (!star.classList.contains(STARREDCLASS)) {
        star.classList.add(STARREDCLASS);
        localStorage.setItem(lsKey, 'starred');
        if (options.starredList) {
          addClone(item, options.starredList, options.onClone);
        }
      } else {
        star.className = STARCLASS;
        localStorage.removeItem(lsKey);
        if (options.starredList) {
          removeClone(item);
          checkEmpty(options.starredList);
        }
      }
    };
    item.insertBefore(star, item.firstChild);

    if (localStorage.getItem(lsKey)) {
      star.classList.add(STARREDCLASS);
      if (options.starredList) {
        addClone(item, options.starredList, options.onClone);
      }
    }
  }

  return {

    init: function(list, options) {
      if (!supportsStorage) return false;
      var items = list.childNodes;
      for (var i = 0; i < items.length; i++) {
        if (items[i].nodeType == 1) {
          addStar(items[i], options);
        }
      }
      if (options.starredList) {
        checkEmpty(options.starredList);
      }
    }
  }
}();