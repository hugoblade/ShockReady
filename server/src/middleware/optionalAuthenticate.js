import { supabase } from "../config/Supabase.js";

export const optionalAuthenticate = async (request, response, next) => {
  const authorization = request.headers.authorization;

  if (!authorization) return next();

  if (!authorization.startsWith("Bearer ")) {
    return response.status(401).json({
      success: false,
      message: "Authentication token is invalid.",
    });
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return response.status(401).json({
      success: false,
      message: "Authentication token is required.",
    });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return response.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    request.user = {
      id: data.user.id,
      email: data.user.email ?? null,
      appMetadata: data.user.app_metadata ?? {},
    };

    return next();
  } catch (error) {
    return next(error);
  }
};
