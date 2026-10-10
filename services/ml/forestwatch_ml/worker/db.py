import socket
import urllib.parse
import psycopg2
from psycopg2.extras import RealDictCursor
from ..config import settings

def get_db_connection():
    sslmode = 'require' if settings.database_ssl else 'prefer'
    parsed = urllib.parse.urlparse(settings.database_url)
    kwargs = {
        "cursor_factory": RealDictCursor,
        "sslmode": sslmode,
    }
    if parsed.hostname:
        kwargs["host"] = parsed.hostname
        try:
            kwargs["hostaddr"] = socket.gethostbyname(parsed.hostname)
        except Exception:
            pass
        if parsed.port:
            kwargs["port"] = parsed.port
        if parsed.username:
            kwargs["user"] = urllib.parse.unquote(parsed.username)
        if parsed.password:
            kwargs["password"] = urllib.parse.unquote(parsed.password)
        if parsed.path and len(parsed.path) > 1:
            kwargs["dbname"] = parsed.path[1:]
        return psycopg2.connect(**kwargs)
    return psycopg2.connect(settings.database_url, **kwargs)
