
import { db } from "./config/firebase.js";

async function testFirebaseConnection() {
  const testRef = db
    .collection("_connectionTests")
    .doc("shockready");

  try {
    await testRef.set({
      message: "ShockReady backend connected successfully",
      testedAt: new Date().toISOString(),
    });

    const snapshot = await testRef.get();

    console.log("Firebase connection successful!");
    console.log("Test data:", snapshot.data());

    await testRef.delete();

    console.log("Temporary test document deleted.");
  } catch (error) {
    console.error("Firebase connection failed:", error.message);
    process.exitCode = 1;
  }
}

testFirebaseConnection();
