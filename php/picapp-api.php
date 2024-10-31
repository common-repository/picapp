<?php
/**
 * PicApp API for WordPress
 * @package phpass
 * @since 2.3
 * @version 1.1
 * @link http://watershedstudio.com/
 */

class PicApp_WP_API {

	var $endpt = 'http://api.picapp.com/Api/ws.asmx/';
	var $key = 'da4f60ab-5196-4b98-a375-f34694a7e09e';
	var $user;
	var $pass;

	function PicApp_WP_API($username = '', $password = '') {
		return $this->__construct($username, $password);
	}

	function __construct($username = '', $password = '') {
		$this->user = $username;
		$this->pass = $password;
	}

	function get($req = '') {
		require_once( ABSPATH . 'wp-includes/class-snoopy.php' );
		$snoopy = new Snoopy();
		$snoopy->fetch($req);

		if( $snoopy->status != '200' ){
			return new WP_Error('http_404', trim($snoopy->response_code));
		}
		return $snoopy->results;
	}

	function parse($text = '') {
		if ( ! is_string($text) ) {
			return false;
		}
		if ( ! class_exists('xml_simple') ) {
			require_once('xml-simple.php');
		}
		$parser = new xml_simple();
		$parser->parse($text);
		return $parser->tree;
	}

	/**
	 * Get details about an image
	 * @param string $imageid
	 * @return array Image details
	 */
	function image_details($imageid = '') {
		$get = $this->endpt . 'GetImageDetails?ApiKey=' . $this->key . '&ImageId=' . $imageid;
		$result = $this->parse($this->get($get));
		if ( ! empty( $result[0] ) && ! empty( $result[0]['content'] ) ) {
			return array( 'status' => true, 'data' => $result[0]['content'] );
		} elseif ( ! empty( $result[0] ) ) {
			return array( 'status' => false, 'data' => $result );
		}
	}


	function script($args = array()) {
		$defs = array(
			'apikey' => $this->key,
			'imageid' => '',
			'searchterm' => '',
			'email' => '',
			'imageframe' => '',
			'password' => $this->pass,
			'picaboo' => '',
			'size' => '',
			'trigger' => '',
			'username' => $this->user,
		);
		$allowed = array_keys($defs);
		$new_args = array();
		foreach( (array) $args as $key => $value ) {
			if ( in_array(strtolower($key), $allowed) ) {
				$new_args[strtolower($key)] = $value;
			}
		}
		$args = array_merge($defs, (array) $new_args);

		foreach( $args as $key => $value ) {
			$get .= "&$key=" . urlencode($value);
		}
		$get = $this->endpt . 'PublishImageWithSearchTerm?' . $get;
		$result = $this->parse($this->get($get));
		if ( ! empty( $result[0] ) && ! empty( $result[0]['name'] ) && 'PicAppTagDetails' == $result[0]['name'] ) {
			return array( 'status' => true, 'data' => $result[0]['content']['PicAppTag'], 'imageLocation' =>  $result[0]['content']['ImageLocation'] );
		} elseif ( ! empty( $result[0] ) ) {
			return array( 'status' => false, 'data' => $result[0] );
		}
	}

	/**
	 * Makes a PicApp search query
	 * @param array $args The array of arguments.  "term" is the only required argument.
	 * @return array An array of the final search args and the search data.
	 */

	function search($args = array(), $attempt = 0) {
		$attempt++;
		$key = md5( serialize( $args ) );
		if ( $cache = wp_cache_get( 'search_queries', 'picapp' ) ) {
			if ( isset( $cache[$key] ) ) {
				return $cache[$key];
			}
		}
		$defs = array(
			'apikey' => $this->key,
			'cats' => 'editorial',
			'clrs' => '',
			'login' => '',
			'mp' => '',
			'oris' => '',
			'page' => '',
			'password' => $this->pass,
			'post' => '',
			'sort' => '',
			'term' => '',
			'totalrecords' => 24,
			'types' => '',
			'username' => $this->user,
		);
		$get = '';
		$allowed = array_keys($defs);
		foreach( (array) $args as $key => $value ) {
			if ( ! in_array($key, $allowed) ) {
				unset($args[$key]);
			}
		}
		$args = array_merge($defs, (array) $args);

		// restrict options
		$args['cats'] = ( in_array(strtolower($args['cats']), array('all', 'creative', 'editorial')) ) ? $args['cats'] : '';
		$args['cats'] = ucwords($args['cats']);
		$args['page'] = ( (int) $args['page'] ) ? (int) $args['page'] : 1;
		$args['totalrecords'] = (int) $args['totalrecords'];

		foreach( $args as $key => $value ) {
			$get .= "&$key=" . urlencode($value);
		}
		$get = $this->endpt . 'Search?' . $get;
		$result = $this->parse($this->get($get));
		$return = array($args, $result);
		if ( ! empty( $result ) && is_array( $result ) ) {
			$cache[$key] = $return;
		} else {
			// try again a few more times if no response
			if ( 5 > $attempt ) {
				return $this->search($args, $attempt);
			}
		}
		wp_cache_set( 'search_queries', $cache, 'picapp' );
		return $return;
	}

	function verify_user($user = '', $pass = '') {
		$get = sprintf($this->endpt . 'CheckIfUserExist?username=%1$s&password=%2$s', $user, $pass);
		$result = $this->parse($this->get($get));
		if ( ! empty( $result[0] ) && ! empty( $result[0]['content'] ) && ! empty( $result[0]['content']['userName'] ) ) {
			return array( 'status' => true, 'data' => $result[0]['content'] );
		} elseif ( ! empty( $result[0] ) && ! empty( $result[0]['content'] ) ) {
			return array( 'status' => false, 'data' => $result[0]['content'] );
		}

	}
}
