var picAppCache = 'undefined' != typeof top.window.picAppCache ? top.window.picAppCache : {im: {}, pg: {}};

/**
 * Check whether an image object has loaded
 */
var picAppImgIncomplete = function(img) {
	if ( ! img.complete || ( typeof img.naturalWidth != "undefined" && img.naturalWidth == 0 ) ) 
		return false;
	else
		return true;
}

var picAppCopyToKeyboard = function(t) {
	if ( window.clipboardData && clipboardData.setData ) {
		clipboardData.setData('Text', t);
		return true;
	}
	var divHolder = top.document.getElementById('flashcopier');
	if( ! divHolder ) {
		divHolder = top.document.createElement('div');
		divHolder.id = 'flashcopier';
		top.document.body.appendChild(divHolder);
	}
	divHolder.innerHTML = '<embed src="'+ picAppSettings.copyFlash +'" FlashVars="clipboard='+escape(t)+'" width="0" height="0" type="application/x-shockwave-flash"></embed>';
	return true;
}

/**
 * Check whether the PicApp cookie is present and the date not expired: don't trust it beyond that, it doesn't check the validity of the hash.
 * Basically, it's just a quick way to determine whether to present the user with a login window instead of the detail page,
 * which if circumvented will check the hash on the PHP side of things.
 */
var picAppCheckCookie = function() {
	var loginCookie = picAppReadCookie('picappUser');
	if ( ! loginCookie )
		return false;
	var date = new Date();
	var now = date.toGMTString();
	var parts = loginCookie.split('%7C');
	if ( ! parts[1] || ( parseInt(parts[1], 10) * 1000 ) < now )
		return false;
	else
		return true;
}

var picAppCreateCookie = function (name,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function picAppReadCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

/** 
 * Set the width of the search text input
 */
var picAppSearchBoxSize = function() {	
	/* 41 + #picapp-search-key-term + 300 = width of #picapp-search-area */
	var searchWidth = parseInt(jQuery('#picapp-search-area').width(), 10) - 341;
	searchWidth = 20 < searchWidth ? searchWidth : 'auto';
	jQuery('#picapp-search-key-term').width(searchWidth);
}

var postboxInit = function(imageCache) {
	var $i = function(n) {
		var item = document.getElementById(n);
		if ( item )
			return item;
		return false;
	}
	
	for( var i in imageCache ) {
		if ( ! picAppCache.im[i] ) {
			picAppCache.im[i] = imageCache[i];
			picAppCache.im[i].imageObj = new Image();
			picAppCache.im[i].imageObj.src = imageCache[i].src;
		}
	}

	var assignSearch = function() {
		var args = {'picapp-search-results':1, 'picapp-ajax':1};
		
		jQuery('#picapp-search-rss-wrap span.non-registered a').each(function(i, el) {
			el.onclick = function(e) { 
				picAppTBshow(this.getAttribute('title'), this.href + '&picapp-ajax=1', false, top.document);
				return false;
			}
		});
		/**
		 * Caches the page if not already cached, returns the standardized link if it's cached
		 * If no response, try 5 times total before giving up
		 */
		var cachePage = function(pageName, args, attempts) {
			attempts = attempts || 0;
			attempts++;
			// standardize URLs
			pageName = pageName.replace(RegExp('^(https?://)?'+window.location.hostname),'');
			if ( ! picAppCache.pg['"'+pageName+'"'] ) {
				picAppCache.pg['"'+pageName+'"'] = document.createElement('div');
				jQuery.post( pageName, args, function(resp) {
					// don't cache blank pages
					if ( ! resp ) {
						if ( 6 > attempts )
							setTimeout(function() { cachePage(pageName, args, attempts); }, 1000);
						return pageName;
					}
					picAppCache.pg['"'+pageName+'"'].innerHTML = resp;
				}, 'html' );
				return false;
			} else 
				return pageName;

		}

		var cacheLink = function(link, attempts) { 
			attempts = attempts || 0;
			attempts++;
			if ( ! link ) 
				return;
			// check the cache first
			var cachedLink = link.replace(RegExp('^(https?://)?'+window.location.hostname),'');
			if ( 'undefined' == typeof picAppCache.pg['"'+cachedLink+'"'] || ! picAppCache.pg['"'+cachedLink+'"'] || ! picAppCache.pg['"'+cachedLink+'"'].innerHTML || '' == picAppCache.pg['"'+cachedLink+'"'].innerHTML ) {
				jQuery.post(link, args, function(resp) { 
					// if no response, try a few more times before giving up
					if ( ! resp ) {
						if ( 6 > attempts )
							setTimeout(function() { cacheLink(link, attempts); }, 500);
						return false;
					}
					jQuery('#picapp-search-results').html(resp);
					assignSearch(); 
					picAppTBhideBG(document); 
				}); 
			} else {
				jQuery('#picapp-search-results').html(picAppCache.pg['"'+cachedLink+'"']);
				assignSearch();
				picAppTBhideBG(document);
			}
			return false; 
		};

		jQuery('.picapp-search-results-footer a').each(function(i, el) {
			el.onclick = function(e) { 
				picAppTBshowBG('loading', document); 
				cacheLink(el.href); 
				return false; 
			};
			// keep thumbnails from being draggable
			el.onmousedown = function(e) {
				if ( e && 'undefined' != typeof e.preventDefault )
					e.preventDefault();
			}
			cachePage(el.href, args);
		});


		jQuery('.picapp-thumb a').each(function(i, el) {
			el.onclick = function(e) {
				// try to find out either that the user has logged in or that he has a cookie with email address, to see the publish page
				var emailCookie = picAppReadCookie('picappPubEmail');
				//alert('.picapp-thumb a: ' + emailCookie + " , " + picAppCheckCookie());
				if ( picAppCheckCookie() || emailCookie ) {
					picAppTBshow(picAppTexts.fullSizeHeader, el.href + '&picapp-ajax=1&width=820&height=550', false, top.document, function() {
						var fullImage = top.document.createElement('img');
						fullImage.src = el.rel;
						fullImage.backupSrc = el.rel;
						jQuery('#picapp-detailbox-fullsize', top.document).html(fullImage);
					});	
				// the user is not logged in
				} else {
					picAppTBshow(el.getAttribute('title'), el.href + '&picapp-publish-login-reminder=1&picapp-ajax=1&width=350&height=250', false, top.document, function(){
						// remember which thumbnail this came from
						var fromId = el.id;
						jQuery('#picapp-publish-login-reminder-form', top.document).append('<input type="hidden" id="from-thumb" name="from-thumb" value="' + fromId + '" />');
						// if the signin link is clicked, close this and open up the login window
						jQuery('#picapp-publish-signin-link', top.document).click(function() {
							var that = this;
							picAppTBhideBG();
							setTimeout(function() {
								picAppTBshow(that.getAttribute('title'), that.href, false, top.document);
							}, 200);
							return false;
						});
					});
				}
				return false;
			}
		});
		
		/*
		 * Cache the next batch of pages
		 */
		var lastLink = jQuery('.picapp-search-results-footer a:last').attr('href');
		if ( lastLink ) {
			var num = /(picapp-search-results-page)=(\d*)/.exec(lastLink)[2];
			num = parseInt(num, 10);
			for( var i = 0; i < picAppSettings.pageListCount; i++ ) {
				var nextPage = lastLink.replace(/(picapp-search-results-page)=(\d*)/,'$1='+(num - 1 + i + picAppSettings.pageListCount) );
				cachePage(nextPage, args);
			}
		}
	};
	jQuery(window).resize(picAppSearchBoxSize);
	picAppSearchBoxSize();
	assignSearch();
	// search autocomplete
	jQuery('.picapp-register a').attr('target', '_blank');
	jQuery('.picapp-signout a').unbind();
	jQuery('#picapp-metabox-wrap a.thickbox').unbind();
	jQuery('#picapp-signin-link').click(function(e) {
		picAppTBshow(this.getAttribute('title'), this.href, false, top.document);
		return false;
	});
	jQuery('#picapp-signout-link').click(function(e) {
		picAppTBshow(this.getAttribute('title'), this.href, false, top.document);
		return false;
	});

	var submitSearchData = function(queryArgs) {
		jQuery.post('?picapp-search-results-page=1', queryArgs, function(resp) { 
			jQuery('#picapp-search-results').html(resp);
			jQuery('#picapp-search-rss-wrap').load('?picapp-metabox-search-rss=1',
				{'picapp-ajax':1, 'term': queryArgs['picapp-search-key-term']},
				function() {
				}
			);
			assignSearch(); 
			picAppTBhideBG(document); 
		}); 
	}

	var submitPicAppSearch = function(e) {
		// show working
		picAppTBshowBG('loading', document);
		var c = !! $i('picapp-search-type-creative').checked;
		var e = !! $i('picapp-search-type-editorial').checked;

		var queryArgs = {
			'picapp-search-results':1, 
			'picapp-ajax':1,
			'picapp-search-key-term': jQuery('#picapp-search-key-term').val()
		}
		if ( c && e ) {
			queryArgs['picapp-search-key-cats'] = 'all';
		} else if ( c ) {
			queryArgs['picapp-search-key-cats'] = 'creative';
		} else if ( e ) {
			queryArgs['picapp-search-key-cats'] = 'editorial';	
		}
			
		submitSearchData(queryArgs);
		
		return false;
	};
	// set up autosuggest
	jQuery("#picapp-search-key-term").picAppSuggest("?picapp-autosuggest=1");	
	// submit the form ajaxily
	jQuery('#picapp-search-area-form').submit(submitPicAppSearch);
}


var picAppInsertCode = function(code) {
	var success = false;
	try {
		top.window.edInsertContent(top.window.edCanvas, code);
		return true;
	} catch(e) {
		try {
			top.window.tinyMCE.execCommand('mceInsertContent', false, code);
			return true;
		} catch(e) {
			return false;
		}
	}
}
