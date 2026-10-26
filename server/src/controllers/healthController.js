
import { supabase } from "../config/Supabase.js";

export const getHealth = async (_request, response) => {
  try {
    const { error } = await supabase.auth.getSession();

    if (error) {
      console.error("Supabase health check failed:", error.message);

      return response.status(503).json({
        status: "error",
        services: {
          api: "operational",
          supabase: "unavailable",
        },
        timestamp: new Date().toISOString(),
      });
    }

    return response.status(200).json({
      status: "ok",
      services: {
        api: "operational",
        supabase: "configured",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Supabase health check failed:", error.message);

    return response.status(503).json({
      status: "error",
      services: {
        api: "operational",
        supabase: "unavailable",
      },
      timestamp: new Date().toISOString(),
    });
  }
};
