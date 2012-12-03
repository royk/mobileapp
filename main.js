window.W = (function() {

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
			get: function get(req, params, cb) {
				cb = cb || function(response) { console.log(response); };
				var onResponse = function onResponse(json) {
					var result = JSON.parse(json);
					cb(result);
				};
				_get(req, params, onResponse);
			}
		};
	}());

	var TemplateRepo = (function() {
		var _construct = function _construct(template, item) {
			var regexp;
			for (var attr in item) {
				regexp = new RegExp("{"+attr+"}", "g");
				template = template.replace(regexp, item[attr]);
			}
			return template;
		};
		return {
			titleView: function titleView(item) {
				var _template = "<h2 id='item{index}'>{title}</h2>";
				return _construct(_template, item);
			},
			contentView: function contentView(item) {
				var _template = "<div style='display:none;' id='content{index}'><h2>{title}</h2><p>{content}</p></div>";
				return _construct(_template, item);
			}
		};

	}());

	var App = (function() {
		var _data = null;
		var _loadData = function _loadData(dataURL, then) {
			then = then || function(){ return true; };
			W.Loader.get(dataURL, "", function(result) {
				_data = result;
				then.apply();
			});
		};
		var _populateNews = function _populateNews() {
			_data.items.forEach(function(item, index) {
				item.index = index;
				var title = W.TemplateRepo.titleView(item);
				var content = W.TemplateRepo.contentView(item);
				$(title).appendTo($("#newsRepeater")).click(function() {
					if ($('#content'+index).css('display')==="none") {
						$('#content'+index).fadeIn();
					} else {
						$('#content'+index).fadeOut();
					}
				});
				$(content).appendTo($('#item'+index));
			});
			
		};
		return {
			init: function init() {
				_loadData("data.json", 
					_populateNews
				);
			}
		};
	}());
	
	return {
		Loader: Loader,
		App: App,
		TemplateRepo: TemplateRepo
	};
}());
