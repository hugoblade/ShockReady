import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const userId = process.argv[2];

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

if (!userId) {
  console.error("Provide the Supabase user ID.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    console.error("Could not retrieve user:", error.message);
    process.exitCode = 1;
    return;
  }

  if (!data.user) {
    console.error("User not found.");
    process.exitCode = 1;
    return;
  }

  const { data: result, error: updateError } =
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(data.user.app_metadata ?? {}),
        role: "SYSTEM_ADMIN",
      },
    });

  if (updateError) {
    console.error("Role assignment failed:", updateError.message);
    process.exitCode = 1;
    return;
  }

  console.log("System administrator role assigned successfully.");
  console.log("Role:", result.user.app_metadata.role);
}

main().catch((error) => {
  console.error("Unexpected error:", error.message);
  process.exitCode = 1;
});