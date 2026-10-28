"""Retire the previous local demo URL; never accept credentials on this listener."""
from http.server import BaseHTTPRequestHandler, HTTPServer

class Redirect(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path if self.path.startswith('/') and not any(c in self.path for c in '\r\n') else '/'
        if path.startswith('/api/'):
            self.send_response(410)
            self.end_headers()
            return
        self.send_response(302)
        self.send_header('Location', 'http://127.0.0.1:8766' + path)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
    do_HEAD = do_GET
    def do_POST(self):
        self.send_response(410)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
    def log_message(self, *args):
        pass

HTTPServer(('127.0.0.1', 8765), Redirect).serve_forever()
