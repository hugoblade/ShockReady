import { Router } from "express";
import {
  refreshSession,
  signIn,
  signUp,
} from "../controllers/authController.js";

const router = Router();

router.post("/signup", signUp);
router.post("/login", signIn);
router.post("/refresh", refreshSession);

export default router;
