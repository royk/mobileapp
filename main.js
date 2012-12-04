// App agnostic methods and classes
// Since it's decoupled from our app, we have to ask it nicely for functionality (Mr.Loader, get json please!)
window.Mr = (function() {
	// Loader: Generic http requests class
	var Loader = (function() {
		var _get = function _get(url, params, cb) {
			params = params || "";
			var req = new XMLHttpRequest();
			req.onreadystatechange = function(){
				if (req.readyState==4 && req.status==200){
					cb(req.responseText);
				}
			};
			if (params) {
				url += "?" + params;
			}
			req.open("GET", url, true);
			req.send();
		};
		return {
			getJSON: function get(req, params, cb) {
				cb = cb || function(response) { console.log(response); };
				var onResponse = function onResponse(json) {
					var result = JSON.parse(json);
					cb(result);
				};
				_get(req, params, onResponse);
			},
			get: function get(req, params, cb) {
				_get(req, params, cb);
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

		var _populateNews = function _populateNews(data) {
			var views = _prepareViews(data);
			views.forEach(function(view, index) {
				$(view.title).appendTo($("#newsRepeater")).click(function() {
					if ($('#content'+index).css('display')==="none") {
						$('#content'+index).fadeIn();
					} else {
						$('#content'+index).fadeOut();
					}
				});
				$(view.content).appendTo($('#item'+index));
			});
		};
		return {
			init: function init() {
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
