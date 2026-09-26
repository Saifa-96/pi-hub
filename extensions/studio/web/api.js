/* token 请求助手：页面 URL 带 ?token=，API 请求原样透传 */

export function api(path, options) {
	const token = new URLSearchParams(location.search).get("token") ?? "";
	const separator = path.includes("?") ? "&" : "?";
	return fetch(path + separator + "token=" + encodeURIComponent(token), options).then(function (response) {
		if (!response.ok) throw new Error("HTTP " + response.status);
		return response.json();
	});
}
