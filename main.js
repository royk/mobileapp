// Container for agnostic methods and classes
// Since it's decoupled from our app, we have to ask it nicely for functionality (Mr.Loader, get json please!)
window.Mr = (function() {
	// Loader: Generic http requests class
	var Loader = (function() {
		
		return {
			getJSON: function get(req, params, cb) {
				var cached = localStorage.getItem(req);
				if (cached) {
					cb(JSON.parse(cached));
				}
				else {
					$.getJSON(req, params, function(result) {
						localStorage.setItem(req, JSON.stringify(result));
						cb(result);
					});
				}
			},
			get: function get(req, params, cb) {
				$.get(req, params, cb);
			}
		};
	}());

	// TouchManager: Updates scroll and notifies on swipes.
	var TouchManager = (function() {
		var _startPos = {};
		var _offset = {};
		var _startScroll = 0;
		var _events = {};
		var _swipeInProgress = false;
		var _swipSensitivity = 20;
		var _dispatch = function _dispatch(eventName, args) {
			_events[eventName] = _events[eventName] || [];
			_events[eventName].forEach(function(cb) {
				cb.apply(this, args);
			});
		};
		return {
			listen: function listen(eventName, cb) {
				_events[eventName] = _events[eventName] || [];
				_events[eventName].push(cb);
			},
			init: function init() {
				document.addEventListener('touchstart', function(ev) {
					var touch = ev.touches[0];
					_startPos.x = touch.screenX;
					_startPos.y = touch.screenY;
					_offset.x = 0;
					_offset.y = 0;
					_startScroll = $(document).scrollTop();
				});
				document.addEventListener('touchend', function(ev) {
					_swipeInProgress = false;
					if (Math.abs(_offset.x)-5>0 || Math.abs(_offset.y)-5>0) {
						ev.preventDefault();
					}
				});
				document.addEventListener('touchmove', function(ev) {
					ev.preventDefault();
					var touch = ev.touches[0];
					_offset.x = _startPos.x - touch.screenX;
					_offset.y = _startPos.y - touch.screenY;
					// Horizontal scroll
					if (Math.abs(_offset.x)>_swipSensitivity && !_swipeInProgress) {
						_swipeInProgress = true;
						_dispatch("swipe", [{deltaX: _offset.x}]);
					// Vertical scroll. If swipe ocurred, we can ignore vertical scrolls.
					} else {
						var scrollY = _startScroll+_offset.y;
						// prevent getting stuck beyond bottom
						if (scrollY<0) {
							_startPos.y -= scrollY;
						}
						$(document).scrollTop(scrollY);
					}
				}.bind(this));
			}
		};
	}());

	// ViewRenderer: Contains and generates html templates
	var ViewRenderer = (function() {
		var _viewRepo = {};
		var _ready = false;
		
		var _prepareView = function _prepareView(name, cb) {
			var viewURL = "/views/"+name+".html";
			Mr.Loader.get(viewURL, null, function(result) {
				_viewRepo[name] = result;
				cb();
			});
		};
		var _construct = function _construct(template, attrObj) {
			var regexp;
			var content;
			
			for (var attr in attrObj) {

				if (attr.match(/array\d*/gi)) {
					content = renderArray(attrObj.view, attrObj[attr]);
				} else {
					content = attrObj[attr];
				}
				template = template.replace(new RegExp("{"+attr+"}", "g"), content);
			}
			return template;
		};
		return {
			renderView: function renderView(name, attrObj) {
				return _construct(_viewRepo[name], attrObj);
			},

			renderArray: function renderArray(name, data) {
				data.forEach(function(item, index) {
					item.index = index;
					renderView(name, item);
				});
			},
			// To make our future requests synchronous (and our life easier), we preload all our templates in advance.
			init: function init(cb) {
				Mr.async(	{f: _prepareView, args:["title"]},
							{f: _prepareView, args:["content"]},
							{f: cb});
							
			}
		};



	}());
	return {
		// Classes
		Loader: Loader,
		ViewRenderer: ViewRenderer,
		TouchManager: TouchManager,
		// Methods
		async: function async() {
			var tasks = Array.prototype.slice.call(arguments);
			var nextTask = function nextTask(result) {
				if (tasks.length) {
					var task = tasks.shift();
					task.args = task.args || [];
					if (task.f.name!=="nextTask") {
						if (result) {
							task.args.unshift(result);
						}
						task.args.push(nextTask);
					}

					var res = task.f.apply(this, task.args);
					// in case the task wasn't async, trigger next task immediately
					if (res!==undefined) {
						nextTask.apply(this, [res]);
					}
				}
			};
			nextTask();
		}
	};
}());
// App specific methods and classes
// Since it's tightly coupled with our implementation, we can approach it casually (yo, app, do stuff!)
window.Yo = (function() {
	// App: Main business logic of the news app
	var App = (function() {
		var _articles;
		var _currentArticleIndex;
		var _allowUI = true;

		var _prepareViews = function _prepareViews(data) {
			var views = [];
			data.items.forEach(function(item, index) {
				item.index = index;
				var view = {};
				view.title = Mr.ViewRenderer.renderView("title", item);
				view.content = Mr.ViewRenderer.renderView("content", item);
				views.push(view);
			});
			return views;
		};

		var _setCurrentArticle = function _setCurrentArticle(index) {
			_hideCurrentArticle();
			_currentArticleIndex = index;
			_showCurrentArticle();
		};

		var _showNextArticle = function _showNextArticle() {
			if (_currentArticleIndex<_articles.length -1) {
				_allowUI = false;
				_currentArticle().contentView.css({"left":"0"}).animate({"left": "-100%"}, 500);
				if (_prevArticle()) _prevArticle().contentView.hide();
				if (_nextArticle()) _nextArticle().contentView.show().css({"right":"100%"}).animate({"left": "0"}, 500, function() {
					_allowUI = true;
					_setCurrentArticle(_currentArticleIndex+1);
				});
				
			}
		};

		var _showPrevArticle = function _showPrevArticle() {
			if (_currentArticleIndex>0) {
				_allowUI = false;
				_currentArticle().contentView.show().css({"left": "0"}).animate({"left": "100%"}, 500);
				if (_nextArticle()) _nextArticle().contentView.hide();
				if (_prevArticle()) _prevArticle().contentView.show().css({"left":"-100%"}).animate({"left": "0"}, 500, function() {
					_allowUI = true;
					_setCurrentArticle(_currentArticleIndex-1);
				});
			}
		};

		var _currentArticle = function _currentArticle() {
			return _articles[_currentArticleIndex];
		};

		var _nextArticle = function _nextArticle() {
			return _articles[_currentArticleIndex+1];
		};

		var _prevArticle = function _prevArticle() {
			return _articles[_currentArticleIndex-1];
		};

		var _showCurrentArticle = function _showCurrentArticle() {
			if (_currentArticle()) {
				if (_prevArticle()) _prevArticle().contentView.css({"left": "-100%", "right": ""}).show();
				if (_nextArticle()) _nextArticle().contentView.css({"right": "100%", "left": ""}).show();
				_currentArticle().contentView.css({"left": "0", "right": "0"}).show();
				$("#item"+_currentArticleIndex).addClass("selected");
			}
			_articles[_currentArticleIndex+1].contentView.addClass("page-right");
		};

		var _hideCurrentArticle = function _hideCurrentArticle() {
			var article = _articles[_currentArticleIndex];
			if (article) {
				article.contentView.hide();
				$("#item"+_currentArticleIndex).removeClass("selected");
			}
		};

		var _showArticlesPage = function _showArticlesPage() {
			$(document).scrollTop(0);
			if (_prevArticle()) _prevArticle().contentView.hide();
			if (_nextArticle()) _nextArticle().contentView.hide();
			_currentArticle().contentView.css("left", "0").css("right", "0").show();
			$("#contentPage").show();
			$("#contentPage").animate({"left": "0"}, 500, function() {
				$("#titlesPage").hide();
			});
		};

		var _showTitlesPage = function _showTitlesPage() {
			if (_prevArticle()) _prevArticle().contentView.hide();
			if (_nextArticle()) _nextArticle().contentView.hide();
			_currentArticle().contentView.css("left", "0").css("right", "0").show();
			$("#titlesPage").show();
			$("#contentPage").animate({"left": "100%"}, 500, function() {
				$("#contentPage").hide();
			});
		};

		var _initControls = function _initControls() {
			$("#prevButton").click(function() {
				if (_allowUI)
					_showPrevArticle();
			});
			$("#nextButton").click(function() {
				if (_allowUI)
					_showNextArticle();
			});
			$(".titlesButton").click(function() {
				if (_allowUI)
					_showTitlesPage();
			});
			return null;
		};

		var _populateNews = function _populateNews(data) {
			_articles = _prepareViews(data);
			_articles.forEach(function(article, index) {
				article.titleView = $(article.title).appendTo($("#newsTitles"));
				article.contentView = $(article.content).appendTo($('#newsContent')).hide();
				article.titleView.click(function() {
					_hideCurrentArticle();
					_currentArticleIndex = index;
					_showCurrentArticle();
					_showArticlesPage();
				});
			});
			return null;
		};

		var _onSwipe = function _onSwipe(ev) {
			if (_allowUI && $("#contentPage").is(":visible")) {
				if (ev.deltaX>0) {
					_showNextArticle();
				} else {
					_showPrevArticle();
				}
			}
		};
		return {
			init: function init() {
				Mr.TouchManager.init();
				Mr.TouchManager.listen("swipe", _onSwipe);
				
				Mr.async(	{f:Mr.ViewRenderer.init},
							{f:Mr.Loader.getJSON, args:["data.json", null]},
							{f: _populateNews},
							{f: _initControls});
			}
		};
	}());

	return {
		// Classes
		App: App
		// Methods
	};
}());
