// Container for agnostic methods and classes
// Since it's decoupled from our app, we have to ask it nicely for functionality (Mr.Loader, get json please!)
window.Mr = (function() {
	// Loader: Generic http requests class
	var Loader = (function() {
		
		return {
			getJSON: function get(req, params, cb) {
				$.getJSON(req, params, cb);
			},
			get: function get(req, params, cb) {
				$.get(req, params, cb);
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
			_currentArticleIndex = index<0 ? _articles.length -1 : index;
			_currentArticleIndex = index> _articles.length -1 ? 0 : index;
			_showCurrentArticle();
		};

		var _showCurrentArticle = function _showCurrentArticle() {
			var article = _articles[_currentArticleIndex];
			if (article) {
				article.contentView.show();
				$("#item"+_currentArticleIndex).addClass("selected");
			}
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
			$("#contentPage").show();
			$("#contentPage").animate({"left": "0"}, 500, function() {
				$("#titlesPage").hide();
			});
		};

		var _showTitlesPage = function _showTitlesPage() {
			$("#titlesPage").show();
			$("#contentPage").animate({"left": "100%"}, 500, function() {
				$("#contentPage").hide();
			});
		};

		var _initControls = function _initControls() {
			$("#prevButton").click(function() {
				_setCurrentArticle(_currentArticleIndex-1);
				
				
			});
			$("#nextButton").click(function() {
				_setCurrentArticle(_currentArticleIndex+1);
			});
			$("#titlesButton").click(function() {
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
		};
		return {
			init: function init() {
				_initControls();
				Mr.async(	{f:Mr.ViewRenderer.init},
							{f:Mr.Loader.getJSON, args:["data.json", null]},
							{f: _populateNews});
			}
		};
	}());

	return {
		// Classes
		App: App
		// Methods
	};
}());
