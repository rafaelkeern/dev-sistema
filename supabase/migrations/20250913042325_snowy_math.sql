/*
  # Add Authentication Function

  Create a PostgreSQL function to handle authentication
  This bypasses RLS issues and provides a clean authentication method
*/

-- Create authentication function
CREATE OR REPLACE FUNCTION authenticate_user(p_username text, p_password text)
RETURNS TABLE(id uuid, username text, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.nome
  FROM users u
  WHERE u.username = p_username 
    AND u.password = p_password;
END;
$$;