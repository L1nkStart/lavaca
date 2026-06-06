-- ============================================================================
-- Auto-Create User Profiles with Triggers - LaVaca Database
-- This script creates triggers to automatically create user profiles
-- ============================================================================

-- First, let's simplify the RLS policies to be more permissive for user creation
-- Drop existing policies and create simpler ones
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_select_public" ON users;

-- Create simpler, more permissive policies
CREATE POLICY "enable_read_users" ON users
  FOR SELECT USING (true);

CREATE POLICY "enable_insert_users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "enable_update_own_users" ON users
  FOR UPDATE USING (id = auth.uid());

-- Create a function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert new user profile
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    role,
    kyc_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Usuario'),
    NEW.raw_user_meta_data->>'avatar_url',
    'donor',
    'pending'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, do nothing
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the auth process
    RAISE LOG 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create user profile when auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also create trigger for updates (in case email confirmation updates the user)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Function to manually create missing profiles (run once)
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  missing_count INTEGER := 0;
  auth_user RECORD;
BEGIN
  -- Find auth users without profiles
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    -- Create missing profile
    INSERT INTO public.users (
      id,
      email,
      full_name,
      avatar_url,
      role,
      kyc_status
    )
    VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'full_name', auth_user.raw_user_meta_data->>'name', 'Usuario'),
      auth_user.raw_user_meta_data->>'avatar_url',
      'donor',
      'pending'
    );
    
    missing_count := missing_count + 1;
  END LOOP;
  
  RETURN missing_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in create_missing_user_profiles: %', SQLERRM;
    RETURN missing_count;
END;
$$;

-- Execute the function to create any missing profiles
SELECT create_missing_user_profiles() as profiles_created;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;
