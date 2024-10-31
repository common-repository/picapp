var PicAppAdminScript = (function(scope){
	/**
	 * Some common variables we'll use a lot
	 */
	var bodyEl, 
	cachedSearchResults = {},
	draggableData = {}, // the current object about to be or currently being dragged and the offset of the mouse position
	draggablesPositions = [], // the positions of draggables
	draggingSomething = 0, // -1: clicked and might drag in a bit, 0: not dragging, 1:dragging
	droppableOver = null, // the droppable we're over
	elementPositions = [],
	gInstruct,
	galleryPalette, 
	galleryPaletteWrap, 
	hoveringObj,
	imgCaching = document.createElement('div'),
	imagePreviewWrap = null,
	picAppSearchResultsThumbs, 
	placeholderObjAnimated,
	postBox,
	searchResultsSection,

	/**
	 * Helper methods
	 */

	/**
	 * Wrapper for getElementById
	 */
	$$$ = function(i) {
		return document.getElementById(i);
	},

	/**
	 * Wrapper for getElementsByTagName
	 * @param string tn The tagname to search for
	 * @param object Optional. The parent object under which to search for these tags.
	 * @param string callback Optional.  A callback function called on each tag object: if returned true, the object
	 * 	is included; otherwise, it's not.
	 * @return array The array of matched objects.
	 */
	$tn = function(tn, obj, callback) {
		var i, objs, returnedObjs = [];
		obj = obj || document;
		callback = callback || null;
		objs = obj.getElementsByTagName(tn);
		if ( ! callback )
			return objs;
		else {
			for ( i = 0; i <= objs.length; i += 1 ) {
				if ( objs[i] && callback(objs[i]) )
					returnedObjs[returnedObjs.length] = objs[i];
			}
			return returnedObjs;
		}
	},

	/**
 	 * Test whether the given property is a method of the object.
	 * @param object object The object for which we will determine the method.
	 * @param string property The property of the object which we're checking the existence of.
	 * @return bool Whether the object has that method.
	 */
	isHostMethod = function(object, property) {
		var t = typeof object[property];
		if (t != 'undefined') {
			return true;
		}
		try {
			if (object[property])
				return true;
		} catch (e) {
			return false
		};
	},
	debug = (function(scope) {
		if (isHostMethod(scope, 'console') && isHostMethod(console, 'log'))
			return function() { 
				console.log.apply(scope, arguments);
			};
		else
			return function(t) {};
	})(scope),

	d = debug,
	
	/** 
	 * Whether the property is of this particular object's
	 * @param obj The object whose property we're interested in.
	 * @param property The property which we're interested in.
	 * @return true if The property does not originate higher in the prototype chain.
	 */
	isObjProp = function(obj, property) {
		var p = obj.constructor.prototype[property];
		return ( 'undefined' == typeof p || property !== obj[p] );
	},

	/**
	 * Get the position of the object relative to the document
	 * @param obj The object in question
	 * @return array(x,y) The relative left and top position of the object.
	 */
	getElementPos = function(obj) {
		var curleft = 0,
		curtop = 0
		coords = [0, 0];
		if (obj && obj.offsetParent) {
			do {
				curleft += obj.offsetLeft;
				curtop += obj.offsetTop;
			} while (obj = obj.offsetParent);
			coords = [curleft,curtop];
		}
		return coords;
	},

	/**
	 * Get the object that was the target of an event
	 * @param object e The event object (or null for ie)
	 * @return object The target object.
	 */
	getEventTarget = function(e) {
		e = e || window.event;
		return e.target || e.srcElement;
	},

	/**
	 * Get the current draggable we're mousing over
	 * @param array currentObjPos The x,y position of the mouse relative to the document
	 * @param object currentObj The current object being dragged.
	 * @return mixed Draggable object we're mousing over, or null
	 */
	getMouseOvers = function(currentObjPos, currentObj) {
		var i,
		minX = currentObjPos[0],
		maxX = currentObjPos[0] + currentObj.offsetWidth,
		minY = currentObjPos[1],
		maxY = currentObjPos[1] + currentObj.offsetHeight;
		for ( i = 0; i < draggablesPositions.length; i++ ) {
			if ( 	minX < draggablesPositions[i].x &&
				maxX > draggablesPositions[i].x &&
				minY < draggablesPositions[i].y &&
				maxY > draggablesPositions[i].y ) {
					eventMouseOver(currentObj, null, draggablesPositions[i].obj);
					break;
			}
			
		}
	},

	/**
	 * Get the current mouse position
	 * @param obj e The event object
	 * @return Array ( x, y) position relative to the document.
	 */
	getMousePositionDocument = function(e) {
		e = e || window.event;
		if ( e.pageX || e.pageY ) {
			return [e.pageX, e.pageY];
		} else if ( e.clientX || e.clientY ) {
			return [e.clientX + document.documentElement.scrollLeft + document.body.scrollLeft,
				e.clientY + document.documentElement.scrollTop + document.body.scrollTop];
		}
	},

	/** 
	 * Get the current mouse position relative to the element on which the event is occuring.
	 * @param obj e The event object.
	 * @return Arry (x,y) position relative to the element.
	 */
	getMousePositionElement = function(e) {
		e = e || window.event;
		if ( e.layerX || e.layerY )
			return [e.layerX, e.layerY];
		else if ( e.offsetX || e.offsetY )
			return [e.offsetX, e.offsetY];
	},

	addEvent = function( obj, type, fn ) {
		if (obj.addEventListener)
			obj.addEventListener(type, fn, false);
		else if (obj.attachEvent)
			obj.attachEvent('on' + type, function() { return fn.call(obj, window.event);});
	},

	XHR = (function() { 
		var i, 
		fs = [
		function() { // for legacy eg. IE 5 
			return new scope.ActiveXObject("Microsoft.XMLHTTP"); 
		}, 
		function() { // for fully patched Win2k SP4 and up 
			return new scope.ActiveXObject("Msxml2.XMLHTTP.3.0"); 
		}, 
		function() { // IE 6 users that have updated their msxml dll files. 
			return new scope.ActiveXObject("Msxml2.XMLHTTP.6.0"); 
		}, 
		function() { // IE7, Safari, Mozilla, Opera, etc (NOTE: IE7 native version does not support overrideMimeType or local file requests)
			return new XMLHttpRequest();
		}]; 

		// Loop through the possible factories to try and find one that
		// can instantiate an XMLHttpRequest object that works.

		for ( i = fs.length; i--; ) { 
			try { 
				if ( fs[i]() ) { 
					return fs[i]; 
				} 
			} catch (e) {} 
		}
	})(),

	/**
	 * Get a localized text string, if applicable.
	 * @param text The text to localize
	 * @return The localized text string
	 */
	localize = function(text) {
		if ( picAppGallerySettings && picAppGallerySettings.l10n && picAppGallerySettings.l10n[text] )
			return picAppGallerySettings.l10n[text];
		else
			return text;
	},

	/**
	 * Post a xhr request
	 * @param url The url to which to post
	 * @data The associative array of data to post, or a string of already-encoded data
	 * @callback The method to call upon success
	 */
	postReq = function(url, data, callback) {
		url = url || scope.picAppGallerySettings.adminAjaxEndpoint;
		data = data || {};
		var dataString, request = new XHR;
		if ( 'object' !== typeof data ) {
			dataString = data + '&action=picapp_search_query&picapp-search-nonce=' + scope.picAppGallerySettings['picapp-search-nonce'];
		} else {
			data['picapp-search-nonce'] = scope.picAppGallerySettings['picapp-search-nonce'];
			data['action'] = data['action'] || 'picapp_search_query';
			dataString = serialize(data);
		}
		try {
			if ( 'undefined' == typeof callback ) {
				callback = function() {};
			}
			request.open('POST', url, true);
			request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			request.onreadystatechange = function() {
				if ( 4 == request.readyState ) {
					request.onreadystatechange = function() {};
					if ( 200 <= request.status && 300 > request.status || ( 'undefined' == typeof request.status ) )
						callback(request.responseText);
				}
			}
			request.send(dataString);
		} catch(e) {};
	},

	/**
	 * Serialize an associative array
	 * @param array a The associative array to serialize.
	 * @uses urlencode, isObjProp
	 * @return string The serialized string.
	 */
	serialize = function(a) {
		var i, s = [];
		for( i in a )
			if ( isObjProp(a, i) ) 
				s[s.length] = urlencode(i) + '=' + urlencode(a[i]);
		return s.join('&');
	},

	urlencode = (function() {
		var f = function(s) {
			return encodeURIComponent(s).replace(/%20/,'+').replace(/(.{0,3})(%0A)/g,
				function(m, a, b) {return a+(a=='%0D'?'':'%0D')+b;}).replace(/(%0D)(.{0,3})/g,
				function(m, a, b) {return a+(b=='%0A'?'':'%0A')+b;});
		};

		if (typeof encodeURIComponent != 'undefined' && String.prototype.replace && f('\n \r') == '%0D%0A+%0D%0A') {
			return f;
		}
	})(),

	/**
	 * end helper methods
	 */

	/**
	 * Admin build search box content
	 */


	/**
	 * Cache the thumbnail pages for the existing links, and also cache the next few
	 */
	cachePageLinks = function() {
		var i, links, dataRegex, footer = $$$('picapp-search-results-footer'), max, pageRegex, pages = [], toBeCached = {};
		if ( footer ) {
			links = $tn('a', footer);
			if ( links ) {
				for ( i = 0; i <= links.length; i++ ) {
					if ( links[i] && -1 != links[i].className.indexOf('gallery-page-nav-link') ) {
						pageRegex = /link-to-page-(\d*)/.exec(links[i].className);
						dataRegex = /\?(.*)$/.exec(links[i].getAttribute('href'));
						if ( dataRegex[1] && pageRegex[1] ) {
							toBeCached[parseInt(pageRegex[1], 10)] = dataRegex[1] + '&thumbs-only=1';
							pages[pages.length] = parseInt(pageRegex[1], 10);
						}
					}
				}
				max = Math.max.apply( Math, pages );

				// cache next 5 pages
				for( i = ( max + 1 ); i <= ( max + 5 ); i++ ) {
					toBeCached[i] = toBeCached[max].replace(/(picapp-search-results-page=)(\d*)/, '$1'+i);
				}

				// now build cache
				for( i in toBeCached )
					if ( isObjProp( toBeCached, i ) ) 
					(function(key) {
						if ( ! cachedSearchResults[key] ) {
							postReq(scope.picAppGallerySettings.adminAjaxEndpoint, key, function(r) { 
								// sanity check:
								if ( -1 != r.indexOf('picapp-search-results-wrap') ) {
									cachedSearchResults[key] = r;
									// get all the images as dom elements to cache the image links
									imgCaching.innerHTML = r;
									$tn('img', imgCaching);
								}
							});
						}
					})(toBeCached[i]);

			}
		}
	},

	/**
	 * Check whether an image object has loaded
	 **/
	isImgComplete = function(img) {
		return !( ! img.complete || ( typeof img.naturalWidth != "undefined" && img.naturalWidth == 0 ) );
	},

	/**
	 * Resize thumbs wrapper to "center" images, per PicApp request
	 * @param obj The object wrapper to center.
	 */
	centerThumbsWrap = function(obj) {
		if ( ! obj )
			return;
		obj.style.width = 'auto';
		var children = $tn('div', obj, function(o) {
			return !! ( o && o.className && -1 != o.className.indexOf('picapp-thumb-wrapper') );
		}),
		childOneCoords = [],
		childTwoCoords = [],
		curWidth = obj.offsetWidth,
		difference = 0,
		spaceBetween = 0;

		if ( children && 1 < children.length ) {
			// get the difference between the two positions of the first elements,
			// then subtract the offsetWidth of one element,
			// then divide by 2 to get the margin between them

			childOneCoords = getElementPos(children[0]);
			childTwoCoords = getElementPos(children[1]);

			spaceBetween = Math.abs( Math.abs( childTwoCoords[0] - childOneCoords[0] ) - children[0].offsetWidth );

			// get the 
			difference = curWidth % ( children[0].offsetWidth + spaceBetween );
		}
		obj.style.width = ( curWidth - difference ) + 'px';
	},

	/**
	 * Weed out incompletely-loaded images after a second try
	 * @param wrapper The parent object of the images
	 */
	pruneDeadImages = function(wrapper) {
		var i,
		images = [];
		images = $tn('img', wrapper);
		for ( i = 0; i < images.length; i++ ) {
			if ( ! isImgComplete(images[i]) ) {
				(function(img) {
					var i = new Image(),
					theSrc = img.src,
					theWrap;
					i.src = theSrc;
					setTimeout(function() {
						if ( ! isImgComplete(img) ) {
							theWrap = getDraggableObjectFromTarget(img);
							if ( theWrap && theWrap.parentNode ) {
								fade(theWrap,{callback:function(o) {
									o.parentNode.removeChild(o);
								}});
							}
						}
					}, 6000);  // let's wait 2 seconds to give a chance to download
				})(images[i]);
			}
		}
		setTimeout(function() {
			centerThumbsWrap(picAppSearchResultsThumbs);
		}, 6500);
	},

	/**
	 * Get the search markup and add it to the appropriate element
	 * @param query The associative array of query data.
	 */
	setupSearchArea = function(query) {
		query = query || {};

		var postIdInput = $$$('post_ID'),
		submitCallback = function(resp) {
			// append the response to 
			if (postBox && resp) {
				var wrapper = document.createElement('div');

				wrapper.innerHTML = resp;

				pruneDeadImages(wrapper);

				postBox.className = postBox.className.replace(/processing/g, '');
				fade(postBox,{
					from:100,
					to:0
				});
				postBox.appendChild(wrapper);
				fade(postBox,{
					from:0,
					to:100
				});

				setupPostBoxListeners();

				if ( 'undefined' != typeof galleryPalette && galleryPalette ) {
					galleryPaletteRequest(query['post-id']);
				}
			}
		};

		query['post-id'] = postIdInput && postIdInput.value ?
			postIdInput.value : 0;

		postBox.className = postBox.className + ' processing';
		postReq(scope.picAppGallerySettings.adminAjaxEndpoint, query, submitCallback);
	},

	/**
	 * Insert the shortcode into the post
	 */
	insertCode = function(code) {
		try {
			edInsertContent(edCanvas, code);
			return true;
		} catch(e) {
			try {
				code = PicAppAdminScript.getGallery(code);
				tinyMCE.execCommand('mceInsertContent', false, code);
				return true;
			} catch(e) {
				return false;
			}
		}
	},

	/**
	 * Retrieve results data from a page link, either from the cache or by request.
	 * Uses a callback function to replace the current results content with the next page's worth.
	 * @param linkObj The link object
	 * @callback The callback function for handling search responses.
	 * link-to-page-2
	 */
	searchResultsGetByPageLink = function(linkObj, callback) {
		callback = callback || function(r, key) {
			if ( ! searchResultsSection ) 
				searchResultsSection = $$$('picapp-search-results');
			if ( searchResultsSection && '' != r ) {
				searchResultsSection.innerHTML = r;
				pruneDeadImages(searchResultsSection);
				setupPostBoxListeners();
			}
		};
		var data = {}, page = 1, postIdInput = $$$('post_ID');
		if ( postIdInput && postIdInput.value )
			data['post-id'] = postIdInput.value;
		if ( linkObj ) {
			page = /link-to-page-(\d*)/.exec(linkObj.className);
			page = page[1] ? page[1] : 1;
			data = /\?(.*)$/.exec(linkObj.getAttribute('href'));
			data = data[1] ? data[1] : '';
			data += '&thumbs-only=1';
			if ( cachedSearchResults[data] ) {
				callback(cachedSearchResults[data], data);
			} else {
				(function(key) {
					postReq(scope.picAppGallerySettings.adminAjaxEndpoint, key, function(r) { 
						// sanity check:
						if ( -1 != r.indexOf('picapp-search-results-wrap') ) {
							cachedSearchResults[key] = r;
							callback(r, key);
						}
					});
				})(data);
			}
		}
	},

	/**
	 * Submit the search form and post the results
	 */
	searchResultsGetFromForm = function() {
		var data = {},
		creative = $$$('picapp-search-type-creative'),
		key,
		postIdInput = $$$('post_ID'),
		term = $$$('picapp-search-key-term'),
		wrap = $$$('picapp-search-results-wrap');

		if ( ! wrap )
			return;
	
		data = {
			'action':'picapp_search_query',
			'picapp-search-key-cats':( creative && creative.checked ? 'Creative' : 'Editorial' ),
			'picapp-search-key-term':( term && term.value ? term.value : '*' ),
			'picapp-search-nonce':scope.picAppGallerySettings['picapp-search-nonce'],
			'post-id':postIdInput.value,
			'thumbs-only':1
		};

		key = serialize(data);

		wrap.innerHTML = '';
		wrap.className += ' processing';

		postReq(scope.picAppGallerySettings.adminAjaxEndpoint, data, function(r) { 
			// sanity check:
			if ( -1 != r.indexOf('picapp-search-results-wrap') ) {
				cachedSearchResults[key] = r;
				if ( ! searchResultsSection ) 
					searchResultsSection = $$$('picapp-search-results');
				if ( searchResultsSection && '' != r ) {
					searchResultsSection.innerHTML = r;
					setupPostBoxListeners();
				}
			}
		});
		return true;
	},

	setupPostBox = function() {
		// un-hide it
		bodyEl = $tn('body')[0];
		if ( bodyEl )
			bodyEl.className = bodyEl.className + ' picapp-js-enabled';

		// create a phantom thumbnail, as a placeholder for drop areas
		placeholderObjAnimated = (function() {
			var ph, 
			placeholderObj = document.createElement('div');
			placeholderObj.id = 'placeholder-object';
			placeholderObj.className = 'picapp-thumb-wrapper';
			
			ph = new ObjectAnimation(placeholderObj);
		
			placeholderObj.onmouseover = function(e) {
				ph.setStatus('active');
			};
			
			/**
			 * Determine whether the placeholder's parent is obj
			 * @obj The object to test
			 * @return bool Whether the obj is placeholder's parent
			 */
			ph.parentIs = function(obj) {
				return !! ( obj && placeholderObj.parentNode && placeholderObj.parentNode == obj );
			};

			/**
			 * Place the placeholder as a child of obj
			 * @param object obj The object under which to place placeholder
			 */
			ph.putIn = function(obj) {
				if ( obj ) {
					obj.appendChild(placeholderObj);
					ph.setStatus('active');
				}
			};

			/**
			 * Place the placeholder before obj
			 * @param object obj The object to place next to
			 */
			ph.putNextTo = function(obj) {
				if ( obj && obj.parentNode ) {
					ph.hide();
					obj.parentNode.insertBefore(placeholderObj, obj);
					ph.setStatus('active');
				}
			};

			return ph;
		})();

		/**
		 *  create an image preview section
		 */

		imagePreviewWrap = (function(bodyEl) {
			var imagePreview = document.createElement('div'),
			imageHolder = document.createElement('div'),
			ipw,
			titleHolder = document.createElement('h2'),
			descHolder = document.createElement('div'),
			updateContent = function(obj, content) {
				obj.innerHTML = '';
				if ( 'string' == typeof content )
					obj.innerHTML = content;
				else
					obj.appendChild(content);
			};

			imagePreview.id = 'image-preview-module';
			imagePreview.style.display = 'none';
			imagePreview.style.position = 'absolute';

			imageHolder.id = 'image-preview-module-image-wrap';
			titleHolder.id = 'image-preview-module-title';
			descHolder.id = 'image-preview-module-desc';

			imagePreview.appendChild(imageHolder);
			imagePreview.appendChild(titleHolder);
			imagePreview.appendChild(descHolder);

			bodyEl.appendChild(imagePreview);

			ipw = new ObjectAnimation(imagePreview);

			ipw.image = function(c) {
				return updateContent(imageHolder, c);
			};
			ipw.title = function(c) {
				return updateContent(titleHolder, c);
			}
			ipw.desc = function(c) {
				if ( '' == c )
					descHolder.className = 'processing';
				else
					descHolder.className = '';
				return updateContent(descHolder, c);
			}

			return ipw;
		})(bodyEl);

		/**
		 * end image preview section creation
		 */

		postBox = $$$('picapp-postbox-wrap');
		if ( postBox ) { // get the initial search box
			searchLinkListener(postBox);

			searchResultsSection = $$$('picapp-search-results');
		
			postBox.className = postBox.className + ' processing';
			setupSearchArea();
		}
	},

	/**
	 * Attach listeners to things in the postbox
	 */
	setupPostBoxListeners = function() {
		var gPW = !! readCookie('picappPaletteStatus'),
		resThumbsPos;

		galleryPalette = $$$('gallery-palette');
		galleryPaletteWrap = new ObjectAnimation($$$('picapp-gallery-palette'));
		if ( true == galleryPaletteWrap.objExists ) {
			galleryPaletteWrap.setStatus(gPW ? 'active' : 'inactive');
			galleryPaletteWrap.render();
		}

		if ( galleryPalette )
			eventAdjustGallery();
		picAppSearchResultsThumbs = $$$('picapp-search-results-thumbs');
		if ( picAppSearchResultsThumbs ) {
			resThumbsPos = getElementPos(picAppSearchResultsThumbs);
			elementPositions['picapp-search-results-thumbs'] = [resThumbsPos[0], resThumbsPos[1], resThumbsPos[0] + picAppSearchResultsThumbs.offsetWidth, resThumbsPos[1] + picAppSearchResultsThumbs.offsetHeight];
		}

		cachePageLinks();
	},

	/**
	 * end admin build search box content
	 *
	 */

	/**
	 * admin build gallery content
	 */

	galleryDelete = function() {
		if ( ! galleryPalette )
			return;
		var i, last, thumbs = $tn('div', galleryPalette);
		for( i = 0; i <= thumbs.length; i++ ) {
			last = ( i + 1 ) >= thumbs.length ? true : false;	
			(function(thumb, isLast) {
				if ( thumb ) {
					fade(thumb,{
						from:100,
						to:0,
						callback:function(obj){
							if ( obj ) {
								galleryPalette.removeChild(obj); 
								if ( isLast ) {
									// save the gallery and adjust the size once the last item is deleted
									gallerySave();
									eventAdjustGallery();
								}
							}
						}
					});
				}
			})(thumbs[i], last);
		}
	},

	/**
	 * Get gallery image from the current image draggable object
	 * @param imgWrap The image draggable object
	 * @return object Image data.
	 */
	galleryGetCurrentImageData = function(imgWrap) {
		var data = {}, dimens, divs, imgs, links;
		if ( imgWrap ) {
			links = $tn('a', imgWrap, function(o) {
				return !! ( o.className && -1 != o.className.indexOf('picapp-thumb-link') );
			});
			if ( links[0] ) {
				data.datum_id = links[0].id ? links[0].id.replace(/(\d*-)?picapp-thumb-link-/, '') : '';
				data.full = links[0].getAttribute('rel') || '';

				imgs = $tn('img', links[0]);
				if ( imgs[0] ) {
					data.thumb = imgs[0].src || '';
					
					dimens = /h-(\d+) th-(\d+) w-(\d+) tw-(\d+)/.exec(imgs[0].className);
					data.height = dimens[1];
					data.thumbheight = dimens[2];
					data.thumbwidth = dimens[4];
					data.title = imgs[0].getAttribute('title');
					data.width = dimens[3];
				}

			}
			divs = $tn('div', imgWrap, function(o) {
				return !! ( o.className && -1 != o.className.indexOf('picapp-thumb-description') );
			});

			data.desc = divs[0] ? divs[0].innerHTML : '';
		}
		return data;
	},

	/**
	 * Get image data for the current gallery palette items.
	 * @return Assoc. array of the image data items.
	 */
	galleryGetCurrentImages = function() {
		if ( ! galleryPalette )
			return;
		var i, datum, returnData = {},
		divs = $tn('div', galleryPalette, function(obj) {
			return !! obj && obj.className && -1 != obj.className.indexOf('picapp-thumb-wrapper') && 'placeholder-object' != obj.id;
		});
		for( i = 0; i <= divs.length; i++ ) {
			datum = galleryGetCurrentImageData(divs[i]);
			if ( datum && datum.datum_id ) {
				returnData['status'] = 'active';
				returnData['galleryData[' + datum.datum_id + '][desc]'] = datum.desc;
				returnData['galleryData[' + datum.datum_id + '][full]'] = datum.full;
				returnData['galleryData[' + datum.datum_id + '][height]'] = datum.height;
				returnData['galleryData[' + datum.datum_id + '][order]'] = i;
				returnData['galleryData[' + datum.datum_id + '][thumb]'] = datum.thumb;
				returnData['galleryData[' + datum.datum_id + '][thumbheight]'] = datum.thumbheight;
				returnData['galleryData[' + datum.datum_id + '][thumbwidth]'] = datum.thumbwidth;
				returnData['galleryData[' + datum.datum_id + '][title]'] = datum.title;
				returnData['galleryData[' + datum.datum_id + '][width]'] = datum.width;
			}
		}
		return returnData;
	},

	/**
	 * Gets the display rows selection
	 *
	 * @return The number of rows the gallery should have
	 */
	galleryGetDisplayRows = function() {
		var colInput = $$$('gallery-display-rows');
		if ( colInput && colInput.value )
			return colInput.value;
		else
			return null;
	},

	/**
	 * Gets the display option selection: thumbs, top, bottom
	 * 
	 * @return string The display option selection
	 */
	galleryGetDisplayOption = function() {
		var i, b, options = {
			'gallery-display-thumbs':'thumbs',
			'gallery-display-top':'top',
			'gallery-display-bottom':'bottom'
		};
		for ( i in options ) {
			if ( 'string' != typeof i )
				continue;
			b = $$$(i);
			if ( b && b.checked )
				return options[i];
		}
		return null;
	},

	/**
	 * Gets the user-created gallery title
	 *
	 * @return string The title for the gallery
	 */
	galleryGetTitle = function() {
		var title = $$$('gallery-title');
		if ( title && title.value )
			return title.value;
		else
			return '';
	},

	/**
	 * Insert the gallery shortcode into the current post.
	 * @param galleryId The id of the gallery to insert into the post
	 */
	galleryInsert = function(galleryId) {
		insertCode('[picappgallery id="' + galleryId + '"]');
	},

	/**
	 * Insert the shortcode for a gallery single item
	 * @param imageId The id of the image to insert into the post
	 */
	galleryInsertSingle = function(imageId) {
		insertCode('[picappgallerysingle id="' + imageId + '"]');
	},

	/**
	 * Show a message above the search section, having to do with the gallery
	 * @param t The text of the message
	 */
	galleryMessage = function(t) {
		var msgBox = $$$('search-response-message');
		msgBox.innerHTML = t;
		msgBox.style.display = 'block';

		/* fade message "image embedded" in and out */
		fade(msgBox, {
			from:0,to:100,callback:function(o) {
				setTimeout(function() {
					fade(o, {from:100,to:0,callback:function(o) {
						o.style.display = 'none';
					}});

				}, 1000);
			}
		});
	},

	/**
	 * Request the html of the gallery palette
	 * 	and insert it in the appropriate place
	 */
	galleryPaletteRequest = function(postID, galleryID) {
		var query = {
			'action':'picapp_gallery_palette',
			'gallery-id':galleryID,
			'post-id':postID
		};
		postReq(scope.picAppGallerySettings.adminAjaxEndpoint,query,
			function(resp){
				var select,
				wrap = $$$('picapp-gallery-palette');
				// sanity check
				if ( resp && -1 != resp.indexOf('gallery-section') ) {
					wrap.innerHTML = resp;	
					select = $$$('picapp-post-gallery-select'),
					select.onchange = function(e) {
						var temp = galleryPalette.parentNode;
						temp.innerHTML = '';
						temp.className = 'processing';
						galleryPaletteRequest(postID, select.value);	
					}
					gInstruct = new ObjectAnimation($$$('gallery-palette-instructions'));
					setupPostBoxListeners();
				}
			});

	},

	/**
	 * Save the gallery data
	 * @param function callback The function to call when the server responds asyncronously to the save post.
	 * 	The callback's first argument will receive the response string.
	 */
	gallerySave = function(callback) {
		callback = 'function' != typeof callback ? function() { } : callback;
		var data = galleryGetCurrentImages(), 
		postIdInput = $$$('post_ID'),
		galleryIdInput = $$$('picapp-post-gallery-select');

		if ( 'active' != data.status ) {
			galleryMessage(localize('No images were selected for the gallery'));
			return false;
		}

		if ( postIdInput && postIdInput.value )
			data['post-id'] = postIdInput.value;
		if ( galleryIdInput && galleryIdInput.value )
			data['gallery-id'] = galleryIdInput.value;

		data['display-rows'] = galleryGetDisplayRows();
		data['display-option'] = galleryGetDisplayOption();
		data['gallery-title'] = galleryGetTitle();
		data['action'] = 'picapp_save_gallery';
		postReq(scope.picAppGallerySettings.adminAjaxEndpoint, data, callback);
		return true;
	},
	
	/**
	 * End gallery content
	 */


	/*****
	 * Event listeners and handlers
	 */
	eventAdjustGallery = function(show) {
		// calc its pos, so we'll know when we're over it
		var galPos = getElementPos(galleryPalette),
		thumbs = $tn('div', galleryPalette, function(obj) {
			return !! obj && obj.className && -1 != obj.className.indexOf('picapp-thumb-wrapper') && 'placeholder-object' != obj.id;
		});
		if ( galPos )
			elementPositions['gallery-palette'] = [galPos[0], galPos[1], galPos[0] + galleryPalette.offsetWidth, galPos[1] + galleryPalette.offsetHeight];

		// if it's empty of thumbnails, show the instructions.  otherwise, don't
		if ( 0 < thumbs.length ) {
			gInstruct.setStatus('inactive');
		} else {
			gInstruct.setStatus('active');
		}
		// delay status change so stuff doesn't jump around
		setTimeout(function() { 
			gInstruct.render();
		}, 1000); 
	},

	eventClickGalleryCancel = function(toggle, e) {
		galleryPaletteWrap.setStatus('inactive');
		galleryPaletteWrap.render();
		createCookie('picappPaletteStatus', '', 0);
		return false;
	},

	eventClickGalleryClear = function(toggle, e) {
		if ( confirm(localize('Are you sure that you want to delete all images from this gallery?')) )
			galleryDelete();
		return false;
	},

	eventClickGalleryDisplayBottom = function(toggle, e) {
	},

	eventClickGalleryDisplayThumbs = function(toggle, e) {
	},

	eventClickGalleryDisplayTop = function(toggle, e) {
	},

	eventClickGalleryEmbed = function(toggle, e) {
		var embedButton = $$$('gallery-embed'),
		embedText = embedButton.innerHTML,
		savedTitle = galleryGetTitle();

		if ( gallerySave(function(galleryId) {
			// request a new gallery palette
			var postIdInput = $$$('post_ID'), 
			postId = postIdInput && postIdInput.value ? postIdInput.value : 0;
			
			galleryInsert(galleryId);
			embedButton.innerHTML = embedText;			
			embedButton.removeAttribute('disabled');
			galleryPaletteRequest(postId, galleryId);

			galleryMessage(localize('Gallery Embedded'));

			// update picAppGallerySettings
			if ( ! picAppGallerySettings['gallery-data'] )
				picAppGallerySettings['gallery-data'] = {};

			if ( ! picAppGallerySettings['gallery-data'][galleryId] ) {
				picAppGallerySettings['gallery-data'][galleryId] = {
					title:savedTitle,
					height:300, //fake some dimensions
					width:300
				};
			}
		}) ) {
			embedButton.innerHTML = localize('Saving...');
			embedButton.setAttribute('disabled','disabled');
		}
		return false;
	},

	eventClickGalleryPageNavLink = function(toggle, e) {
		var target = getEventTarget(e);
		if ( target )
			searchResultsGetByPageLink(target);
		return false;
	},

	eventClickGalleryPreview = function(toggle, e) {
		gallerySave(function(respFromServer) {
			var select = $$$('picapp-post-gallery-select'),
			galleryId = parseInt(select.value, 10) || parseInt(respFromServer),
			url = picAppGallerySettings.homeURL;
			if ( 0 < galleryId ) {
				if ( picAppShowBox ) {
					picAppShowBox('<iframe src="' + url + '?picapp-gallery-id=' + galleryId + '&picapp-search-nonce=' + picAppGallerySettings['picapp-search-nonce'] + '" width="800" height="1020" frameborder="0"></iframe>', 0, 0, 0, 1);
				} else if ( tb_show ) {
					tb_show('', url + '?picapp-gallery-id=' + galleryId + '&picapp-search-nonce=' + picAppGallerySettings['picapp-search-nonce']);	
				}
			} else {
				alert(localize('No images were selected for the gallery'));
			}
		});
		return false;
	},

	eventClickGalleryToggle = function(toggle, e) {
		if ( galleryPaletteWrap ) {
			galleryPaletteWrap.setStatus('active');
			galleryPaletteWrap.render();
			createCookie('picappPaletteStatus', 1, 0);
			
			eventAdjustGallery(true);
		}
		return false;
	},

	/**
	 * Callback for the click event on a thumbnail remove "X" link
	 * Removes the thumbnail wrapper from its parent, the gallery palette.
	 * @param obj toggle The thumbnail image object
	 */
	eventClickRemoveLink = function(toggle, e) {
		var wrap = toggle && toggle.parentNode ? toggle.parentNode : null;
		if ( wrap && wrap.className && -1 != wrap.className.indexOf('picapp-thumb-wrapper') ) {
			fade(wrap, {time:600, callback:function(o) {
				o.parentNode.removeChild(o);	
			}});
		}
		return false;
	},

	/**
	 * Callback for the click event on a search results thumbnail
	 * @param obj toggle The thumbnail image object
	 * @param e The event object, normalized.
	 */
	eventClickResultsThumbImage = function(toggle, e) {
		// let's simulate bubbling up to the wrapper, as that's what we usually care about
		return eventClickResultsThumbWrapper(toggle, e);
	},

	/**
	 * Callback for the click event on a search results thumbnail link
	 * @param obj toggle The thumbnail image link object
	 * @param e The event object, normalized.
	 */
	eventClickResultsThumbLink = function(toggle, e) {
		// let's simulate bubbling up to the wrapper, as that's what we usually care about
		return eventClickResultsThumbWrapper(toggle, e);
	},

	/**
	 * Callback for the click event on a search results thumbnail link wrapper
	 * @param obj toggle The thumbnail image link object
	 * @param e The event object, normalized.
	 */
	eventClickResultsThumbWrapper = function(toggle, e) {
		// we're clicking and quickly releasing on a thumbnail in the gallery palette area
		if ( true == galleryPaletteWrap.objExists &&
			'active' == galleryPaletteWrap.getStatus() && 
			toggle && toggle.parentNode && 
			toggle.parentNode == galleryPalette ) {

			// if toggle has class 'thumb-wrapper-edit-mode' then remove the class; otherwise add it
			if ( -1 != toggle.className.indexOf('thumb-wrapper-edit-mode') ) 
				toggle.className = toggle.className.replace(' thumb-wrapper-edit-mode', '');
			else
				toggle.className += ' thumb-wrapper-edit-mode';
		} else if ( false == galleryPaletteWrap.objExists ||
			'inactive' == galleryPaletteWrap.getStatus() ) {
			/* if we're clicking on a thumbnail when the gallery is closed,
			 * then we need to insert it as a single-image shortcode into 
			 * the post 
			 */
			var postIdInput = $$$('post_ID'),
			imageLinks = $tn('a', getDraggableObjectFromTarget(getEventTarget(e)), function(o) {
				return !! ( o.className && -1 != o.className.indexOf('picapp-thumb-link') );
			}), 
			imageId = imageLinks[0] && imageLinks[0].id ? imageLinks[0].id.replace('picapp-thumb-link-', '') : 0,
			query = {
				'action':'picapp_script_query',
				'picapp-image-id':imageId,
				'post-id':( postIdInput && postIdInput.value ? postIdInput.value : 0 )
			},
			term = $$$('picapp-search-key-term');
			if ( term && term.value )
				query['search-term'] = term.value;

			postReq(scope.picAppGallerySettings.adminAjaxEndpoint,query,
				function(resp){
					if ( 1 == resp ) {
						galleryInsertSingle(imageId);
						galleryMessage(localize('Image Embedded'));
					}
				}
			);
		}
		return false;
	},

	/** 
	 * Event fired when mousing up on a droppable element
	 *
	 * @param droppable The droppable element object
	 * @param e The mouse up event, normalized.
	 */
	eventDroppableMouseUp = function(droppable, draggable, e) {
		// make sure we're actually dragging
		if ( 1 == draggingSomething ) {
			draggingSomething = 0;

		//	var draggable = getDraggableObjectFromTarget(getEventTarget(e)) || null;

			if ( draggable ) {
				// if we're mousing up but not over a droppable, we will assume the user meant to drop over the gallery
				// The only legit alternative is to mouse up over the search area, which is a droppable
				if ( ! droppable ) {
					droppable = galleryPalette;
				}
				
				// PicApp doesn't want search results to be draggable, so drop only in gallery
				if ( galleryPalette == droppable ) {
					droppable.appendChild(draggable);
					// insert between appropos children
					if ( placeholderObjAnimated.parentIs(droppable) )
						droppable.replaceChild(draggable, placeholderObjAnimated.get());	
					draggable.style.position = 'relative';
					draggable.style.top = draggable.style.left = 'auto';
				} else {
					draggable.parentNode.removeChild(draggable);
				}
			}
			placeholderObjAnimated.setStatus('inactive');
			placeholderObjAnimated.render();
		
			eventAdjustGallery();
			return false;
		}
	},

	/**
	 * Trigger a "hover" event.  Called after a non-dragging mouseover over an object (usually a thumbnail wrapper) 
	 * 	followed by a delay to confirm the hover.
	 * @param hoveredObject The obj originally hovered over, checked against the global hoveringObj, the current hovered object.
	 * @param object e The event object.
	 * @param array pos The coordinates of the mouse relative to the document.
	 */
	eventMouseHover = function(hoveredObject, e, pos) {
		// if we're not dragging and it's the same hovered object, then 
		if ( ! draggingSomething && hoveringObj == hoveredObject ) {
			var desc,
			divs = $tn('div', hoveredObject, function(o) {
				return !! ( o.className && -1 != o.className.indexOf('picapp-thumb-description') );
			}),
			objImgs = $tn('img', hoveredObject),
			thumbImg = new Image(),
			title,
			wrap = imagePreviewWrap.get();
			
			desc = divs[0] ? divs[0].innerHTML : '';
			thumbImg.src = objImgs[0] && objImgs[0].src ? objImgs[0].src : '';
			title = objImgs[0] && objImgs[0].title ? objImgs[0].title : '';

			imagePreviewWrap.image(thumbImg);
			imagePreviewWrap.title(title);
			imagePreviewWrap.desc(desc);

			// 30 pixels northwest of the mouse
			wrap.style.left = ( pos[0] - 0 ) + 'px';
			wrap.style.top = ( pos[1] - 30 ) + 'px';

			imagePreviewWrap.show();
			
			wrap.onmouseout = function(e) {
				e = e || window.event;
				var toObj = e.relatedTarget || e.toElement;
				while ( toObj && wrap != toObj && bodyEl != toObj && 'undefined' != typeof toObj.parentNode )
					toObj = toObj.parentNode;

				// we're actually moving out of the area, not just into a child element
				if ( toObj != wrap ) {
					imagePreviewWrap.hide();
					delayHoverEvent(hoveredObject);
				}
			}
		}
	},

	eventKeydown = function(toggle, e) {
		if ( 13 == e.keyCode ) {
			searchResultsGetFromForm();
			return false;
		}
	},

	eventMouseDown = function(toggle, e) {
		var target = getEventTarget(e),
		downObj = target;

		// if we're clicking over anything other than the preview wrap, make it disappear
		if ( imagePreviewWrap.getVisibility() ) {
			downObj = target;
			while ( imagePreviewWrap.get() != downObj && bodyEl != downObj && downObj.parentNode )
				downObj = downObj.parentNode;
			if ( downObj != imagePreviewWrap.get() ) {
				imagePreviewWrap.hide();
				delayHoverEvent(downObj);
			}
		}
		
		// we can start a drag only when the palette is active, and
		// we care just about .picapp-thumb-wrapper and its children
		if ( true == galleryPaletteWrap.objExists && 
			'active' == galleryPaletteWrap.getStatus() &&
			getDraggableObjectFromTarget(target) ) {
			
			// wait a bit before starting the drag--we might just be "clicking"
			draggingSomething = -1;
			(function(target, evt) {
				/**
				 * We have to get the mouse position now for the sake of IE
				 * which will otherwise lose the evt.clientX/Y properties
				 * during the timeout
				 */
				var mouseDoc = getMousePositionDocument(evt),
				mouseEl = getMousePositionElement(evt);
				setTimeout( function() {
					dragStart(target, evt, mouseDoc, mouseEl);
				}, 400 );
			})(target, e);
			if ( e.preventDefault )
				e.preventDefault();
			if ( e.stopPropagation )
				e.stopPropagation()
			e.cancelBubble = true;
			e.returnValue = false;
			return false;
		}
	},

	eventMouseMove = function(e) {
		if ( draggableData && draggableData.obj ) {
			dragging(draggableData.obj, e, draggableData.offset);
		}
	},

	eventMouseOut = function(toggle, e) {
		var destination,
		droppable,
		related,
		relatedDraggable,
		target;

		if ( ! draggingSomething )
			return true;
		target = getEventTarget(e);
		if ( ! target ) 
			return true;

		related = e.relatedTarget || e.toElement;
		relatedDraggable = getDraggableObjectFromTarget(related);

		// if we're mousing out of a droppable area, call relevant methods
		destination = getDroppableObjectFromTarget(related, [galleryPalette, picAppSearchResultsThumbs]);
		droppable = getDroppableObjectFromTarget(target, [galleryPalette, picAppSearchResultsThumbs]);
		// don't consider when mousing out onto the same droppable or the current draggable
		if ( 	droppable && ( destination !== droppable ) && 
			( ! relatedDraggable || ( relatedDraggable && draggableData.obj && relatedDraggable !== draggableData.obj ) ) ) {
			if ( galleryPalette == droppable )
				return eventMouseOutGalleryPalette(e);
			else if ( picAppSearchResultsThumbs == droppable )
				return eventMouseOutPicAppSearchResultsThumbs(e);
		}
	},

	eventMouseOutGalleryPalette = function(e) {
		eventAdjustGallery();
		droppableOver = galleryPalette;
		// placeholderObjAnimated.setStatus('inactive');
		// placeholderObjAnimated.render();
		return true;
	},

	eventMouseOutPicAppSearchResultsThumbs = function(e) {
		droppableOver = galleryPalette;
		// droppableOver = picAppSearchResultsThumbs;
		// placeholderObjAnimated.setStatus('inactive');
		// placeholderObjAnimated.render();
		return true;
	},

	eventMouseOver = function(toggle, e, target) {
		var cancelHover,
		draggableTarget = target ? true : false,
		droppable,
		j,
		overThumbObj,
		possibleObjects = [];
		target = target || getEventTarget(e);
		if ( ! target ) 
			return;

		if ( draggingSomething ) {
			droppable = getDroppableObjectFromTarget(target, [galleryPalette, picAppSearchResultsThumbs]);
			overThumbObj = target.className && -1 != target.className.indexOf('picapp-thumb-wrapper') ?
				target :
				null;

			// show the placeholder among draggables if over them, otherwise in empty droppable if over that
			// if ( overThumbObj ) {
			if ( overThumbObj && galleryPalette == overThumbObj.parentNode ) {
				placeholderObjAnimated.putNextTo(overThumbObj);
			} else if ( ! draggableTarget ) {
				// placeholderObjAnimated.putIn(droppable);
				// PicApp wants only the gallery to be droppable
				placeholderObjAnimated.putIn(galleryPalette);
			}

			
			if ( droppable ) {
				if ( droppable == galleryPalette ) {
					eventMouseOverGalleryPalette(e);
				} else if ( droppable == picAppSearchResultsThumbs ) {
					eventMouseOverPicAppSearchResultsThumbs(e);
				}
			}
			placeholderObjAnimated.render();

		// not dragging something---looking for hover over thumbnail
		} else {
			overThumbObj = getDraggableObjectFromTarget(target);	
			// don't show the larger image upon hover, if we're in the gallery
			if ( overThumbObj && galleryPalette != overThumbObj.parentNode ) {
				hoveringObj = overThumbObj;
				
				// wait a second or so and then see if we're still hovering
				(function(overThumbObj, evt) {
					// must get moust coordinates here for the sake of IE
					var pos = getMousePositionDocument(evt);
					overThumbObj.hoverTime = overThumbObj.hoverTime || 600;
					setTimeout(function() {
						eventMouseHover(overThumbObj, evt, pos);	
					}, overThumbObj.hoverTime);
				})(overThumbObj, e);

				// cancel hover on mousedown (we're clicking to drag)
				cancelHover = function(e) {
					e = e || window.event;
					hoveringObj = null;
					return eventMouseDown(null, e);
				};
				possibleObjects = [toggle, target, hoveringObj];

				for ( j = 0; j < possibleObjects.length; j++ ) {
					if ( possibleObjects[j] ) {
						possibleObjects[j].onmousedown = cancelHover;		
					}
				}

				// cancel hover on mouse out
				toggle.onmouseout = target.onmouseout = hoveringObj.onmouseout = function(e) {
					e = e || window.event;
					hoveringObj = null;
					return eventMouseOut(null, e);
				};
			}
		}
	},

	eventMouseOverGalleryPalette = function(e) {
		gInstruct.setStatus('inactive');
		gInstruct.render();
		droppableOver = galleryPalette;
	},

	eventMouseOverPicAppSearchResultsThumbs = function(e) {
		// even though it's not technically correct, we're going to say that the droppable is always the gallery palette
		droppableOver = galleryPalette;
		// droppableOver = picAppSearchResultsThumbs;
	},

	eventMouseUp = function(e) {
		var oldDraggable = draggableData && draggableData.obj ? draggableData.obj : null;
		// mouse up should always end a dragging
		draggableData = {};

		if ( 0 !== draggingSomething ) {	
			// default the droppable as the gallery
			droppableOver = droppableOver || galleryPalette;
			
			// if draggingSomething is -1, then we've had a mousedown but no dragging yet,
			// so it's just a "click"
			if ( droppableOver == galleryPalette && -1 === draggingSomething ) {
				draggingSomething = 0;
				eventClickResultsThumbWrapper(getDraggableObjectFromTarget(getEventTarget(e)), e);
				return false;
			}
			return eventDroppableMouseUp(droppableOver, oldDraggable, e);
		}
	},

	eventPicappSearchSubmit = function(toggle, e) {
		searchResultsGetFromForm();
		return false;
	},

	eventSelectPicappSearchTypeCreative = function(toggle, e) {
	},

	eventSelectPicappSearchTypeEditorial = function(toggle, e) {
	},

	/**
	 * If potentialID already exists, increment it.
	 * @param string potentialID The id to check.
	 * @return string The unique ID.
	 */
	createUniqueId = function(potentialID) {
		var existingIncrement,
		matches;

		while ( $$$(potentialID) ) {
			matches = /^((\d*)-)?(.*)/.exec(potentialID);
			existingIncrement = matches[2] ? parseInt(matches[2], 10) : 0;
			potentialID = ( existingIncrement + 1 ) + '-' + matches[3];
		}
		return potentialID;
	},

	/**
	 * Sets the hoverTime custom property to be longer than default for a few seconds, so hover preview won't show up right away after being seen
	 * @param object obj The object whose hoverTime property we're adjusting
	 */
	delayHoverEvent = function(obj) {
		obj.hoverTime = 2000;
		setTimeout(function() {
			obj.hoverTime = 600;
		}, 5000);
	},

	/**
	 * Listen to click events on the post box
	 */
	searchLinkListener = function(obj) {
		obj = obj || {};
		// array of object classes -> event handlers
		classHandlers = {
			'gallery-page-nav-link':eventClickGalleryPageNavLink,
			'picapp-thumb-image':eventClickResultsThumbImage,
			'picapp-thumb-link':eventClickResultsThumbLink,
			'picapp-thumb-remove-link':eventClickRemoveLink,
			'picapp-thumb-wrapper':eventClickResultsThumbWrapper
		},

		// array of object ids -> eventhandlers
		idHandlers = {
			'gallery-cancel':eventClickGalleryCancel,
			'gallery-clear':eventClickGalleryClear,
			'gallery-display-bottom':eventClickGalleryDisplayBottom,
			'gallery-display-thumbs':eventClickGalleryDisplayThumbs,
			'gallery-display-top':eventClickGalleryDisplayTop,
			'gallery-embed':eventClickGalleryEmbed,
			'gallery-preview':eventClickGalleryPreview,
			'picapp-search-submit':eventPicappSearchSubmit,
			'picapp-search-type=creative':eventSelectPicappSearchTypeCreative,
			'picapp-search-type-editorial':eventSelectPicappSearchTypeEditorial,
			'search-gallery-toggle':eventClickGalleryToggle
		};

		obj.onclick = function(e) {
			e = e || window.event;
			var i, target = getEventTarget(e);
		

			// click should always end a dragging
			draggableData = {};
			
			for ( i in idHandlers ) {
				if ( 'string' == typeof i && target.id == i )
					return idHandlers[i](target, e);
			}

			for ( i in classHandlers ) {
				if ( 'string' == typeof i && target.className && -1 != target.className.indexOf(i) )
					return classHandlers[i](target, e);
			}
		};

		/**
		 * We need to cancel the dragstart event for all objects in the area we care about,
		 * because IE will mess up the drag and drop with ondragstart on an image
		 */
		obj.ondragstart = function(e) {
			e = e || window.event;
			e.cancelBubble = true;
			e.returnValue = false;
			return false; // IE event does funny things with mousedown / -move combinations for images
		};

		/**
		 * Cancel dragstart for a draggable object that's been orphaned outside of the main div,
		 * for example if it's a direct child of the body and absolutely positioned.
		 */
		addEvent(document, 'dragstart', function(e) {
			var draggable = getDraggableObjectFromTarget(getEventTarget(e));
			if ( draggable ) {
				e.cancelBubble = true;
				e.returnValue = false;
				return false;
			}
		});

		obj.onmousedown = function(e) {
			e = e || window.event;
			return eventMouseDown(obj, e);
		};

		obj.onmouseout = function(e) {
			e = e || window.event;
			return eventMouseOut(obj, e);

		};

		obj.onmouseover = function(e) {
			e = e || window.event;
			return eventMouseOver(obj, e);
		};

		obj.onkeydown = function(e) {
			e = e || window.event;
			return eventKeydown(obj, e);
		}

		addEvent(document, 'mousemove', eventMouseMove);
		addEvent(document, 'mouseup', eventMouseUp);

		addEvent(window, 'resize', function(e) {
			if (picAppSearchResultsThumbs) 
				centerThumbsWrap(picAppSearchResultsThumbs);
		});
	},

	/**
	 * end event listeners and handlers
	 */


	/**
	 * Graphical effects methods
	 */

	/** 
	 * The event callback for onmousemove.
	 *
	 * @param obj The object the mousedown event is happening to
	 * @param e The event object, normalized.
	 * @param offset The difference between the mouse position and element position
	 */
	dragging = function(obj, e, offset) {
		draggingSomething = 1;
		var mouseDoc = getMousePositionDocument(e);
		obj.style.left = ( mouseDoc[0] - offset[0] ) + 'px';
		obj.style.top = ( mouseDoc[1] - offset[1] ) + 'px';
		getMouseOvers([( mouseDoc[0] - offset[0] ), ( mouseDoc[1] - offset[1] )], obj);
		return false;
	},

	/**
	 * The event callback that initiates the dragging
	 * @param obj The object the mousedown event is happening to
	 * @param e The event object, normalized.
	 * @param mouseDoc The coordinates of the mouse relative to the document
	 * @param mouseEl The coordinates of the mouse relative to the element
	 */
	dragStart = function(obj, e, mouseDoc, mouseEl) {
		// something has canceled the drag start
		if ( -1 !== draggingSomething ) 
			return;
		else
			draggingSomething = 0;
		
		/**
		 * We have .picapp-thumb-wrapper -> .picapp-thumb-link -> .picapp-thumb-image,
		 * but we want the .picapp-thumb-wrapper object.
		 * As any of those could be the target, we will move up the DOM to get it, if apropos.
		 *
		 * We're going to move the wrapper div to be a child of the document and absolutely position it 
		 * so that it appears to be exactly where it was at the drag start.
		 *
		 * Instead of calculating the wrapper's abs position directly, to avoid problems we'll get it relatively: 
		 * [wrapper position] = [mouse pos] - [mouse pos in event target el] - [diff b/w target el and wrapper el]
		 * wrapperPos = mouseDoc - mouseEl - ( objPos - getElementPos(wrapper) ) 
		 * wrapperPos = mouseDoc - wrapperPosRel
		 */
		var i,
		childEls,
		links = [],
		theWrapper = null,
		theWrapperDoppelganger = null,
		wrapperPosRel = [],
		objPos = [],
		relPos = [];
		
		theWrapper = getDraggableObjectFromTarget(obj);

		if ( theWrapper ) {
			if ( picAppSearchResultsThumbs == theWrapper.parentNode ) {
				theWrapperDoppelganger = theWrapper.cloneNode(true);

				// let's increment theWrapper's ids
				theWrapper.id = createUniqueId(theWrapper.id);
				childEls = theWrapper.getElementsByTagName('*');
				for ( i = 0; i < childEls.length; i++ ) {
					if ( childEls[i].id ) {
						childEls[i].id = createUniqueId(childEls[i].id);
					}
				}

				picAppSearchResultsThumbs.insertBefore(theWrapperDoppelganger, theWrapper);
			}
			
			links = $tn('a', theWrapper);
			for( i = 0; i < links.length; i++ ) {
				links[i].onclick = function(e) {
					return false;
				};
				links[i].onmousedown = function(e) {
					e = e || window.event;
					eventMouseDown(links[i], e);
					if ( e.preventDefault )
						e.preventDefault();
					return false;
				};
			}

			objPos = getElementPos(obj);
			relPos = getElementPos(theWrapper);
			wrapperPosRel[0] = mouseEl[0] - ( objPos[0] - relPos[0] );
			wrapperPosRel[1] = mouseEl[1] - ( objPos[1] - relPos[1] );
		
			// make the object absolutely positioned
			bodyEl.appendChild(theWrapper);
			theWrapper.style.position = 'absolute';
			theWrapper.style.left = ( mouseDoc[0] - wrapperPosRel[0] ) + 'px';
			theWrapper.style.top = ( mouseDoc[1] - wrapperPosRel[1] ) + 'px';
				
			// put placeholder in gallery, as that's the only place it can be, 
			// and we want to open up that space for dropping
			placeholderObjAnimated.putIn(galleryPalette);
			placeholderObjAnimated.render();

			draggableData = {obj:theWrapper,offset:wrapperPosRel};

			getDraggablesPositions();
		}
		if ( e.preventDefault )
			e.preventDefault();
		return false;
	},

	/**
	 * Fade an element
	 * @param object obj The object to fade.
	 * @param args Optional. Object of possible arguments:
	 * 	callback - A function called upon completion.  Passed object as first argument.
	 * 	from	 - The % of opacity to start at
	 * 	rate 	 - The number of milliseconds between steps
	 * 	time	 - The time from start to finish in milliseconds
	 * 	to	 - The % of opacity to end up at
	 */
	fade = function(obj, args) {
		var callback = args.callback || function(o) {},
		from = 'undefined' != typeof args.from ? args.from : 100,
		rate = 'undefined' != typeof args.rate ? args.rate : 25,
		time = 'undefined' != typeof args.time ? args.time : 300,
		to = 'undefined' != typeof args.to ? args.to : 0,
		
		steps = time / rate,
		inc = ( to - from ) / steps,
		i, last = false;
		
		obj.style.opacity = from/100;
		obj.style.filter = 'alpha(opacity='+from+')';

		for( i = 0; i <= steps; i += 1 ) {
			last = ( i + 1 ) <= steps ? false : true;
			(function(o) {
				var doCallback = last,
				j = i,
				perc = ( i * inc ) + from;
				setTimeout(function() {
					obj.style.opacity = perc/100;
					obj.style.filter = 'alpha(opacity=' + perc + ')';
					if ( doCallback )
						callback(o);
				}, j * rate );
			})(obj);
		}
	},

	/**
	 * Get the draggable object from the target or one of its descendants.
	 * @param obj The obj to start with, and move up the dom looking for a draggable object.
	 * @return object|bool The draggable object if an ancestor; null if not;
	 */
	getDraggableObjectFromTarget = function(obj) {
		if ( ! obj )
			return;
		var theWrapper = null,
		className = obj.className ? obj.className : '',
		levels = 10, // don't look for a draggable object any higher up the dom
		origObj = obj;
		if ( obj && obj.draggableObj ) {
			return obj.draggableObj;
		} else if ( className && -1 != className.indexOf('picapp-thumb-wrapper') ) {
			theWrapper = obj;	
			obj.draggableObj = obj;
		} else {
			// while we don't have the .picapp-thumb-wrapper element, move up the dom
			while( 0 < levels && obj.parentNode && obj.className && -1 == obj.className.indexOf('picapp-thumb-wrapper') ){
				obj = obj.parentNode;
				levels--;
				className = obj.className ? obj.className : '';
				if ( className && -1 != className.indexOf('picapp-thumb-wrapper') ) {
					theWrapper = obj;	
					origObj.draggableObj = obj;
					break;
				}
			}
		}
		return theWrapper;
	},

	/**
	 *  Get the positions of all the current draggables.
	 *  @return "associative array" of draggable object ids to draggable positions
	 */
	getDraggablesPositions = function() {
		var i,
		pos,
		returnArray = [],	
		paletteDraggables = $tn('div', galleryPalette, function(o) {
			return !! ( o.className && -1 != o.className.indexOf('picapp-thumb-wrapper') );
		}),
		searchDraggables = $tn('div', picAppSearchResultsThumbs, function(o) {
			return !! ( o.className && -1 != o.className.indexOf('picapp-thumb-wrapper') );
		});

		for ( i = 0; i < paletteDraggables.length; i++ ) {
			pos = getElementPos(paletteDraggables[i]);
			returnArray[returnArray.length] = {id:paletteDraggables[i].id,x:pos[0],y:pos[1],obj:paletteDraggables[i]};
		}
		
		for ( i = 0; i < searchDraggables.length; i++ ) {
			pos = getElementPos(searchDraggables[i]);
			returnArray[returnArray.length] = {id:searchDraggables[i].id,x:pos[0],y:pos[1],obj:searchDraggables[i]};
		}

		draggablesPositions = returnArray;	
	},


	/**
	 * Get the droppable object from the target or one of its ancestors.
	 * @param object obj The target object
	 * @param array droppables The array of droppable objects.
	 */
	getDroppableObjectFromTarget = function(obj, droppables) {
		var i;
		droppables = droppables || [];
		do {
			for( i = 0; i < droppables.length; i++ ) {
				if ( obj == droppables[i] ) {
					return droppables[i];
				}
			}
			obj = obj.parentNode ? obj.parentNode : false;
		} while ( obj );
		return null;
	},

	/**
	 * An object for animating objects without race collisions
	 * @param obj The object to be manipulated
	 * @return An object of helper functions.
	 */
	ObjectAnimation = function(obj) {
		if ( ! obj )
			return {objExists:false};
		var inProcess = false,	// whether the animation is in process
		active = true,		// whether the object is active
		visible = true;		// whether the object is visible
		
		return {
			objExists:true,
			time:500, 	// the duration of the animation in milliseconds
			get:function() {
				return obj;
			},

			getVisibility:function() {
				return !! visible;
			},

			/**
			 * Hide the object.  Prevents race condition with show()
			 */
			hide:function() {
				if ( ! inProcess ) {
					inProcess = true;
					obj.style.display = 'block';
					visible = true;
					fade(obj,{
						from:100,
						to:0, 
						time:this.time,
						callback:function(obj) {
							obj.style.display = 'none';
							visible = false;
							inProcess = false;
						}
					});
				}
			},
			
			/**
			 * Show the object.  Prevents race condition with hide()
			 */
			show:function() {
				if ( ! inProcess ) {
					inProcess = true;
					obj.style.display = 'block';
					visible = false;
					fade(obj,{
						from:0,
						to:100,
						time:this.time,
						callback:function() {
							visible = true;
							inProcess = false;
						}
					});
				}
			},

			/**
			 * Decide what to do with the display of the object, based on its status and visibility
			 */
			render:function() {
				if ( visible && ! active ) 
					this.hide();
				else if ( ! visible && active )
					this.show();
			},

			/**
			 * Public method to get the status of the object
			 * @return The status of the object
			 */
			getStatus:function() {
				return true === active ? 'active' : 'inactive';
			},

			/**
			 * Public method to set the status of the object
			 * @param state The desired status of the object
			 */
			setStatus:function(state) {
				active = 'active' == state ? true : false;
			}
		};
	},

	/**
	 * End graphical effects methods
	 */


	/******************
	 *  Login methods *
	 *****************/
	
	/**
	 * Create a cookie
	 * @param name The name of the cookie
	 * @param value The value of the cookie
	 * @param days How many days the cookie will last
	 */
	createCookie = function(name,value,days) {
		var date = new Date(),
		expires = '';
		if (days) {
			date.setTime(date.getTime()+(days*24*60*60*1000));
			expires = "; expires="+( isHostMethod(date, 'toUTCString') ? date.toUTCString() : date.toGMTString() );
		}
		document.cookie = name+"="+value+expires+"; path=/";
	},

	/**
	 * Get a cookie's value
	 * @param name The name of the cookie to get
	 * @return string The value of the cookie
	 */
	readCookie = function(name) {
		var nameEQ = name + "=",
		ca = document.cookie.split(';'),
		i;

		for(i = 0; i < ca.length; i++ ) {
			while( ca[i].charAt(0)==' ') 
				ca[i] = ca[i].substring(1,ca[i].length);
			if (ca[i].indexOf(nameEQ) == 0) 
				return ca[i].substring(nameEQ.length, ca[i].length);
		}
		return null;
	},

	/*********************
	 * End login methods *
	 ********************/

	init = function() {
		setupPostBox();
	};
	
	if ( 'undefined' != typeof window )
		addEvent(window, 'load', init);
	
	/**
	 * Public methods
	 */

	return {
		editGallery:function(id) {
			try {
				// go to the gallery palette
				top.location.hash = '#picapp-gallery-palette';
				var select = $$$('picapp-post-gallery-select');
				select.value = id;
				select.onchange();
			} catch(e) {}
		},

		/**
		 * Return a replacement pattern based on the gallery's id.
		 */
		galleryPattern:function(id) {
			var galleryData = picAppGallerySettings['gallery-data'],
			replace,
			title = galleryData[id] && galleryData[id].title ? 
				galleryData[id].title : 
				localize('Picapp Gallery %d').replace('%d', id);

			if ( galleryData[id] ) {
				replace = '<div id="picapp-gallery-' + id +
					'" class="picapp-gallery-select" ' +
					'style="height:' + galleryData[id].height + 'px;' +
					'width:' + galleryData[id].width + 'px;">' +
					title + '</div>';
			} else {
				replace = '<div id="picapp-gallery-' + id + '" class="picapp-gallery-select">' + title + '</div>';
			}
			return replace;
		},

		/**
		 * Return a replacement pattern based on the single image's id.
		 * @param id The id of the single image
		 */
		galleryPatternSingle:function(id, align) {
			align = align ? 'text-align:'+ align : '';
			// just make it a generic size
			return '<div id="picapp-gallery-single-' + id + '" style="height:300px;width:200px;' + align + '" class="picapp-gallery-select">' + localize('PicApp Image') + '</div>';
		},

		getGallery:function(text) {
			var _replace,
			__replace,
			_matches,
			__matches,

			_regex = new RegExp('\\[picappgallery id="(\\d+)"\\]', 'g'),
			// __regex = new RegExp('\\[picappgallerysingle id="(\\d+)"\\]', 'g');
			__regex = new RegExp('\\[picappgallerysingle id="(\\d+)"([^\\]]*align="(left|center|right)"[^\\]]*)?\\]', 'g');

			while ( ( _matches = _regex.exec(text) ) ) {
				_replace = _matches && _matches[1] ? this.galleryPattern(_matches[1]) : '';
				text = text.replace(_matches[0], _replace);
			}

			while ( ( __matches = __regex.exec(text) ) ) {
				__replace = __matches && __matches[1] ? this.galleryPatternSingle(__matches[1], __matches[3]) : '';
				text = text.replace(__matches[0], __replace);
			}

			return text;
		},

		processRegex:function(r, s, t) {
			var sr = new RegExp('style="[^"].*text-align:\\s?(left|center|right)', 'g'),
			m, n;

			if ( t && t[0] && -1 != t[0].indexOf('style') ) {
				m = sr.exec(t[0]);
				if ( m && m[1] ) {
					s = s.replace(']', ' align="' + m[1] + '"]');
				}
			}

			n = t[0].replace(RegExp(r, 'g'), s);
			return n;
		},
		
		getShortcode:function(text) {
 			var __matches,
			_regex = new RegExp('<div id="picapp-gallery-(\\d+).*</div>', 'g'),
			__rs = '<div id="picapp-gallery-single-(\\d+)[^<]*</div>',
                        __regex = new RegExp(__rs, 'g'),
			_replace = '[picappgallery id="$1"]',
			__replace = '[picappgallerysingle id="$1"]',
			newText = text;
			newText = newText.replace(_regex, _replace);
			// text = text.replace(__regex, __replace);
			while (( __matches = __regex.exec(text)))
				newText = newText.replace(__matches[0], this.processRegex(__rs, __replace, __matches));
			return newText;
		}
	}

})(this);
