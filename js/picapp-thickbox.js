/*
 * PicApp Thickbox
 * Modified by Austin Matzko from 
 * Cody Lindley's Thickbox 3.1 (http://www.codylindley.com)
 * Copyright (c) 2008 Austin Matzko
 * Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

picAppTB = {
	vCenter: function(obj, objHeight, context) {
		context = context || top.document;
		var d = context.documentElement;
		// how far down the browser has scrolled
		var scrollY = top.window.self.pageYOffset || ( d && d.scrollTop ) || context.body.scrollTop;
		var windowHeight = top.window.self.innerHeight || ( d && d.clientHeight ) || context.body.clientHeight;
		var topPx = scrollY + ( .5 * ( windowHeight - objHeight ) );
		obj.style.top = topPx + 'px';
	}
}
		  
var picAppTBcontext;
//on page load call picAppTBinit
jQuery(document).ready(function(){   
	picAppTBcontext = top.document;
	picAppTBinit('a.thickbox', picAppTBcontext);//pass where to apply thickbox
	imgLoader = new Image();// preload image
	imgLoader.src = picAppSettings.loadingImage;
	picAppTBsetupBG(document);
	picAppTBsetupBG(top.document);
});


//add thickbox to href & area elements that have a class of .thickbox
function picAppTBinit(domChunk){
	jQuery(domChunk).click(function() {
		var t = this.title || this.name || null;
		var a = this.href || this.alt;
		var g = this.rel || false;
		picAppTBshow(t,a,g);
		this.blur();
		return false;
	});
}

function picAppTBsetupBG(context) {
	context = context || picAppTBcontext;
	if (typeof context.body.style.maxHeight === "undefined") {//if IE 6
		if (context.getElementById("picAppTB_HideSelect") === null) {//iframe to hide select elements in ie6
			jQuery("body", context).append("<iframe id='picAppTB_HideSelect'></iframe><div id='picAppTB_overlay'></div><div id='picAppTB_window'></div>");
		}
	}else{//all others
		if(context.getElementById("picAppTB_overlay") === null){
			jQuery("body", context).append("<div id='picAppTB_overlay'></div><div id='picAppTB_window'></div>");
		}
	}
	context.getElementById('picAppTB_overlay').onclick = function() { picAppTBremove(); return false; };
	
	if ( ! context.getElementById('picAppTB_load') ) 	
		jQuery("body", context).append("<div id='picAppTB_load'><img src='"+imgLoader.src+"' /></div>"); //add loader to the page
}

function picAppTBshowBG(kind, context) {
	context = context || top.document;
	kind = kind || 'modal';
	if (typeof context.body.style.maxHeight === "undefined") {//if IE 6
		jQuery('#picAppTB_HideSelect', context).show();
		// jQuery("body","html").css({height: "100%", width: "100%"});
		// jQuery("html", context).css("overflow","hidden");
	}
	if(picAppTBdetectMacXFF()){
		jQuery("#picAppTB_overlay", context).addClass("picAppTB_overlayMacFFBGHack"); //use png overlay so hide flash
	} else {
		jQuery("#picAppTB_overlay", context).addClass("picAppTB_overlayBG" + kind); //use background and opacity
	}
	jQuery("#picAppTB_overlay", context).show();
	jQuery('#picAppTB_load', context).show();//show loader

}

function picAppTBhideBG(context) {
	context = context || top.document;
	jQuery('#picAppTB_HideSelect', context).hide();
	jQuery('#picAppTB_load', context).hide();//hide loader
	jQuery("#picAppTB_overlay", context).hide();
	jQuery("#picAppTB_window", context).hide().html('');
}

function picAppTBshow(caption, url, imageGroup, context, callback) { //function called when the user clicks on a thickbox link
	context = context || top.document;
	url = url || '';

	picAppTBshowBG();
	caption = !! caption ? caption : '';
	var baseURL;
	if ( url.indexOf("?") !== -1 ) // if there is a query string involved
		baseURL = url.substr(0, url.indexOf("?"));
	else 
		baseURL = url;
	
	var params = picAppTBparseQuery( url.replace(/^[^\?]+\??/,'') );
	
	try {
		
	   

		picAppTB_WIDTH = (params['width']*1) + 30 || 630; //defaults to 630 if no paramaters were added to URL
		picAppTB_HEIGHT = (params['height']*1) + 40 || 440; //defaults to 440 if no paramaters were added to URL
		ajaxContentW = picAppTB_WIDTH - 30;
		ajaxContentH = picAppTB_HEIGHT - 45;
		
		if(url.indexOf('picAppTB_iframe') != -1){// either iframe or ajax window		
				urlNoQuery = url.split('picAppTB_');
				jQuery("#picAppTB_iframeContent", context).remove();
				if(params['modal'] != "true"){//iframe no modal
					jQuery("#picAppTB_window", context).append("<div id='picAppTB_title'><div id='picAppTB_ajaxWindowTitle'>"+caption+"</div><div id='picAppTB_closeAjaxWindow'><a href='#' id='picAppTB_closeWindowButton' title='Close'><img src='" + picAppSettings.closeImage + "' /></a></div></div><iframe frameborder='0' hspace='0' src='"+urlNoQuery[0]+"' id='picAppTB_iframeContent' name='picAppTB_iframeContent"+Math.round(Math.random()*1000)+"' onload='picAppTBshowIframe()' style='width:"+(ajaxContentW + 29)+"px;' > </iframe>");
					// jQuery("#picAppTB_window", context).append("<div id='picAppTB_title'><div id='picAppTB_ajaxWindowTitle'>"+caption+"</div><div id='picAppTB_closeAjaxWindow'><a href='#' id='picAppTB_closeWindowButton' title='Close'><img src='" + picAppSettings.closeImage + "' /></a></div></div><iframe frameborder='0' hspace='0' src='"+urlNoQuery[0]+"' id='picAppTB_iframeContent' name='picAppTB_iframeContent"+Math.round(Math.random()*1000)+"' onload='picAppTBshowIframe()' style='width:"+(ajaxContentW + 29)+"px;height:"+(ajaxContentH + 17)+"px;' > </iframe>");
				}else{//iframe modal
					jQuery("#picAppTB_window", context).append("<iframe frameborder='0' hspace='0' src='"+urlNoQuery[0]+"' id='picAppTB_iframeContent' name='picAppTB_iframeContent"+Math.round(Math.random()*1000)+"' onload='picAppTBshowIframe()' style='width:"+(ajaxContentW + 29)+"px;'> </iframe>");
					// jQuery("#picAppTB_window", context).append("<iframe frameborder='0' hspace='0' src='"+urlNoQuery[0]+"' id='picAppTB_iframeContent' name='picAppTB_iframeContent"+Math.round(Math.random()*1000)+"' onload='picAppTBshowIframe()' style='width:"+(ajaxContentW + 29)+"px;height:"+(ajaxContentH + 17)+"px;'> </iframe>");
				}
		}else{// not an iframe, ajax
				if(jQuery("#picAppTB_window", context).css("display") != "block"){
					if(params['modal'] != "true"){//ajax no modal
					jQuery("#picAppTB_window", context).append("<div id='picAppTB_title'><div id='picAppTB_ajaxWindowTitle'>"+caption+"</div><div id='picAppTB_closeAjaxWindow'><a href='#' id='picAppTB_closeWindowButton'><img src='" + picAppSettings.closeImage + "' /></a></div></div><div id='picAppTB_ajaxContent' style='width:"+ajaxContentW+"px;'></div>");
					// jQuery("#picAppTB_window", context).append("<div id='picAppTB_title'><div id='picAppTB_ajaxWindowTitle'>"+caption+"</div><div id='picAppTB_closeAjaxWindow'><a href='#' id='picAppTB_closeWindowButton'><img src='" + picAppSettings.closeImage + "' /></a></div></div><div id='picAppTB_ajaxContent' style='width:"+ajaxContentW+"px;height:"+ajaxContentH+"px'></div>");
					}else{//ajax modal
					jQuery("#picAppTB_window", context).append("<div id='picAppTB_ajaxContent' class='picAppTB_modal' style='width:"+ajaxContentW+"px;height:"+ajaxContentH+"px;'></div>");	
					}
				}else{//this means the window is already up, we are just loading new content via ajax
					jQuery("#picAppTB_ajaxContent", context)[0].style.width = ajaxContentW +"px";
					jQuery("#picAppTB_ajaxContent", context)[0].style.height = ajaxContentH +"px";
					jQuery("#picAppTB_ajaxContent", context)[0].scrollTop = 0;
					jQuery("#picAppTB_ajaxWindowTitle", context).html(caption);
				}
		}
				
		context.getElementById("picAppTB_closeWindowButton").onclick = function() { picAppTBremove(); return false; };
		
			if(url.indexOf('picAppTB_inline') != -1){	
				jQuery("#picAppTB_ajaxContent", context).append(jQuery('#' + params['inlineId']).children());
				jQuery("#picAppTB_window", context).unload(function () {
					jQuery('#' + params['inlineId']).append( jQuery("#picAppTB_ajaxContent", context).children() ); // move elements back when you're finished
				});
				picAppTBposition();
				jQuery("#picAppTB_load", context).hide();
				jQuery("#picAppTB_window", context).css({display:"block"}); 
			}else if(url.indexOf('picAppTB_iframe') != -1){
				picAppTBposition();
				if($.browser.safari){//safari needs help because it will not fire iframe onload
					jQuery("#picAppTB_load", context).hide();
					jQuery("#picAppTB_window", context).css({display:"block"});
				}
			}else{
				jQuery("#picAppTB_ajaxContent", context).load(url += "&random=" + (new Date().getTime()),function(){//to do a post change this load method
					picAppTBposition();
					jQuery("#picAppTB_load", context).hide();
					picAppTBinit("#picAppTB_ajaxContent a.thickbox");
					jQuery("#picAppTB_window", context).css({display:"block"});
					if ( jQuery.isFunction(callback) )
						callback();
				});
			}
		

		if(!params['modal']){
			context.onkeyup = function(e){ 	
				if (e == null) { // ie
					if ( event )
						keycode = event.keyCode;
					if ( window && window.event )
						keycode = window.event.keyCode;
					else if ( top.window && top.window.event )
						keycode = top.window.event.keyCode;
				} else { // mozilla
					keycode = e.which;
				}
				if(keycode == 27){ // close
					picAppTBremove();
				}	
			};
		}
	} catch(e) {
		//nothing here
	}
}

//helper functions below
function picAppTBshowIframe(){
	jQuery("#picAppTB_load", picAppTBcontext).hide();
	jQuery("#picAppTB_window", picAppTBcontext).css({display:"block"});
}

function picAppTBremove(context) {
	context = context || top.document;
	picAppTBhideBG(context);
	if (typeof context.body.style.maxHeight == "undefined") {//if IE 6
		jQuery('#picAppTB_HideSelect', context).hide();
		jQuery("body","html").css({height: "auto", width: "auto"});
		jQuery("html", context).css("overflow","");
	}
	context.onkeydown = "";
	context.onkeyup = "";
	return false;
}

function picAppTBposition(context) {
	context = context || top.document;
jQuery("#picAppTB_window", context).css({marginLeft: '-' + parseInt((picAppTB_WIDTH / 2),10) + 'px', width: picAppTB_WIDTH + 'px'});
//	if ( !(jQuery.browser.msie && jQuery.browser.version < 7)) { // take away IE6
//		jQuery("#picAppTB_window", context).css({marginTop: '-' + parseInt((picAppTB_HEIGHT / 2),10) + 'px'});
//	} else {
		picAppTB.vCenter(context.getElementById('picAppTB_window'), picAppTB_HEIGHT, context);
//		jQuery('#picAppTB_window', context).css({marginTop: (0 - parseInt(this.offsetHeight / 2) + parseInt(document.documentElement && document.documentElement.scrollTop || document.body.scrollTop, 10) + 'px')});
//	}
}

function picAppTBparseQuery(query) {
	var Params = {};
	if ( ! query ) 
		return Params; // return empty object
	var Pairs = query.split(/[;&]/);
	for ( var i = 0; i < Pairs.length; i++ ) {
		var KeyVal = Pairs[i].split('=');
		if ( ! KeyVal || KeyVal.length != 2 ) 
			continue;
		var key = unescape( KeyVal[0] );
		var val = unescape( KeyVal[1] );
		val = val.replace(/\+/g, ' ');
		Params[key] = val;
	}
	return Params;
}

function picAppTB_getPageSize(){
	var de = picAppTBcontext.documentElement;
	var w = window.innerWidth || self.innerWidth || (de&&de.clientWidth) || picAppTBcontext.body.clientWidth;
	var h = window.innerHeight || self.innerHeight || (de&&de.clientHeight) || picAppTBcontext.body.clientHeight;
	arrayPageSize = [w,h];
	return arrayPageSize;
}

function picAppTBdetectMacXFF() {
  var userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.indexOf('mac') != -1 && userAgent.indexOf('firefox')!=-1) {
    return true;
  }
}


