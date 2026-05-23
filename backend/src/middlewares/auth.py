"""
Auth middleware — JWT token verification for protected routes.
Usage: apply @token_required decorator to any Flask route.
"""
import jwt
from functools import wraps
from flask import request, jsonify, current_app


def token_required(f):
    """
    Decorator that protects a Flask route with JWT authentication.
    Injects `current_user` as the first argument to the wrapped function.

    Example:
        @app.route('/api/patients')
        @token_required
        def get_patients(current_user):
            ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')

        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Authentication token is required'}), 401

        try:
            data = jwt.decode(
                token,
                current_app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
            # Attach user info to request context
            # TODO: Load actual user from DB using data['user_id']
            current_user = data
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)

    return decorated
