var picAppShowBox;
(function() {
var TINY={};

TINY.box=function(){
	var p,m,b,fn,ic,iu,iw,ih,ia,f=0,close;
	return{
		show:function(c,u,w,h,a,t){
			if(!f){
				p=document.createElement('div'); p.id='tinybox';
				m=document.createElement('div'); m.id='tinymask';
				close=document.createElement('div'); close.id='tinyclose';
				b=document.createElement('div'); b.id='tinycontent';
				document.body.appendChild(m); document.body.appendChild(p);
				close.appendChild(document.createTextNode('X'));
				p.appendChild(close);
				p.appendChild(b);
				close.onclick=TINY.box.hide;
				m.onclick=TINY.box.hide; 
				window.onresize=TINY.box.resize; f=1
			}
			if(!a&&!u){
				p.style.width=w?w+'px':'auto'; p.style.height=h?h+'px':'auto';
				p.style.backgroundImage='none'; 
				// b.innerHTML=c
				b = c;
			}else{
				b.style.display='none'; p.style.width=p.style.height='100px'
			}
			this.mask();
			ic=c; iu=u; iw=w; ih=h; ia=a; this.alpha(m,1,80,3);
			if(t){setTimeout(function(){TINY.box.hide()},1000*t)}
		},
		fill:function(c,u,w,h,a){
			if(u){
				p.style.backgroundImage='';
				var x=window.XMLHttpRequest?new XMLHttpRequest():new ActiveXObject('Microsoft.XMLHTTP');
				x.onreadystatechange=function(){
					if(x.readyState==4&&x.status==200){TINY.box.psh(x.responseText,w,h,a)}
				};
				x.open('GET',c,1); x.send(null)
			}else{
				this.psh(c,w,h,a)
			}
		},
		psh:function(c,w,h,a){
			if(a){
				if(!w||!h){
					var x=p.style.width, y=p.style.height; b.innerHTML=c;
					p.style.width=w?w+'px':''; p.style.height=h?h+'px':'';
					b.style.display='';
					w=parseInt(b.offsetWidth); h=parseInt(b.offsetHeight);
					b.style.display='none'; p.style.width=x; p.style.height=y;
				}else{
					b.innerHTML=c
				}
				this.size(p,w,h,4)
			}else{
				p.style.backgroundImage='none'
			}
		},
		hide:function(){
			TINY.box.alpha(p,-1,0,3)
		},
		resize:function(){
			TINY.box.pos(); TINY.box.mask()
		},
		mask:function(){
			m.style.height=TINY.page.theight()+'px';
			m.style.width=''; m.style.width=TINY.page.twidth()+'px'
		},
		pos:function(){
			var t=(TINY.page.height()/2)-(p.offsetHeight/2); t=t<10?10:t;
			p.style.top=(t+TINY.page.top())+'px';
			p.style.left=(TINY.page.width()/2)-(p.offsetWidth/2)+'px'
		},
		alpha:function(e,d,a,s){
			clearInterval(e.ai);
			if(d==1){
				e.style.opacity=0; e.style.filter='alpha(opacity=0)';
				e.style.display='block'; this.pos()
			}
			e.ai=setInterval(function(){TINY.box.twalpha(e,a,d,s)},20)
		},
		twalpha:function(e,a,d,s){
			var o=Math.round(e.style.opacity*100);
			if(o==a){
				clearInterval(e.ai);
				if(d==-1){
					e.style.display='none';
					e==p?TINY.box.alpha(m,-1,0,2):b.innerHTML=p.style.backgroundImage=''
				}else{
					e==m?this.alpha(p,1,100,5):TINY.box.fill(ic,iu,iw,ih,ia)
				}
			}else{
				var n=o+Math.ceil(Math.abs(a-o)/s)*d;
				e.style.opacity=n/100; e.style.filter='alpha(opacity='+n+')'
			}
		},
		size:function(e,w,h,s){
			e=typeof e=='object'?e:document.getElementById(e); clearInterval(e.si);
			var ow=e.offsetWidth, oh=e.offsetHeight,
			wo=ow-parseInt(e.style.width), ho=oh-parseInt(e.style.height);
			var wd=ow-wo>w?-1:1, hd=(oh-ho>h)?-1:1;
			e.si=setInterval(function(){TINY.box.twsize(e,w,wo,wd,h,ho,hd,s)},20)
		},
		twsize:function(e,w,wo,wd,h,ho,hd,s){
			var ow=e.offsetWidth-wo, oh=e.offsetHeight-ho;
			if(ow==w&&oh==h){
				clearInterval(e.si); p.style.backgroundImage='none'; b.style.display='block'
			}else{
				if(ow!=w){e.style.width=ow+(Math.ceil(Math.abs(w-ow)/s)*wd)+'px'}
				if(oh!=h){e.style.height=oh+(Math.ceil(Math.abs(h-oh)/s)*hd)+'px'}
				this.pos()
			}
		}
	}
}();

TINY.page=function(){
	return{
		top:function(){return document.body.scrollTop||document.documentElement.scrollTop},
		width:function(){return self.innerWidth||document.documentElement.clientWidth},
		height:function(){return self.innerHeight||document.documentElement.clientHeight},
		theight:function(){
			var d=document, b=d.body, e=d.documentElement;
			return Math.max(Math.max(b.scrollHeight,e.scrollHeight),Math.max(b.clientHeight,e.clientHeight))
		},
		twidth:function(){
			var d=document, b=d.body, e=d.documentElement;
			return Math.max(Math.max(b.scrollWidth,e.scrollWidth),Math.max(b.clientWidth,e.clientWidth))
		}
	}
}();

/** Gallery-specific stuff **/

picAppShowBox = function(a,b,c,d,e) {
	TINY.box.show(a,b,c,d,e);
};

var eventGalleryClick = function(e) {
	e = e || window.event;
	var target = e.target || e.srcElement,
	imageId,
	thisLocation = window.location ? window.location : '',
	markup = '',
	searchMatches,
	link;
	// look to see if it's a gallery image wrapper or the child of one
	while ( target ) {
		if ( target.className && -1 !== target.className.indexOf('picapp-gallery-image') ) {
			link = target.getElementsByTagName('a')[0];
			if ( cachedImages[link.href] ) {
				TINY.box.show(cachedImages[link.href],0,0,0,1);
			} else {
				postReq(link.href + '?picapp-ajax=1', {}, function(resp) {
					var wrapper = document.createElement('div');
					wrapper.innerHTML = resp;
					TINY.box.show(resp,0,0,0,1);
					cachedImages[link.href] = resp;
				});
			}
			if ( e.preventDefault )
				e.preventDefault();
			return false;
		}

		if ( target.parentNode )
			target = target.parentNode;
		else
			target = null;
	}
},

cachedImages = {},

init = function() {
	var gallery,
	i,
	j,
	isGalleryImage = false,
	links;
	if ( ! window.picappGalleries )
		return;
	for ( i = 0; i < picappGalleries.length; i++ ) {
		gallery = document.getElementById(picappGalleries[i]);
		if ( gallery ) {
			addEvent(gallery, 'click', eventGalleryClick);
			links = gallery.getElementsByTagName('a');
			for ( j = 0; j < links.length; j++ ) {
				if ( links[j].className && -1 !== links[j].className.indexOf('picapp-gallery-single-link') ) {
					(function(link) {
						var wrapper = document.createElement('div');
						postReq(link.href + '?picapp-ajax=1', {}, function(resp) {
							wrapper.innerHTML = resp;	
							wrapper.style.display = 'none';
							document.documentElement.appendChild(wrapper);
							cachedImages[link.href] = resp;
						});
					})(links[j]);
				}
			}
		}
	}
},

XHR = (function(scope) { 
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
})(this),

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

/**
 * Post a xhr request
 * @param url The url to which to post
 * @data The associative array of data to post
 * @callback The method to call upon success
 */
postReq = function(url, data, callback) {
	data = data || {};
	var dataString = serialize(data),
	request = new XHR;
	try {
		if ( 'undefined' == typeof callback ) {
			callback = function() {};
		}
		request.open('POST', url, true);
		request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		request.onreadystatechange = function() {
			if ( 4 == request.readyState ) {
				request.onreadystatechange = function() {};
				if ( 200 <= request.status && 300 > request.status || ( 'undefined' == typeof request.status ) ) {
					callback(request.responseText);
				}
			}
		}
		request.send(dataString);
	} catch(e) {};
},

addEvent = function( obj, type, fn ) {
	if (obj.addEventListener)
		obj.addEventListener(type, fn, false);
	else if (obj.attachEvent)
		obj.attachEvent('on' + type, function() { return fn.call(obj, window.event);});
};


addEvent(window, 'load', init);


})(this);
