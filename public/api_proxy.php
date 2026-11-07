<?php
// Transparent reverse proxy fallback for Hostinger Apache environments without mod_proxy
$path = isset($_GET['path']) ? $_GET['path'] : '';
$backend_base = 'https://sciblueocean-api.163.61.44.41.sslip.io/api/';
$target_url = $backend_base . ltrim($path, '/');

$query_string = $_SERVER['QUERY_STRING'] ?? '';
// Strip path param from query string if present
parse_str($query_string, $params);
unset($params['path']);
$clean_qs = http_build_query($params);
if (!empty($clean_qs)) {
    $target_url .= (strpos($target_url, '?') === false ? '?' : '&') . $clean_qs;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = file_get_contents('php://input');

$headers = [];
foreach (getallheaders() as $name => $value) {
    $lower = strtolower($name);
    if (!in_array($lower, ['host', 'content-length', 'connection'])) {
        $headers[] = "$name: $value";
    }
}

$ch = curl_init($target_url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

if (!empty($input) && in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$resp_headers = substr($response, 0, $header_size);
$resp_body = substr($response, $header_size);

http_response_code($http_code);
foreach (explode("\r\n", $resp_headers) as $header_line) {
    $lower_line = strtolower($header_line);
    if (!empty($header_line) && !str_starts_with($lower_line, 'transfer-encoding:') && !str_starts_with($lower_line, 'content-length:')) {
        header($header_line, false);
    }
}

echo $resp_body;
