// Spotify API Integration:
export async function authorize(){
	let myHeaders = new Headers();
	var my_clientID = '03bbc4ece6d945009d5607c6958b26ac';
	var clientSecret = 'ecbaf00f9fd947ecac83a873e6a7e014';
	myHeaders.append("Authorization", 'Basic ' + btoa(my_clientID + ':' + clientSecret));
	myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
	var urlencoded = new URLSearchParams();
	urlencoded.append("grant_type", "client_credentials");

	const requestOptions = {
	method: 'POST',
	headers: myHeaders,
	body: urlencoded,
	redirect: 'follow'
	}

	let res = await fetch("https://accounts.spotify.com/api/token", requestOptions);
	res = await res.json();
	return res.access_token;
}

export async function search(title, art_name){
	const access_token = await authorize();
	//this.setState({access_token});
	const BASE_URL = 'https://api.spotify.com/v1/search';
	var track = 'track:' + title;
	var artist = 'artist:' + art_name;
	if (artist == 'artist:') {
		artist = '';
	}
	if (track == 'track:') {
		track = '';
	}
	let FETCH_URL = BASE_URL + '?q=' + track + '%20' + artist  + '&type=track&limit=1';
	//const ALBUM_URL = 'https://api.spotify.com/v1/artists';

	let myHeaders = new Headers();
	myHeaders.append("Authorization", `Bearer ${access_token}`);

	const requestOptions = {
		method: 'GET',
		headers: myHeaders
	}

	let res = await fetch(FETCH_URL, requestOptions);
	res = await res.json();
	let id = res.tracks.items[0].id;

	const BASE_URL_T = 'https://api.spotify.com/v1/audio-features/';
	let FETCH_URL_T = BASE_URL_T + id;

	myHeaders = new Headers();
	myHeaders.append("Authorization", `Bearer ${access_token}`);

	const requestOptions_T = {
		method: 'GET',
		headers: myHeaders
	}

	let res_T = await fetch(FETCH_URL_T, requestOptions_T);
	res_T = await res_T.json();
	return res_T;
}