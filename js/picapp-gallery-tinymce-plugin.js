(function() {
tinymce.create('tinymce.plugins.PicappGallery', {
	getInfo : function() {
		return {
			longname : 'PicappGallery',
			author : 'Watershed Studio',
			authorurl : 'http://www.watershedstudio.com',
			infourl : 'http://www.watershedstudio.com',
			version : "1.0"
		};
	},

	init : function(ed, url) {
		var galleryId;
		ed.onBeforeSetContent.add(this._onBeforeSetContent);
		ed.onPostProcess.add(this._onPostProcess);
		ed.onMouseDown.add(function(ed, e) {
			if (e.target.className == 'picapp-gallery-select') {
				galleryId = e.target.id.replace('picapp-gallery-', '');	
				ed.plugins.PicappGallery.showButtons(e.target, galleryId, url);
			}
		});

		ed.onInit.add(function() {
			ed.dom.loadCSS(url + '/tinymce.css');
		});

		this._createButtons(galleryId, url);
	},
	
	showButtons : function(n) {
		var t = this, ed = tinyMCE.activeEditor, p1, p2, vp, DOM = tinymce.DOM, X, Y;

		if (ed.dom.getAttrib(n, 'class').indexOf('picapp-gallery-select') == -1)
			return;


		vp = ed.dom.getViewPort(ed.getWin());
		p1 = DOM.getPos(ed.getContentAreaContainer());
		p2 = ed.dom.getPos(n);

		X = Math.max(p2.x - vp.x, 0) + p1.x;
		Y = Math.max(p2.y - vp.y, 0) + p1.y;

		DOM.setStyles('_gallerybtns', {
			'top' : Y+5+'px',
			'left' : X+5+'px',
			'display' : 'block',
			'position' : 'absolute'
		});

		t.btnsTout = window.setTimeout( function(){ed.plugins.PicappGallery.hideButtons();}, 5000 );
	},

	_createButtons : function(galleryId, url) {
		var t = this, ed = tinyMCE.activeEditor, DOM = tinymce.DOM, _gallerybtns, _editgallery, _delgallery;

		DOM.remove('_gallerybtns');

		_gallerybtns = DOM.add(document.body, 'div', {
			id : '_gallerybtns',
			style : 'display:none;'
		});

		_editgallery = DOM.add('_gallerybtns', 'img', {
			src : url+'/img/edit1.png',
			id : '_editgallery',
			width : '24',
			height : '24',
			title : ed.getLang('wordpress.editgallery')
		});

		_editgallery.onmousedown = function(e) {
			var ed = tinyMCE.activeEditor, el = ed.selection.getNode();

			if ( ed.dom.getAttrib(el, 'class').indexOf('picapp-gallery-select') != -1 ) {
				galleryId = ed.dom.getAttrib(el, 'id').replace('picapp-gallery-', '');	
				PicAppAdminScript.editGallery(galleryId);
			}
		};

		_delgallery = DOM.add('_gallerybtns', 'img', {
			src : url+'/img/delete.png',
			id : '_delgallery',
			width : '24',
			height : '24',
			title : ed.getLang('wordpress.delgallery')
		});

		_delgallery.onmousedown = function(e) {
			var ed = tinyMCE.activeEditor, el = ed.selection.getNode();

			if ( ed.dom.getAttrib(el, 'class').indexOf('picapp-gallery-select') != -1 ) {
				ed.dom.remove(el);

				this.parentNode.style.display = 'none';
				ed.execCommand('mceRepaint');
				return false;
			}
		};
	},
	
	hideButtons : function() {
		if ( tinymce.DOM.isHidden('_gallerybtns') ) return;

		tinymce.DOM.hide('_gallerybtns');
		window.clearTimeout(this.btnsTout);
	},

	_onBeforeSetContent:function(ed, o) {
		o.content = PicAppAdminScript.getGallery(o.content);
	},

	_onPostProcess:function(ed, o) {
		if (o.get)
			o.content = PicAppAdminScript.getShortcode(o.content);
	}
}); 
tinymce.PluginManager.add('PicappGallery', tinymce.plugins.PicappGallery);
})();
