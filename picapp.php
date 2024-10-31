<?php
/*
Plugin Name: PicApp 
Plugin URI: http://blog.picapp.com/
Description: PicApp WordPress plugin.

Author: Watershed Studio, LLC
Author URI: http://watershedstudio.com/
Version: 1.3
*/

define('PICAPP_GALLERY_SIMPLE', true); // whether to use the stripped-down version of the plugin

class PicApp_Factory {

	var $api; // a reference to the API object
	var $debug = false;
	var $search_term_api; // search term recording API object, PicApp_Search_Terms
	var $user_api; // user api
	var $url; // the url to this plugin's directory
	var $dir; // the directory path to this plugin's directory
	var $page_list_count = 5; // the number of linked pages to show at once
	var $search_thumbnail_dimension = 60;
	var $thumbnail_dimension = 70;

	function PicApp_Factory()
	{
		return $this->__construct();
	}

	function __construct()
	{
		register_activation_hook(__FILE__, array(&$this, 'event_activation'));
		add_action('admin_init', array(&$this, 'event_admin_init'));
		// backwards-compat
		if ( ! function_exists('has_filter') ) {
			add_action('init', array(&$this, 'event_admin_init'));
			add_action('edit_form_advanced', array(&$this, 'postbox_wrap'));
		}
		add_action('wp_ajax_picapp_gallery_palette', array(&$this, 'event_picapp_request_gallery_palette'));
		add_action('wp_ajax_picapp_save_gallery', array(&$this, 'event_picapp_save_gallery')); 
		add_action('wp_ajax_picapp_script_query', array(&$this, 'event_picapp_script_query')); 
		add_action('wp_ajax_picapp_search_query', array(&$this, 'event_picapp_search_query')); 
		add_action('init', array(&$this, 'add_rewrite_rules'));
		add_action('init', array(&$this, 'event_init'));
		add_action('load-page.php', array(&$this, 'event_load_admin_script'));
		add_action('load-post.php', array(&$this, 'event_load_admin_script'));
		add_action('load-post-new.php', array(&$this, 'event_load_admin_script'));
		add_action('post_gallery_dropdown', array(&$this, 'get_post_gallery_dropdown'), 99, 3);
		add_action('template_redirect', array(&$this, 'event_template_redirect'));
		add_action('wp_head', array(&$this, 'event_wp_head'));
		
		add_filter('mce_external_plugins', array(&$this, 'filter_mce_external_plugins'));
		add_filter('the_content', array(&$this, 'filter_the_content'), 1);
		
		add_shortcode( 'picappgallery', array(&$this, 'gallery_shortcode') );
		add_shortcode( 'picappgallerysingle', array(&$this, 'single_shortcode') );

		if ( function_exists('plugins_url') ) {
			$this->url = trailingslashit(plugins_url(basename(dirname(__FILE__))));
		} else {
			$this->url = trailingslashit(get_option('siteurl') . '/' . PLUGINDIR . '/' . basename(dirname(__FILE__)));
		}
		wp_register_script( 'picapp-gallery-post-script', $this->url . 'js/admin.min.js', null, '.053' );

		wp_register_style( 'picapp-gallery-style', $this->url . 'css/gallery.css' );
		wp_register_script( 'picapp-gallery-script', $this->url . 'js/gallery.js', null, '.053' );

		define('PICAPP_GALLERY_FILEDIR', trailingslashit(dirname(__FILE__)));
	}

	/**
	 * Wrapper for localization method __()
	 * @param string $t The text to localize.
	 * @return string The localized text.
	 */
	function __($t = '')
	{
		return __($t, 'picapp-gallery');
	}

	/**
	 * Wrapper for localization method, _e(), sorta.
	 * @param string $t The text to localize.
	 * @return string The localized text.
	 */
	function _e($t = '')
	{
		echo $this->__($t);
	}

	function add_rewrite_rules()
	{
		add_rewrite_rule('^picapp-gallery/(.*)/(.*)/(\d*)/?$', 'index.php?picapp-gallery=$matches[1]&picapp-gallery-item=$matches[2]&picapp-gallery-item-id=$matches[3]', 'top');
		add_rewrite_rule('^picapp-gallery/(.*)/?$', 'index.php?picapp-gallery=$matches[1]', 'top');
	}

	/**
	 * Flush the saved WordPress rewrite rules and rebuild them
	 */
	function flush_rewrite_rules()
	{
		global $wp_rewrite;
		$this->add_rewrite_rules();
		$wp_rewrite->flush_rules();
		if ( $this->debug ) {
			$this->log($wp_rewrite, 'flush_rewrite_rules()');
		}
	}

	/**
	 * Log events
	 * @param mixed $data The data to log.
	 * @param string Optional $type The type of event to log.
	 * @param string Optional $type The type of event to log.
	 */
	function log($data = '', $origin = 'unknown', $type = 'general')
	{
		$file = PICAPP_GALLERY_FILEDIR . "logs/log-{$type}-" . date('Y-m-d-U');
		$fp = @fopen($file, 'a');
		if ( false !== $fp ) {
			fwrite($fp,print_r($data, true));
			fclose($fp);
		}
	}

	/**
	 * Events: callback methods for various actions in WordPress
	 */

	/**
	 * Callback method for when the plugin is activated.
	 */
	function event_activation()
	{
		$this->flush_rewrite_rules();
	}

	function event_admin_head()
	{
		global $post;

		$gallery_data = array();
		if ( isset( $post ) && ! empty( $post->ID ) ) {
			$galleries = $this->get_post_galleries($post->ID);
			foreach( (array) $galleries as $gallery ) {
				list($width, $height) = $this->get_estimated_gallery_dimensions($gallery->ID);
				$title = get_the_title($gallery->ID);
				$title = ( empty( $title ) ) ? 
					sprintf($this->__('PicApp Gallery %d'), $gallery->ID) : 
					sprintf($this->__('Gallery "%s"'), $title);
				$title = htmlentities($title);
				$gallery_data[] = "{$gallery->ID}:{title:'{$title}',height:{$height},width:{$width}}";
			}
		}
		?>
		<link rel="stylesheet" type="text/css" media="all" href="<?php echo $this->url; ?>css/main.css" title="<?php $this->_e('PicApp Gallery'); ?>" />

		<script type="text/javascript">
		//<![CDATA[
			var picAppGallerySettings = {
				l10n:{
					'Are you sure that you want to delete all images from this gallery?':'<?php $this->_e('Are you sure that you want to delete all images from this gallery?'); ?>',
					'Gallery Embedded':'<?php $this->_e('Gallery Embedded'); ?>',
					'Image Embedded':'<?php $this->_e('Image Embedded'); ?>',
					'No images were selected for the gallery':'<?php $this->_e('No images were selected for the gallery'); ?>',
					'Picapp Gallery %d':'<?php $this->_e('Picapp Gallery %d'); ?>',
					'Saving...':'<?php $this->_e('Saving...'); ?>',
					'PicApp Image Placeholder':'<?php $this->_e('PicApp Image'); ?>'
				},
				adminAjaxEndpoint:'admin-ajax.php',
				gallerySimple:<?php echo intval(PICAPP_GALLERY_SIMPLE); ?>,
				homeURL:'<?php echo trailingslashit(get_option('home')); ?>',
				'gallery-data':{<?php echo implode(',',$gallery_data); ?>},
				'picapp-search-nonce':'<?php 
					echo wp_create_nonce('picapp_search_query'); 
				?>'
			};
		//]]>
		</script>

		<?php
	}

	function event_admin_init()
	{
		if ( ! is_admin() || ! current_user_can('edit_posts') ) {
			return;
		}

		if ( ! empty( $_GET['picapp-admin-print-gallery'] ) && 
			wp_verify_nonce($_GET['picapp-search-nonce'], 'picapp_search_query') ) {
			
			$gallery_id = intval($_GET['picapp-admin-print-gallery']);
			$this->print_gallery($gallery_id);
			exit;
		}

		if ( function_exists('add_meta_box') ) {
			add_meta_box('picapp-metabox', $this->__('PicApp Images'), array(&$this, 'postbox_wrap'), 'post', 'normal', 'high');
		}

	}

	function event_init()
	{
		if ( ! is_admin() ) {
			wp_enqueue_script('picapp-gallery-script');
			wp_enqueue_style('picapp-gallery-style');
		}
		$this->user_api = new PicApp_User_Handling();
		$this->search_term_api = new PicApp_Search_Terms();
		
		add_rewrite_tag('%picapp-ajax%', '(.*)');
		add_rewrite_tag('%picapp-gallery%', '(.*)');
		add_rewrite_tag('%picapp-gallery-id%', '(.*)');
		add_rewrite_tag('%picapp-gallery-item%', '(.*)');
		add_rewrite_tag('%picapp-gallery-item-id%', '(\d*)');

		load_plugin_textdomain('picapp-gallery', $this->dir . 'l10n/');
	}

	function event_load_admin_script()
	{
		add_action('admin_head', array(&$this, 'event_admin_head'));
		wp_enqueue_script('picapp-gallery-post-script');
		
		wp_enqueue_script('picapp-gallery-script');
		wp_enqueue_style('picapp-gallery-style');

	}

	/**
	 * Callback for requesting gallery palette
	 */
	function event_picapp_request_gallery_palette() 
	{
		if ( ! wp_verify_nonce($_POST['picapp-search-nonce'], 'picapp_search_query') ) {
			die(0);
		}

		$gallery_id = intval($_POST['gallery-id']);
		$post_id = intval($_POST['post-id']);
		$this->print_gallery_palette($post_id, $gallery_id);
		exit;
	}

	/**
	 * Callback for ajax-posted gallery saving
	 */
	function event_picapp_save_gallery()
	{
		global $wpdb;
		if ( ! wp_verify_nonce($_POST['picapp-search-nonce'], 'picapp_search_query') ) {
			die(0);
		}
		$post_id = intval($_POST['post-id']);
		if ( current_user_can('edit_post', $post_id) ) {
			// if no gallery id provided, then we'll need to create one
			$gallery_id = ( isset( $_POST['gallery-id'] ) ) ? intval($_POST['gallery-id']) : 0;

			// if gallery id already exists, it will update it.  Otherwise, it will create it.
			$gallery_id = wp_insert_post(array(
				'ID' => $gallery_id,
				'post_content' => $this->__('Gallery content placeholder'),
				'post_parent' => $post_id,
				'post_status' => 'publish',
				'post_title' => ( isset( $_POST['gallery-title'] ) ) ? $_POST['gallery-title'] : '',
				'post_type' => 'picapp_gallery',
			));
			
			if ( ! empty( $gallery_id ) ) {
				update_post_meta($gallery_id, '_picapp_gallery_display_rows', $_POST['display-rows']);
				update_post_meta($gallery_id, '_picapp_gallery_display_option', $_POST['display-option']);
				
				// loop through each thumbnail
				$i = 0;
				foreach( (array) $_POST['galleryData'] as $picapp_id => $data ) {
					$i++;
					// see if this thumbnail exists as an attachment already		
					$picapp_id = intval($picapp_id);
					$attach_id = (int) $wpdb->get_var(sprintf("SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_picapp_image_id' AND meta_value = %d LIMIT 1", $picapp_id));
					$attach_id = wp_insert_post(array(
						'ID' => $attach_id,
						'menu_order' => $data['order'],
						'post_content' => $data['desc'],
						'post_parent' => $gallery_id,
						'post_status' => 'publish',
						'post_title' => $data['title'],
						'post_type' => 'gallery_item',
					), false, $gallery_id);

					if ( ! empty( $attach_id ) ) {
						// now save as a posts meta datum
						update_post_meta($attach_id, '_picapp_image_id', $picapp_id);
						update_post_meta($attach_id, '_picapp_image_full', $data['full']);
						update_post_meta($attach_id, '_picapp_image_height', $data['height']);
						update_post_meta($attach_id, '_picapp_image_thumb', $data['thumb']);
						update_post_meta($attach_id, '_picapp_image_thumbheight', $data['thumbheight']);
						update_post_meta($attach_id, '_picapp_image_thumbwidth', $data['thumbwidth']);
						update_post_meta($attach_id, '_picapp_image_width', $data['width']);
					}
				}
			}
			// return the gallery id
			echo $gallery_id;
			exit;
		} else {
			die(0);
		}
	}

	/**
	 * Callback for the ajax-posted script event.  Basically, gets the single-image script in response to posting an image id.
	 */
	function event_picapp_script_query()
	{
		if ( ! wp_verify_nonce($_POST['picapp-search-nonce'], 'picapp_search_query') ) {
			return false;
		}

		$args['imageid'] = $_POST['picapp-image-id'];
		$post_id = intval($_POST['post-id']);

		if ( ! empty( $_POST['search-term'] ) ) {
			$args['searchterm'] = $_POST['search-term'];
		}
                $args['size'] = '2';
		$api = $this->api();
		$result = $api->script($args);

		if ( false != $result ) {
			echo intval(update_post_meta($post_id, '_picapp_image_script_' . $args['imageid'], $result));
		} else {
			echo '0';
		}
		exit;
	}

	/**
	 * Callback for ajax-posted search event
	 */
	function event_picapp_search_query()
	{
		if ( ! wp_verify_nonce($_POST['picapp-search-nonce'], 'picapp_search_query') ) {
			return false;
		}


		$thumbs_only = ( ! empty( $_POST['thumbs-only'] ) ) ? true : false;

		// let's parse the posted request into a standardized query
		$qry = array();
		
		$qry['post_id'] = ( ! empty( $_POST['post-id'] ) ) ? intval($_POST['post-id']) : 0;
		
		if ( ! empty( $_POST['picapp-search-key-cats'] ) ) {
			$qry['cats'] = strtolower($_POST['picapp-search-key-cats']);	
		}

		if ( ! empty( $_POST['picapp-search-results-page'] ) ) {
			$qry['page'] = (int) $_POST['picapp-search-results-page'];
		}

		$user_data = wp_get_current_user();
		if ( ! empty( $_POST['picapp-search-key-term'] ) ) {
			$qry['term'] = $_POST['picapp-search-key-term'];
			update_usermeta($user_data->ID, '_picapp_last_search_term', $_POST['picapp-search-key-term']);
		} else {
			$last_term = get_usermeta($user_data->ID, '_picapp_last_search_term');
			$qry['term'] = ( empty( $last_term ) ) ? '*' : $last_term;
		}

		if ( ! empty( $_POST['picapp-search-key-totalrecords'] ) ) {
			$qry['totalrecords'] = $_POST['picapp-search-key-totalrecords'];
		}

		if ( $thumbs_only ) {
			$this->search_results_markup($qry);
		} else {
			$this->postbox($qry);	
		}
		exit;
	}

	function event_template_redirect()
	{
		global $wpdb;
		$picapp_ajax = intval(get_query_var('picapp-ajax'));

		$picapp_gallery = get_query_var('picapp-gallery');
		$picapp_gallery_id = get_query_var('picapp-gallery-id');
		$picapp_gallery_item_id = intval(get_query_var('picapp-gallery-item-id'));
		if ( ! empty( $picapp_gallery ) || ! empty( $picapp_gallery_id ) ) {
			if ( ! empty( $picapp_gallery_item_id ) ) {
				$post_id = $wpdb->get_var(sprintf("SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_picapp_image_id' AND meta_value = '%d' LIMIT 1", $picapp_gallery_item_id));
				add_filter('posts_where', array(&$this, 'filter_posts_where_gallery_item'));
				add_filter('the_content', array(&$this, 'filter_the_content_gallery_item'), 999);
				query_posts(array(
					'p' => $post_id,
					'post_type' => 'gallery_item', // want "gallery_item"
				));
				remove_filter('posts_where', array(&$this, 'filter_posts_where_gallery_item'));
				// an ajax request, so just print the content
				if ( 1 === $picapp_ajax ) {
					the_post();
					the_content();
					exit;
				}
			} elseif ( ! empty( $picapp_gallery ) ) {
				add_filter('posts_where', array(&$this, 'filter_posts_where_gallery'));
				query_posts(array(
					'name' => $picapp_gallery,
					'post_type' => 'picapp_gallery', // want "picapp_gallery"
				));
				remove_filter('posts_where', array(&$this, 'filter_posts_where_gallery'));
				global $wp_query;
				$wp_query->is_attachment = true;
				/*
				if ( have_posts() ) {
					the_post();
					global $post;
					wp_redirect(get_permalink($post->post_parent));
					exit;
				}
				*/
			} elseif ( ! empty( $picapp_gallery_id ) ) {
				add_filter('posts_where', array(&$this, 'filter_posts_where_gallery'));
				add_filter('the_content', array(&$this, 'filter_the_content_gallery'), 99);
				query_posts(array(
					'p' => $picapp_gallery_id,
					'post_type' => 'picapp_gallery',
				));
				remove_filter('posts_where', array(&$this, 'filter_posts_where_gallery'));
				global $wp_query;
				$wp_query->is_attachment = true;
			}
		}
	}

	function event_wp_head() 
	{
		?>
		<style type="text/css">
			.picapp-gallery-wrap {
				margin:0 auto;
				text-align:center;
			}
			.picapp-gallery-row {
				clear:both;
			}

			.picapp-gallery-row:after {
				clear:both;
				content:'.';
				display:block;
				height:0;
				visibility:hidden;
			}

			.picapp-gallery-image {
				display:block;
				float:left;
				margin:5px;
			}
		</style>
		<?php
	}

	/**
	 * Callback filter for TinyMCE plugins.
	 * @param array $plugins The array of plugins.
	 * @return array The array of plugins, including the PicApp one.
	 */
	function filter_mce_external_plugins($plugins = array())
	{
		$plugins['PicappGallery'] = $this->url  . 'js/picapp-gallery-tinymce-plugin.js';
		return $plugins;
	}

	function filter_posts_where_gallery($where = '')
	{
		global $wpdb;
		return str_replace("$wpdb->posts.post_type = 'post'", "$wpdb->posts.post_type = 'picapp_gallery'", $where);
	}

	function filter_posts_where_gallery_item($where = '')
	{
		global $wpdb;
		return str_replace("$wpdb->posts.post_type = 'post'", "$wpdb->posts.post_type = 'gallery_item'", $where);
	}

	/**
	 * Fix a shortcode parsing problem that WordPress has with shortcodes on the same line, by adding line breaks around them.
	 * @param string $content The content of the post
	 * @return string The content of the post.
	 */
	function filter_the_content($content = '')
	{
		return preg_replace('/\[picappgallery(single)?[^\]]*]/', "\n$0\n", $content);
	}

	/**
	 * Filter the content of a post to show a gallery, when appropriate.
	 * @param string $content The post content (just placeholder text, if a gallery object)
	 * @return string The markup of the gallery.
	 */
	function filter_the_content_gallery($content) 
	{
		global $post;

		if ( empty($post->post_type) || $post->post_type != 'picapp_gallery' )
			return $content;

		@ob_start();
		$this->print_gallery($post->ID);
		$content = ob_get_contents();
		ob_end_clean();
		return $content;
	}

	function filter_the_content_gallery_item($content)
	{
		global $post;

		if ( empty($post->post_type) || $post->post_type != 'gallery_item' )
			return $content;

		$images = $this->get_post_gallery_images($post->post_parent);
		$image = ( isset( $images[$post->ID] ) ) ? $images[$post->ID] : null;
		if ( empty( $image ) ) {
			return $content;
		}

		$assoc = array();
		foreach( $images as $_image ) {
			$assoc[] = $_image->image_id;
		}

		$markup = '[picappgallerysingle]';
		$template = get_query_template('picapp-gallery-template');

		if ( '' != $template && file_exists($template) ) {
			ob_start();
			@include $template;
			$markup = ob_get_contents();
			ob_end_clean();
		// if the template file isn't being used, use the one in the plugin
		} elseif ( file_exists( trailingslashit(dirname(__FILE__)) . 'picapp-gallery-template.php' ) ) {
			ob_start();
			@include trailingslashit(dirname(__FILE__)) . 'picapp-gallery-template.php';
			$markup = ob_get_contents();
			ob_end_clean();
		}

		$markup = str_replace(
			'[picappgallerysingle]', 
			$this->print_single_gallery_image_markup(array('image_id' => $image->image_id, 'assoc' => $assoc)),
			$markup
		);
		return $markup;

		/*

		$p = '<p class="attachment">';
		$p .= sprintf('<img src="%1$s" alt="%2$s" />', $image->image_full, htmlentities($image->image_title));
		$p .= '</p>';
		$p = apply_filters('prepend_attachment', $p); 

		return $p;
	
		*/
	}
	/**
	 * End event callbacks
	 */


	/**
	 * Post page's gallery methods
	 */
	
	
	/**
	 * Get the estimated dimensions of a gallery.  Used to make a placeholder object in TinyMCE
	 * @param int $gallery_id The id of the gallery whose dimensions we will calculate.
	 * @return array( horizonal, vertical ) dimensions of the gallery (estimated).
	 */
	function get_estimated_gallery_dimensions($gallery_id = 0)
	{
		$thumbnail_size = $this->thumbnail_dimension + 20; // add some theoretical padding
		$display_rows = get_post_meta($gallery_id, '_picapp_gallery_display_rows', true);
		$display_option = get_post_meta($gallery_id, '_picapp_gallery_display_option', true);

		$images = $this->get_post_gallery_images($gallery_id);
		$image_count = intval(@count($images));

		if ( $image_count < 1 ) 
			$image_count = 1;

		$height = 0;
		$width = 0;

		$cols = $image_count / $display_rows;
		if ( 1 > $cols )
			$cols = 1;

		$height = $display_rows * $thumbnail_size;
		$width = $cols * $thumbnail_size;

		// if not showing just thumbs, then we can assume the gallery will have a larger single image
		if ( 'thumbs' != $display_option ) {
			$height += 400;
		}
	
		return array($width, $height);
	}


	/**
	 * Retrieve the last search results, if they're available.
	 * @param int $user_id The user_id of the person currently logged in.
	 * @return array The array of search result query data.
	 */
	function get_last_search($user_id = 0)
	{
		if ( ! empty($_COOKIE['picappLastSearch']) ) {
			$possible_query = @maybe_unserialize(stripslashes($_COOKIE['picappLastSearch']));
			if ( ! empty( $possible_query ) && is_array( $possible_query ) ) {
				$possible_query['page'] = 1;
				return $possible_query;
			}
		}
		return array();
	}

	/**
	 * Retrieve data for a given post's gallery information
	 * @param int $post_id The id of the post for which we'll look up gallery information.
	 * @return array The array of gallery information.
	 */
	function get_post_galleries($post_id = 0)
	{
		if ( ! $galleries = wp_cache_get('_gallery_' . $post_id, '_picapp_post_gallery_attachments') ) {
			$galleries = get_posts(array(
				'post_parent' => $post_id,
				'post_status' => 'any',
				'post_type' => 'picapp_gallery',
			));

			// fill in gallery image information

			wp_cache_set('_gallery_' . $post_id, $galleries, '_picapp_post_gallery_attachments');
		}
		return $galleries;
	}

	/**
	 * Create a drop-down list of all galleries associated with a particular post.
	 * @param int $post_id The id of the post in question.
	 * @param int $current_gallery Optional. The id of the current gallery.
	 * @param bool Whether to print the dropdown.
	 * @return string The drop-down.
	 */
	function get_post_gallery_dropdown($post_id = 0, $current_gallery = false, $print = false) 
	{
		$m = '';
		$galleries = get_posts(array(
			'post_parent' => $post_id,
			'post_status' => 'any',
			'post_type' => 'picapp_gallery',
		));
	
		$m .= ' <label for="picapp-post-gallery-select">' . $this->__('Galleries for this post:') . '</label> ';

		$m .= '<select name="picapp-post-gallery-select" id="picapp-post-gallery-select">' . "\n";

		// if there are galleries, by default we will select one
		foreach( (array) $galleries as $gallery ) {
			$selected = ( $current_gallery == $gallery->ID ) ? ' selected="selected"' : '';
			$title = ( empty( $gallery->post_title ) ) ? sprintf($this->__('Gallery ID %d'), $gallery->ID) : $gallery->post_title;
			$m .= "\t<option value=\"{$gallery->ID}\" {$selected}>{$title}</option>\n";
		}

		$selected = ( 0 === $current_gallery ) ? ' selected="selected"' : '';
		$m .= "\t<option value=\"0\"{$selected}>" . $this->__('Create a new gallery') . "</option>\n";
		
		$m .= '</select>' . "\n";

		if ( true === $print ) {
			echo $m;
		}
		return $m;
	}

	/**
	 * Get the information about the images associated with a gallery
	 * @param int $gallery_id The id of the gallery
	 * @return array The array of post gallery image object information.
	 */
	function get_post_gallery_images($gallery_id = 0)
	{
		if ( ! $images = wp_cache_get('_gallery_images_' . $gallery_id, '_picapp_gallery_attachment_data') ) {
			$images = get_children(array('post_parent' => $gallery_id, 'order' => 'ASC', 'orderby' => 'menu_order', 'post_type' => 'gallery_item'));
			foreach( (array) $images as $image ) {
				if ( ! isset( $image ) || ! isset( $image->ID ) ) {
					continue;
				}
				$images[$image->ID]->image_id = get_post_meta($image->ID, '_picapp_image_id', true);
				$images[$image->ID]->image_desc = ( isset( $image->post_content ) ) ? $image->post_content : '';
				$images[$image->ID]->image_full = get_post_meta($image->ID, '_picapp_image_full', true);
				$images[$image->ID]->image_height = get_post_meta($image->ID, '_picapp_image_height', true);
				$images[$image->ID]->image_thumb = get_post_meta($image->ID, '_picapp_image_thumb', true);
				$images[$image->ID]->image_thumbheight = get_post_meta($image->ID, '_picapp_image_thumbheight', true);
				$images[$image->ID]->image_thumbwidth = get_post_meta($image->ID, '_picapp_image_thumbwidth', true);
				$images[$image->ID]->image_width = get_post_meta($image->ID, '_picapp_image_width', true);
				$images[$image->ID]->image_title = ( isset( $image->post_title ) ) ? $image->post_title : '';
			}
			wp_cache_set('_gallery_images_' . $gallery_id, $images, '_picapp_gallery_attachment_data');
		}
		return $images;
	}

	function postbox_wrap()
	{
		?>
		<div id="picapp-postbox-wrap" class="inside">	
			<?php // $this->postbox(); ?>
		</div><!-- #picapp-postbox-wrap -->
		<?php 
	}

	/**
	 * Return the markup for the inside of the gallery box
	 * @param array $qry The search query array.
	 * @return string The markup for the gallery box.
	 */
	function postbox($qry = array()) 
	{
		
		$post_id = intval($qry['post_id']);
		$gallery_palette = $this->__('Drag and drop images here');

		$user_data = wp_get_current_user();
		$users_last_search_term = get_usermeta($user_data->ID, '_picapp_last_search_term');
		$users_last_search_term = ( empty( $users_last_search_term ) ) ? '*' : $users_last_search_term;
		$last_search_term = ( ! empty( $qry['term'] ) ) ? $qry['term'] : $users_last_search_term;
		$last_search_term = ! is_string( $last_search_term ) ? '' : $last_search_term;
		$search_results_page = ( ! empty( $qry['page'] ) ) ? intval($qry['page']) : 1;
		?><div id="picapp-postbox">
			<?php if ( ! defined('PICAPP_GALLERY_SIMPLE') || false == PICAPP_GALLERY_SIMPLE ) : ?>
			<div id="picapp-gallery-palette">
				<?php // $this->print_gallery_palette($post_id); ?>
			</div>
			<?php endif; ?>

			<div id="picapp-gallery-browse">
				<div class="search-section">
					<h4 id="search-response-message"></h4>
				</div>
				<div class="search-section">
					<div id="search-box-wrap">
						<input type="text" name="picapp-search-key-term" id="picapp-search-key-term" value="<?php echo htmlentities($last_search_term); ?>" />
						<button type="submit" id="picapp-search-submit" name="picapp-search-submit"><?php $this->_e('Search'); ?></button>
					</div>

					<div id="search-radio-wrap">
						<label id="picapp-editorial-label"><input type="radio" checked="checked" id="picapp-search-type-editorial" name="picapp-search-type" value="editorial" /> <?php $this->_e('Editorial'); ?></label>
						<label id="picapp-creative-label"><input type="radio" id="picapp-search-type-creative" name="picapp-search-type" value="creative" /> <?php $this->_e('Creative'); ?></label>
					</div>

					<?php if ( ! defined('PICAPP_GALLERY_SIMPLE') || false == PICAPP_GALLERY_SIMPLE ) : ?>
					<div id="search-gallery-toggle-wrap">
						<a href="#" id="search-gallery-toggle"><?php $this->_e('Create Gallery'); ?></a>
					</div>
					<?php endif; ?>
				</div>

				<div class="search-section">
					<input type="hidden" name="picapp-search-results-page" value="<?php echo $search_results_page; ?>" />
					<div id="picapp-search-results">
						<?php $this->search_results_markup($qry); ?>
					</div><!-- #picapp-search-results -->
				</div>

			</div>

		</div><!-- #picapp-postbox -->
		<?php
	}

	/**
	 * Print the gallery on a public-facing page.
	 * @param int $gallery_id The id of the gallery to print
	 */
	function print_gallery($gallery_id = 0)
	{
		$picapp_data = new PicApp_Data();

		$display_rows = get_post_meta($gallery_id, '_picapp_gallery_display_rows', true);
		$display_option = get_post_meta($gallery_id, '_picapp_gallery_display_option', true);

		$images = $this->get_post_gallery_images($gallery_id);
		$gallery_data = get_post($gallery_id);
		$gallery_title = get_the_title($gallery_id);
 
		// $link_format = $picapp_data->get('image_link_format');
		$link_format = get_option('home') . '/picapp-gallery/' . $gallery_data->post_name . '/%s/%d/';

		$top_image = $bottom_image = null;

		if ( 'top' == $display_option )
			$top_image = array_shift($images);
		elseif ( 'bottom' == $display_option )
			$bottom_image = array_pop($images);

		$image_count = intval(@count($images));

		$cols = round( ( 0 < $display_rows ) ? $image_count / $display_rows : 1 );

		if ( ! empty( $images ) ) : 

			?>
			<div class="picapp-gallery-wrap" id="picapp-gallery-<?php echo $gallery_id; ?>">
			<h3 class="picapp-gallery-title"><?php echo $gallery_title ?></h3>
			<?php

			if ( ! empty( $top_image ) ) :
				?>
				<div class="picapp-gallery-featured-image top-image picapp-gallery-image picapp-image-id-<?php echo $top_image->image_id; ?>">
				<?php
					$title = htmlentities($top_image->post_title);
					$thumb = $top_image->image_thumb;
					echo '<a href="' . sprintf($link_format, $image->post_name, $top_image->image_id) . '" class="picapp-gallery-single-link">';
					echo "<img src='{$top_image->image_full}' title='{$title}' alt='{$title}' />";
					echo '</a>';
				?>
				</div><!-- .picapp-gallery-featured-image -->
				<?php 
			endif;
			
			if ( ! empty( $images ) ) :
				// get max width and height of thumbnails
				$heights = array();
				$widths = array();

				foreach( (array) $images as $image ) {
					$heights[] = $image->image_thumbheight;
					$widths[] = $image->image_thumbwidth;
				}

				$min = min(array(min($heights), min($widths)));

				?>
				<div class="picapp-gallery-main">
				<?php
				$count = 0;
				?><div class="picapp-gallery-row">
				<?php 
				foreach( (array) $images as $image ) :
//					$link = sprintf($link_format, $image->image_id);
					$link = sprintf($link_format, $image->post_name, $image->image_id);
					if ( 0 < $count && 0 == ( $count % $cols ) ) :
						?>
						</div><!-- .picapp-gallery-row -->
						<div class="picapp-gallery-row">
						<?php 
					endif;

					// if wider than tall
					if ( $image->image_thumbwidth == max($image->image_thumbwidth, $image->image_thumbheight) ) {
						$width = $min;
						$height = ( 0 < $image->image_thumbwidth ) ? 
							$width * ( $image->image_thumbheight / $image->image_thumbwidth ) :
							null;
						$padding = ( $width - $height ) / 2;
					// taller than wide
					} else {
						$height = $min;
						$width = ( 0 < $image->image_thumbheight ) ? 
							$height * ( $image->image_thumbwidth / $image->image_thumbheight ) :
							null;
						$padding = 0;
					}

					?><div class="picapp-gallery-image picapp-image-id-<?php echo $image->image_id; ?>" style="<?php
						echo "width:{$min}px;height:{$min}px;padding-top:{$padding}px;";
					?>">
					<?php 
						$title = htmlentities($image->post_title);
						$src = $image->image_thumb;
						$dimens = "style='";
						if ( ! empty( $height ) ) 
							$dimens .= "height:{$height}px;";
						if ( ! empty( $width ) )
							$dimens .= "width:{$width}px;";
						$dimens .= "'";

						echo "<a href='{$link}' class='picapp-gallery-single-link'><img src='{$src}' title='{$title}' alt='{$title}' {$dimens} /></a>\n";
					?></div><!-- .picapp-gallery-image -->
					<?php 

					$count++;
				endforeach;
				?></div><!-- .picapp-gallery-row -->
				</div><!-- .picapp-gallery-main-->
				<?php 
			endif;

			if ( ! empty( $bottom_image ) ) :
				?>
				<div class="picapp-gallery-featured-image bottom-image picapp-gallery-image picapp-image-id-<?php echo $bottom_image->image_id; ?>">
				<?php
					$title = htmlentities($bottom_image->post_title);
					$thumb = $bottom_image->image_thumb;
					echo "<img src='{$bottom_image->image_full}' title='{$title}' alt='{$title}' />";
				?>
				</div><!-- .picapp-gallery-featured-image -->
				<?php 
			endif;

			?>
			<div class="powered-by-picapp"><?php $this->_e('powered by <a target="_blank" href="http://www.picapp.com">PicApp</a>'); ?></div>
			<script type="text/javascript">
			//<![CDATA[
			if ( ! window.picappGalleries || ! picappGalleries )
				var picappGalleries = [];
			picappGalleries[picappGalleries.length] = 'picapp-gallery-<?php echo $gallery_id; ?>';
			//]]>
			</script>
			</div><!-- .picapp-gallery-wrap -->
			<?php 
		endif; // ! empty images	
	}
	
	/**
	 * Print the gallery palette on the admin post page.
	 * @param int $post_id The id of the post for which to print this gallery
	 */
	function print_gallery_palette($post_id = 0, $gallery_id = false)
	{
		$post_id = intval($post_id);
		$galleries = $this->get_post_galleries($post_id);
		if ( 0 !== $gallery_id && ! empty( $galleries ) ) {
			if ( false !== $gallery_id ) {
				$gallery_id = intval($gallery_id);
				foreach( (array) $galleries as $gallery ) {
					if ( isset( $gallery->ID ) && $gallery->ID == $gallery_id ) {
						break;
					}
				}
			} else {
				$gallery = array_shift($galleries);
			}
			$gallery_id = ( isset( $gallery->ID ) ) ? $gallery->ID : 0;
			$gallery_title = ( isset( $gallery->post_title ) ) ? 
				$gallery->post_title : '';
			$thumbs = $this->get_post_gallery_images($gallery_id);
		} else {
			$gallery_id = 0;
			$gallery_title = '';
			$thumbs = array();
		}
		$display_rows = get_post_meta($gallery_id, '_picapp_gallery_display_rows', true);
		$gallery_display_option = get_post_meta($gallery_id, '_picapp_gallery_display_option', true);
		$gallery_display_option = empty( $gallery_display_option ) ? 'thumbs' : $gallery_display_option;
		?>
		<div class="gallery-section">
			<strong><?php $this->_e('Content:'); ?></strong> <label for="gallery-title"><?php $this->_e('Gallery Title'); ?> <input type="text" name="gallery-title" id="gallery-title" value="<?php echo htmlentities($gallery_title); ?>" /></label>
		</div>

		<div class="gallery-section gallery-section-options">
			<strong id="gallery-display-label"><?php $this->_e('Display:'); ?></strong>

			<div id="gallery-display-options">
				<label id="gallery-display-thumbs-wrap"><input type="radio" name="gallery-display-option" id="gallery-display-thumbs" value="thumbs" <?php 
				if ( 'thumbs' == $gallery_display_option ) {
					echo ' checked="checked"';
				} 
				?>/> <span class="label-text"><?php $this->_e('Thumbnails'); ?></span></label>
				<label id="gallery-display-top-wrap"><input type="radio" name="gallery-display-option" id="gallery-display-top" value="top" <?php 
				if ( 'top' == $gallery_display_option ) {
					echo ' checked="checked"';
				} 
				?>/> <span class="label-text"><?php $this->_e('Top'); ?></span></label>
				<label id="gallery-display-bottom-wrap"><input type="radio" name="gallery-display-option" id="gallery-display-bottom" value="bottom" <?php 
				if ( 'bottom' == $gallery_display_option ) {
					echo ' checked="checked"';
				} 
				?>/> <span class="label-text"><?php $this->_e('Bottom'); ?></span></label>
			</div>

			<div id="gallery-display-rows-wrap">
				<label for="gallery-display-rows"><?php $this->_e('Rows:'); ?>
					<select name="gallery-display-rows" id="gallery-display-rows">
						<?php $i = 0; while ( 10 > $i ) : $i++; ?>
						<option value="<?php echo $i; ?>" <?php 
							if ( $display_rows == $i ) {
								echo ' selected="selected"';
							}
						?>><?php echo $i; ?></option>
						<?php endwhile; ?>
					</select>
				</label>
			</div>

			<div id="gallery-dropdown-wrap">
				<?php do_action('post_gallery_dropdown', $post_id, $gallery_id, true); ?>
			</div>

		</div>

		<div class="gallery-section">
			<div id="gallery-palette">
				<?php if ( ! empty( $thumbs ) ) : 
					foreach( (array) $thumbs as $imageId => $thumb ) : 
						$thumbnail = array();
						$thumbnail['imageId'] = ( ! empty( $thumb->image_id ) ) ? $thumb->image_id : 0;
						$thumbnail['imageWidth'] = ( ! empty( $thumb->image_width ) ) ? $thumb->image_width : 0;	
						$thumbnail['imageHeight'] = ( ! empty( $thumb->image_height ) ) ? $thumb->image_height : 0;	
						$thumbnail['imageTitle'] = ( ! empty( $thumb->image_title ) ) ? $thumb->image_title : '';	
						$thumbnail['description'] = ( ! empty( $thumb->image_desc ) ) ? $thumb->image_desc : '';	
						$thumbnail['thumbnailWidth'] = ( ! empty( $thumb->image_thumbwidth ) ) ? $thumb->image_thumbwidth : 0;	
						$thumbnail['thumbnailHeight'] = ( ! empty( $thumb->image_thumbheight ) ) ? $thumb->image_thumbheight : 0;	
						$thumbnail['urlImageThumnail'] = ( ! empty( $thumb->image_thumb ) ) ? $thumb->image_thumb : '';
						$thumbnail['urlImageFullSize'] = ( ! empty( $thumb->image_thumb ) ) ? $thumb->image_full : '';

						$this->print_thumbnail_wrapper($thumbnail);
					endforeach;
				endif; 
				?>
				<span id="gallery-palette-instructions"><?php $this->_e('Drag and drop images here'); ?></span>
				<?php
				?>
			</div>
		</div>

		<div class="gallery-section">
			<div id="gallery-buttons-wrap">
				<button id="gallery-cancel" class="button button-secondary"><?php $this->_e('Cancel'); ?></button>
				<button id="gallery-clear" class="button button-secondary"><?php $this->_e('Clear'); ?></button>
				<button id="gallery-preview" class="button button-secondary"><?php $this->_e('Preview'); ?></button>
				<button id="gallery-embed" class="button button-primary"><?php $this->_e('Embed'); ?></button>
			</div>
		</div>
		<?php 
	}

	/**
	 * Return a gallery single item's markcup, which involves the custom PicApp script.
	 * @param string $single_id The PicApp image id.
	 * @param string $align Alignment, if applicable.
	 */
	function print_gallery_single($single_id = '', $align = '') 
	{
		global $wpdb;
		$meta_key = '_picapp_image_script_' . $single_id;
		$script = $wpdb->get_var($wpdb->prepare("SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s LIMIT 1", $meta_key));

		$pattern = empty( $align ) ? '<div>%s</div>' : '<div class="align' . $align . '">%s</div>';	

		return sprintf($pattern, $script);
	}

	/**
	 * Get the markup for a single gallery image.
	 * @param array $params The array of arguments.
	 * @return string The markup for a single gallery image.
	 */
	function print_single_gallery_image_markup($params = array())
	{
		$defs = array(
			'image_id' => 0, // The id of the image to print.
			'assoc' => array(), // Image IDs to associate with this image.  These IDs are passed to the PicApp server to generate related thumbnails.
		);

		$params = array_merge($defs, $params);

		$location = 'http://';
		$image_id = $params['image_id'];
		$tpid = ( ! empty( $params['assoc'] ) ) ? '&tpid=' . implode(';', $params['assoc']) : '';
		$term = '';

		$src = urlencode('term=' . $term . '&rurl=' . $location . '&iid=' . $image_id . $tpid);
		$markup = '<iframe src="http://view.picapp.com/fox/default.aspx?' . $src . '" width="633" scrolling="no" height="1020" frameborder="0"></iframe>';
		return $markup;
	}

	function print_thumbnail_wrapper($imageinfo = array())
	{
		$dimension = $this->search_thumbnail_dimension;
		if ( 	isset( $imageinfo['urlImageDefinedThumbnails'] ) &&
			isset( $imageinfo['urlImageDefinedThumbnails']['imagethumbnails'] ) &&
			is_array( $imageinfo['urlImageDefinedThumbnails']['imagethumbnails'] ) &&
			isset( $imageinfo['urlImageDefinedThumbnails']['imagethumbnails'][1] )
		) {
			$imageinfo['urlImageThumnail'] = $imageinfo['urlImageDefinedThumbnails']['imagethumbnails'][1];
			$imageinfo['thumbnailHeight'] = $imageinfo['thumbnailWidth'] = 75;
		}
		$orientation = ( $imageinfo['thumbnailHeight'] > $imageinfo['thumbnailWidth'] ) ? 'v' : 'h';
		?>
		<div class="picapp-thumb-wrapper" id="picapp-thumb-wrapper-<?php echo $imageinfo['imageId']; ?>">
			<?php
			if ( ! empty( $imageinfo['thumbnailWidth'] ) && ( $imageinfo['thumbnailWidth'] > $imageinfo['thumbnailHeight'] ) ) {
				$new_width = $dimension;
				$new_height = ( 0 != intval($imageinfo['thumbnailWidth']) ) ? intval( $dimension * ( intval($imageinfo['thumbnailHeight']) / intval($imageinfo['thumbnailWidth']) ) ) : $dimension;
				$top_padding = ( $dimension - $new_height ) / 2;
				$left_padding = 0;
			} else {
				$new_height = $dimension;
				$new_width = ( 0 != intval($imageinfo['thumbnailHeight']) ) ? intval( $dimension * ( intval($imageinfo['thumbnailWidth']) / intval($imageinfo['thumbnailHeight']) ) ) : $dimension;
				$left_padding = ( $dimension - $new_width ) / 2;
				$top_padding = 0;
			}
			$a_style = "margin: {$top_padding}px auto;";
			$img_style = "width: {$new_width}px; height: {$new_height}px; margin: 0px;";
			?><a style="<?php echo $a_style; ?>" href="<?php echo get_bloginfo('wpurl') . '/wp-admin/?picapp-image-detail=' . $imageinfo['imageId']; ?>" id="picapp-thumb-link-<?php echo $imageinfo['imageId']; ?>" class="picapp-thumb-link" rel="<?php echo $imageinfo['urlImageFullSize']; ?>">
				<img alt="" title="<?php echo attribute_escape($imageinfo['imageTitle']); ?>" src="<?php echo $imageinfo['urlImageThumnail']; ?>" id="picapp-thumb-<?php echo $imageinfo['imageId']; ?>" class="<?php 
			echo "$orientation h-{$imageinfo['imageHeight']} th-{$imageinfo['thumbnailHeight']} w-{$imageinfo['imageWidth']} tw-{$imageinfo['thumbnailWidth']} picapp-thumb-image"; 
			
			?>" style="<?php echo $img_style; ?>" />
			</a>
			<div class="picapp-thumb-description"><?php echo $imageinfo['description']; ?></div>
			<a href="#" class="picapp-thumb-remove-link" title="<?php $this->_e('Click to remove this image from the gallery'); ?>">X</a>

		</div>
		<?php
	}

	/**
	 * Prints the markup for the thumbnail image search results
	 *
	 * $qry can have the following parameters:
	 * 'page' - The page of these results
	 * 'term' - The term searched for these results.  Default is '*'
	 * 'totalrecords' - The total number of records returned
	 *
	 * @uses this::get_last_search()
	 * @uses PicApp_Search_Terms::save_search_term
	 * @param array $qry The search qry values in an associative array
	 * @param array $data An array of search data from the PicApp API
	 */
	function search_results_markup($qry = array(), $data = array())
	{
		// try the last search or go with default, when the search term is missing
		if ( empty( $qry['term'] ) || ! is_string($qry['term']) ) {
			$qry = $this->get_last_search();
			if ( empty( $qry['term'] ) ) {
				$qry['term'] = '*';
			}
		}

		//

		// create a search query
		if ( ! empty( $qry ) ) {
			// totalrecords is the number of records to show per page, not to be confused with
			// totalRecords, which is the return overall total number of images.
			$show_per_page = $qry['totalrecords'] = ( empty( $qry['totalrecords'] ) ) ? 24 : $qry['totalrecords'];
			$api = $this->api();
			list($qry, $data) = $api->search($qry);
			$this->search_term_api->save_search_term($qry['term']);
		}
		if ( isset( $data[0]['content']['totalRecords'] ) ) {
			$total = ( isset(  $data[0]['content']['totalRecords'] ) ) ? 
				(int) $data[0]['content']['totalRecords'] :
				0;
			$image_batch_count = ( isset( $data[0]['content']['ImageInfo'] ) ) ?
				(int) count($data[0]['content']['ImageInfo']) :
				'';
			$image_batch_page = (int) $qry['page'];
			$last = ( $image_batch_page - 1 ) * $qry['totalrecords'];
			$range = $last + $image_batch_count;
			$first = ( 0 == $range ) ? 0 : $last + 1;
			$results = sprintf($this->__('%1$d-%2$d of %3$s'),
				$first,
				$range,
				number_format($total)

			);

			// assemble the page links
			$current_page_in_list = $image_batch_page % $this->page_list_count;
			$current_page_in_list = ( 0 == $current_page_in_list ) ? $this->page_list_count : $current_page_in_list;
			$page_list = array();
			if ( 1 < $image_batch_page ) {
				$page_list[] = sprintf($this->__('<a href="%s" class="previous-page gallery-page-nav-link link-to-page-%d">&lt; Previous Page</a>'), $this->search_results_page_link($image_batch_page - 1, $qry), $image_batch_page - 1);
			}

			$page_list[] = $results;

			/**
			 * commenting out more specific paging because not in spec
			 
			$listed_page = $image_batch_page - $current_page_in_list + 1;
			$i = 0;
			while( ( $i < $this->page_list_count ) && ( $listed_page <= ( $total / $show_per_page ) ) ) {
				$text = ( $listed_page === $image_batch_page ) ?
					'%2$d' :
					$this->__('<a href="%1$s" class="gallery-page-nav-link link-to-page-%2$d" title="Page %2$d">%2$d</a>');
				$page_list[] = sprintf($text, $this->search_results_page_link($listed_page, $qry), $listed_page);
				$i++;
				$listed_page++;
			}

			 *
			 **/

			if ( ( $image_batch_page ) < ( $total / $show_per_page ) ) {
				$page_list[] = sprintf($this->__('<a href="%s" class="next-page gallery-page-nav-link link-to-page-%d">Next Page &gt;</a>'), $this->search_results_page_link($image_batch_page + 1, $qry), $image_batch_page + 1);
			}

			?>
			<div id="picapp-search-results-wrap" class="picapp-search-results-wrap">
				<div class="picapp-search-results-thumbs" id="picapp-search-results-thumbs">
					<?php foreach( (array) $data[0]['content']['ImageInfo'] as $imageinfo ) :
						$this->print_thumbnail_wrapper($imageinfo);
					endforeach; ?>
				</div> <!-- .picapp-search-results-thumbs -->
				<div class="picapp-search-results-footer" id="picapp-search-results-footer">
					<div class="paging-links"><?php echo implode('<span class="paging-sep"> | </span>', $page_list); ?></div>
					<div class="meta-links">
						<?php
							$link_data = new PicApp_Data();
							$links = array(
								$link_data->get('help_link') => $this->__('Help'),
								$link_data->get('rules_link') => $this->__('Rules'),
								$link_data->get('blog_link') => $this->__('Blog'),
								$link_data->get('contact_link') => $this->__('Contact'),
							);

							$links_final = array();

							foreach( $links as $url => $text ) {
								$links_final[] = sprintf('<a target="_blank" href="%1$s" title="%2$s">%3$s</a>',
									$url,
									htmlentities($text),
									$text
								);
							}

							echo implode(' | ', $links_final);
						?>
					</div>
				</div> <!-- .picapp-search-results-footer -->
			</div> <!-- .picapp-search-results-wrap -->
			<?php
		} else {
			?><div id="picapp-search-results-wrap" class="picapp-search-results-wrap">
			</div><?php 
			return;
		}
	}

	/**
	 * Generate the link for the search results page
	 * @param int $page_num The page number
	 * @param array $qry The original search query
	 */
	function search_results_page_link($page_num = 1, $qry = array())
	{
		foreach ( $qry as $key => $value ) {
			if ( ! empty( $value ) && ! in_array($key, array('apikey', 'login', 'page', 'password', 'picapp-ajax', 'picapp-search-results-page', 'username')) ) {
				$new_qry['picapp-search-key-' . $key] = $value;
			}
		}
		$args = array_merge($new_qry, array('picapp-get-postbox' => 1, 'picapp-search-results-page' => $page_num));
		return add_query_arg($args, remove_query_arg(array('picapp-ajax', 'picapp-search-results'), $_SERVER['REQUEST_URI']));
	}

	/**
	 * end post page's gallery methods
	 */

	function gallery_shortcode( $attributes = array() )
	{
		extract(shortcode_atts(array(
			'id' => 0,
		), $attributes ));
		
		if ( ! empty( $id ) ) {
			return $this->print_gallery($id);
		}
	}

	function single_shortcode( $attributes = array() )
	{
		extract(shortcode_atts(array(
			'align' => '',
			'id' => 0,
		), $attributes ));
		
		if ( ! empty( $id ) ) {
			return $this->print_gallery_single($id, $align);
		}
	}

	/**
	 * Access the PicApp_WP_API object
	 * 
	 * @uses PicApp_User_Handling::get_userdata
	 *
	 * @return $api object
	 */
	function &api() {
		if ( ! is_object( $this->api ) ) {
			require_once 'includes/picapp-api.php';
			// get user data
			$userdata = $this->user_api->get_userdata($this->user_api->check_cookie());
			$userdata['pass'] = ( ! empty( $userdata['pass'] ) ) ? $userdata['pass'] : '';
			$userdata['userName'] = ( ! empty( $userdata['userName'] ) ) ? $userdata['userName'] : '';
			$this->api = new PicApp_WP_API($userdata['userName'], $userdata['pass']);
		}
		return $this->api;
	}

}

class PicApp_Search_Terms {

	function PicApp_Search_Terms()
	{
		return $this->__construct();
	}

	/**
	 * Initialize this object by registering its taxonomy
	 */
	function __construct()
	{
		register_taxonomy( 'picapp_q', 'user', array('hierarchical' => false, 'rewrite' => false, 'query_var' => false) );
	}

	/**
	 * Prints an auto-suggest for searches
	 *
	 * @param string $term The term searched
	 */
	function autosuggest($term = '') {
		$suggests = get_terms(
			array(
				'category', 
				'post_tag', 
				'picapp_q'
			), 
			
			array(
				'fields' => 'names', 
				'hide_empty' => false, 
				'name__like' => $term, 
				'orderby' => 'count', 
				'order' => 'DESC')
			);
		if ( is_array($suggests) ) {
			echo implode("\n", $suggests);
		}
		return;
	}

	function save_search_term($term = '') {
		if ( empty( $term ) || '*' === $term ) {
			return false;
		}
 		$user = wp_get_current_user();
 		$results = wp_set_object_terms($user->ID, array($term), 'picapp_q', true);
		wp_update_term_count(array($results), 'picapp_q');
	}
}


/**
 * User control methods
 */
class PicApp_User_Handling {

	function PicApp_User_Handling()
	{
		return $this->__construct();
	}

	function __construct()
	{
		register_taxonomy( 'picapp_userdata', 'user', array('hierarchical' => false, 'rewrite' => false, 'query_var' => false) );
	}


	/**
	 * Sets up the user with a cookie
	 * @param string $user The username for the cookie
	 * @return bool Whether the cookie-giving was successful
	 */
	function assign_cookie($user = '', $remember = false) {
		if ( $remember ) {
			$expiration = $expire = time() + 1209600;
		} else {
			$expiration = time() + 172800;
			$expire = 0;
		}

		$key = wp_hash($user . '|' . $expiration);
		$hash = hash_hmac('md5', $user . '|' . $expiration, $key);

		$cookie = $user . '|' . $expiration . '|' . $hash;

		setcookie('picappUser', $cookie, $expire, COOKIEPATH, COOKIE_DOMAIN);
		if ( COOKIEPATH != SITECOOKIEPATH )
			setcookie('picappUser', $cookie, $expire, SITECOOKIEPATH, COOKIE_DOMAIN);
	}

	/**
	 * Check the current user's cookie
	 *
	 * @uses this::get_userdata
	 *
	 * @param string $cookie The name of the cookie to check
	 * @return string|bool Returns the username if cookie checks out; otherwise, return false
	 */
	function check_cookie($cookie = '') {
		if ( empty($cookie) ) {
			if ( empty($_COOKIE['picappUser']) )
				return false;
			$cookie = $_COOKIE['picappUser'];
		}

		$cookie_elements = explode('|', $cookie);
		if ( count($cookie_elements) != 3 )
			return false;

		list($username, $expiration, $hmac) = $cookie_elements;

		$expired = $expiration;

		// Allow a grace period for POST and AJAX requests
		if ( defined('DOING_AJAX') || 'POST' == $_SERVER['REQUEST_METHOD'] )
			$expired += 3600;

		// Quick check to see if an honest cookie has expired
		if ( $expired < time() )
			return false;

		$key = wp_hash($username . '|' . $expiration);
		$hash = hash_hmac('md5', $username . '|' . $expiration, $key);

		if ( $hmac != $hash )
			return false;

		$userdata = $this->get_userdata($username);
		if ( ! $userdata )
			return false;

		return $userdata['userName'];
	}

	/**
	 * Delete the PicApp gallery cookies
	 */
	function delete_cookie() {
		setcookie('picappUser', ' ', time() - 31536000, COOKIEPATH, COOKIE_DOMAIN);
		setcookie('picappUser', ' ', time() - 31536000, SITECOOKIEPATH, COOKIE_DOMAIN);
		return true;
	}

	 /**
	  * Checks whether the current user is logged in to PicApp
	  * @return bool True if logged in; false if not.
	  */
	function is_picapp_logged_in() {
		$user = $this->check_cookie();
		if ( ! empty( $user ) ) {
			return true;
		}
		return false;
	 }

	/**
	 * Retrieve user data based on username
	 * @param string $username The username of the user for which to retrieve the data
	 * @return array Array of user data, such as 
	 * 	'userName', 'pass'
	 */
	function get_userdata($username = '') {
		$data = array();
		$username = sanitize_user($username);
		$user = get_term_by('name', $username, 'picapp_userdata');
		if ( ! is_wp_error($user) && ! empty( $user->description ) ) {
			$data = maybe_unserialize($user->description);
		}
		return $data;
	}
	
	/**
	 * Save user data
	 * @param string $username The username of the user to save
	 * @param array $data The array of data of the user.
	 * @return bool Whether the saving was successful.
	 */
	function save_userdata($username = '', $data = array()) {
		$username = sanitize_user($username);
		$existing_user = get_term_by('name', $username, 'picapp_userdata');
		
		$data_string = maybe_serialize($data);

		// the userdata doesn't exist, so let's save it
		if ( empty( $existing_user ) ) {
			$result = wp_insert_term( $username, 'picapp_userdata', array('description' => $data_string) );
		} else {
			$result = wp_update_term( $username, 'picapp_userdata', array('description' => $data_string) );
		}
		return ( ! is_wp_error($result) );
	}
}

class PicApp_Data {

	var $blog_link 		= 'http://blog.picapp.com';
	var $contact_link	= 'mailto:help@picapp.com';
	var $help_link 		= 'http://www.picapp.com/Faq.aspx';
	var $image_link_format	= 'http://view.picapp.com/default.aspx?iid=%s';
	var $pass_link 		= 'http://www.picapp.com/publicsite/ForgotPassword.aspx';
	var $picapp_home 	= 'http://www.picapp.com/'; // the url to PicApp home page
	var $register_link	= 'http://www.picapp.com/publicsite/RegisterAccount.aspx';
	var $rss_link 		= 'http://www.picapp.com/PUBLICSITE/Feed/%s.rss';
	var $rules_link 	= 'http://www.picapp.com/TermsAndCondition.aspx';

	/**
	 * Retrieve information about PicApp
	 * @param string $key The key name of the data to retrieve.
	 * @return string The data, retrieved.
	 */
	function get($key = '')
	{
		if ( ! empty( $this->$key ) ) {
			return $this->$key;
		}

	}
}

$picapp_factory = new PicApp_Factory();
