/****************
Author: Tom Hackshaw
Date : 2025-12-21
Desc: Create necessary tables and procedures for guestbook
******************/

-- Create the guestbook_entries table
CREATE TABLE IF NOT EXISTS guestbook_entries (
	id SERIAL PRIMARY KEY,
	fediverse_username VARCHAR(500) NOT NULL,
	fediverse_instance VARCHAR(255) NOT NULL,
	display_name VARCHAR(255),
	avatar_url TEXT,
	message TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on fediverse_username for faster lookups
CREATE INDEX IF NOT EXISTS idx_guestbook_fediverse_username ON guestbook_entries(fediverse_username);
CREATE INDEX IF NOT EXISTS idx_guestbook_created_at ON guestbook_entries(created_at DESC);

-- Create OAuth sessions table to track auth state
CREATE TABLE IF NOT EXISTS oauth_sessions (
	id SERIAL PRIMARY KEY,
	session_token VARCHAR(255) UNIQUE NOT NULL,
	fediverse_instance VARCHAR(255) NOT NULL,
	client_id VARCHAR(255) NOT NULL,
	client_secret VARCHAR(255) NOT NULL,
	state VARCHAR(255) NOT NULL,
	code_verifier VARCHAR(255),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on session_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_session_token ON oauth_sessions(session_token);

-- Stored procedure to create a guestbook entry
CREATE OR REPLACE FUNCTION usp_create_guestbook_entry(
	p_fediverse_username VARCHAR(500),
	p_fediverse_instance VARCHAR(255),
	p_display_name VARCHAR(255),
	p_avatar_url TEXT,
	p_message TEXT
)
RETURNS JSONB AS $$
DECLARE
	v_result JSONB;
	v_entry RECORD;
BEGIN
	-- Validate inputs
	IF p_fediverse_username IS NULL OR p_fediverse_username = '' THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Fediverse username is required'
		);
	END IF;

	IF p_message IS NULL OR p_message = '' THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Message is required'
		);
	END IF;

	-- Insert entry
	INSERT INTO guestbook_entries (
		fediverse_username,
		fediverse_instance,
		display_name,
		avatar_url,
		message
	)
	VALUES (
		p_fediverse_username,
		p_fediverse_instance,
		p_display_name,
		p_avatar_url,
		p_message
	)
	RETURNING * INTO v_entry;

	-- Build success response
	RETURN jsonb_build_object(
		'success', true,
		'data', row_to_json(v_entry)
	);

EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error creating guestbook entry: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to get all guestbook entries with pagination
CREATE OR REPLACE FUNCTION usp_get_guestbook_entries(
	p_page INT DEFAULT 1,
	p_page_size INT DEFAULT 100
)
RETURNS JSONB AS $$
DECLARE
	v_offset INT;
	v_total_count INT;
	v_results JSONB;
BEGIN
	-- Validate pagination parameters
	IF p_page <= 0 THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Invalid page number'
		);
	END IF;

	IF p_page_size <= 0 THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Invalid page size'
		);
	END IF;

	v_offset := (p_page - 1) * p_page_size;

	-- Get total count
	SELECT COUNT(*) INTO v_total_count
	FROM guestbook_entries;

	-- Get paginated results
	SELECT jsonb_agg(row_to_json(t))
	INTO v_results
	FROM (
		SELECT *
		FROM guestbook_entries
		ORDER BY created_at DESC
		LIMIT p_page_size
		OFFSET v_offset
	) t;

	-- Handle empty results
	IF v_results IS NULL THEN
		v_results := '[]'::jsonb;
	END IF;

	RETURN jsonb_build_object(
		'success', true,
		'results', v_results,
		'page', p_page,
		'page_size', p_page_size,
		'total_count', v_total_count
	);

EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error retrieving guestbook entries: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to check if user has already signed
CREATE OR REPLACE FUNCTION usp_has_user_signed(
	p_fediverse_username VARCHAR(500)
)
RETURNS JSONB AS $$
DECLARE
	v_count INT;
BEGIN
	IF p_fediverse_username IS NULL OR p_fediverse_username = '' THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Fediverse username is required'
		);
	END IF;

	SELECT COUNT(*) INTO v_count
	FROM guestbook_entries
	WHERE fediverse_username = p_fediverse_username;

	RETURN jsonb_build_object(
		'success', true,
		'has_signed', v_count > 0
	);

EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error checking user signature: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to create OAuth session
CREATE OR REPLACE FUNCTION usp_create_oauth_session(
	p_session_token VARCHAR(255),
	p_fediverse_instance VARCHAR(255),
	p_client_id VARCHAR(255),
	p_client_secret VARCHAR(255),
	p_state VARCHAR(255),
	p_code_verifier VARCHAR(255),
	p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
	v_session RECORD;
BEGIN
	-- Validate inputs
	IF p_session_token IS NULL OR p_session_token = '' THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Session token is required'
		);
	END IF;

	-- Insert session
	INSERT INTO oauth_sessions (
		session_token,
		fediverse_instance,
		client_id,
		client_secret,
		state,
		code_verifier,
		expires_at
	)
	VALUES (
		p_session_token,
		p_fediverse_instance,
		p_client_id,
		p_client_secret,
		p_state,
		p_code_verifier,
		p_expires_at
	)
	RETURNING * INTO v_session;

	RETURN jsonb_build_object(
		'success', true,
		'data', row_to_json(v_session)
	);

EXCEPTION
	WHEN unique_violation THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Session token already exists'
		);
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error creating OAuth session: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to get OAuth session by token
CREATE OR REPLACE FUNCTION usp_get_oauth_session(
	p_session_token VARCHAR(255)
)
RETURNS JSONB AS $$
DECLARE
	v_session RECORD;
BEGIN
	IF p_session_token IS NULL OR p_session_token = '' THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Session token is required'
		);
	END IF;

	SELECT * INTO v_session
	FROM oauth_sessions
	WHERE session_token = p_session_token
		AND expires_at > CURRENT_TIMESTAMP;

	IF NOT FOUND THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Session not found or expired'
		);
	END IF;

	RETURN jsonb_build_object(
		'success', true,
		'data', row_to_json(v_session)
	);

EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error retrieving OAuth session: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to delete OAuth session
CREATE OR REPLACE FUNCTION usp_delete_oauth_session(
	p_session_token VARCHAR(255)
)
RETURNS JSONB AS $$
DECLARE
	v_count INT;
BEGIN
	IF p_session_token IS NULL OR p_session_token = '' THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Session token is required'
		);
	END IF;

	DELETE FROM oauth_sessions
	WHERE session_token = p_session_token;

	GET DIAGNOSTICS v_count = ROW_COUNT;

	RETURN jsonb_build_object(
		'success', true,
		'deleted_count', v_count
	);

EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error deleting OAuth session: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to clean up expired sessions
CREATE OR REPLACE FUNCTION usp_cleanup_expired_sessions()
RETURNS JSONB AS $$
DECLARE
	v_count INT;
BEGIN
	DELETE FROM oauth_sessions
	WHERE expires_at < CURRENT_TIMESTAMP;

	GET DIAGNOSTICS v_count = ROW_COUNT;

	RETURN jsonb_build_object(
		'success', true,
		'deleted_count', v_count
	);

EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object(
			'success', false,
			'error', 'Error cleaning up expired sessions: ' || SQLERRM
		);
END;
$$ LANGUAGE plpgsql;
