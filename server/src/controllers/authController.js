import { supabase } from "../config/Supabase.js";

const respondWithAuthError = (response, error, status) =>
  response.status(status).json({
    success: false,
    message: error.message,
  });

export const signUp = async (request, response, next) => {
  try {
    const { email, password, fullName, consent } = request.body ?? {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      typeof fullName !== "string" ||
      !fullName.trim() ||
      fullName.trim().length > 120 ||
      consent !== true
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A valid email, password of at least 8 characters, full name, and consent are required.",
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          consent: true,
        },
      },
    });

    if (error) return respondWithAuthError(response, error, 400);

    return response.status(201).json({
      success: true,
      message: data.session
        ? "Account created successfully."
        : "Check your email to confirm your account.",
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const signIn = async (request, response, next) => {
  try {
    const { email, password } = request.body ?? {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      !password
    ) {
      return response.status(400).json({
        success: false,
        message: "A valid email and password are required.",
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) return respondWithAuthError(response, error, 401);

    return response.status(200).json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const refreshSession = async (request, response, next) => {
  try {
    const { refreshToken } = request.body ?? {};

    if (typeof refreshToken !== "string" || !refreshToken.trim()) {
      return response.status(400).json({
        success: false,
        message: "A refresh token is required.",
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) return respondWithAuthError(response, error, 401);

    return response.status(200).json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    return next(error);
  }
};
